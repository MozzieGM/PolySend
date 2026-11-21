import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import {
  HttpError,
  fetchUsage,
  listModels,
  resolveKey,
  serverKeyConfigured,
  streamCompletion,
} from './opencode.mjs';
import {
  buildGenerateMessages,
  buildRefineMessages,
  buildSelectionMessages,
  maxTokensFor,
} from './prompts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const BASE_URL = 'https://opencode.ai/inference/go';
const TONES = new Set(['profissional', 'direto', 'amigavel', 'persuasivo', 'empatico', 'formal']);
const LENGTHS = new Set(['curto', 'medio', 'longo']);
const LANGUAGES = new Set(['pt-BR', 'en', 'es']);
const MODES = new Set(['generate', 'refine', 'selection']);
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const HEARTBEAT_MS = 15_000;
const STREAM_TIMEOUT_MS = 180_000;

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`  ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
    }
  });
  next();
});

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function trim(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sanitizeBriefing(input) {
  const briefing = input && typeof input === 'object' ? input : {};
  return {
    recipient: trim(briefing.recipient, 200),
    company: trim(briefing.company, 160),
    topic: trim(briefing.topic, 2500),
    details: trim(briefing.details, 2000),
    signature: trim(briefing.signature, 300),
    tone: TONES.has(briefing.tone) ? briefing.tone : 'profissional',
    length: LENGTHS.has(briefing.length) ? briefing.length : 'medio',
    language: LANGUAGES.has(briefing.language) ? briefing.language : 'pt-BR',
  };
}

function validateEmailRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'bad_request', 'Corpo da requisição inválido.');
  }

  const model = trim(body.model, 100);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(model)) {
    throw new HttpError(400, 'invalid_model', 'Escolha um modelo válido do catálogo Go.');
  }

  const mode = MODES.has(body.mode) ? body.mode : 'generate';
  const briefing = sanitizeBriefing(body.briefing);
  const emailBody = trim(body.body, 20_000);
  const instruction = trim(body.instruction, 600);
  const selection = trim(body.selection, 4000);
  const reasoningEffort =
    typeof body.reasoningEffort === 'string' && EFFORTS.has(body.reasoningEffort)
      ? body.reasoningEffort
      : null;

  if (mode === 'generate' && !briefing.topic) {
    throw new HttpError(400, 'missing_topic', 'Descreva o objetivo do e-mail antes de gerar.');
  }
  if (mode === 'refine' && !emailBody) {
    throw new HttpError(400, 'missing_body', 'Não há e-mail para refinar.');
  }
  if (mode === 'selection' && (!emailBody || !selection)) {
    throw new HttpError(400, 'missing_selection', 'Selecione um trecho do e-mail para reescrever.');
  }

  let messages;
  if (mode === 'selection') {
    messages = buildSelectionMessages(
      briefing,
      emailBody,
      selection,
      instruction || 'Deixe o trecho mais claro e natural, mantendo o sentido.',
    );
  } else if (mode === 'refine') {
    messages = buildRefineMessages(
      briefing,
      emailBody,
      instruction || 'Deixe o e-mail mais claro, natural e fácil de responder.',
    );
  } else {
    messages = buildGenerateMessages(briefing);
  }

  return {
    model,
    mode,
    briefing,
    messages,
    maxTokens: maxTokensFor(mode, briefing),
    reasoningEffort,
  };
}

function sessionIdFrom(req) {
  const raw = trim(req.get('x-session-id'), 80).replace(/[^A-Za-z0-9_-]/g, '');
  if (raw.startsWith('ses_') && raw.length >= 8) return raw;
  return `ses_live_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

function sseWrite(res, event, data) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

const SUBJECT_RE =
  /^\s*(?:#+\s*)?(?:\*\*|__)?\s*(assunto|subject)\s*(?:\*\*|__)?\s*[:：\-–—]\s*(.*?)\s*$/i;

function parseSubjectLine(line) {
  const match = line.replace(/\r$/, '').match(SUBJECT_RE);
  if (!match) return null;
  const subject = match[2]
    .trim()
    .replace(/^[*_`"'“”‘’]+/, '')
    .replace(/[*_`"'“”‘’]+$/, '')
    .trim();
  return subject || null;
}

async function handleEmailStream(req, res, next) {
  const key = resolveKey(req);
  if (!key) {
    throw new HttpError(
      401,
      'missing_key',
      'Nenhuma chave de API configurada. Abra "Configurar API" e cole sua chave do OpenCode Go.',
    );
  }

  const request = validateEmailRequest(req.body);
  const sessionId = sessionIdFrom(req);
  const controller = new AbortController();
  let clientGone = false;
  let timedOut = false;

  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort();
    }
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, STREAM_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await streamCompletion({
      key,
      model: request.model,
      messages: request.messages,
      maxTokens: request.maxTokens,
      reasoningEffort: request.reasoningEffort,
      sessionId,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (clientGone) return;
    if (error?.name === 'AbortError' && timedOut) {
      throw new HttpError(504, 'timeout', 'A API demorou demais para responder. Tente novamente.');
    }
    throw error;
  }

  if (!upstream.body) {
    clearTimeout(timeout);
    throw new HttpError(502, 'empty_stream', 'A API não retornou um stream de resposta.');
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const startedAt = performance.now();
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      try {
        res.write(': ping\n\n');
      } catch {
        /* client disconnected */
      }
    }
  }, HEARTBEAT_MS);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let head = '';
  let subjectResolved = request.mode !== 'generate';
  let bodyStarted = false;
  let thinkingSent = false;
  let fullBody = '';
  let usage = null;
  let finishReason = null;

  const pushBody = (rawText) => {
    if (!rawText) return;
    let text = rawText;
    if (!bodyStarted) {
      text = text.replace(/^[\r\n]+/, '');
      if (!text) return;
      bodyStarted = true;
      sseWrite(res, 'status', { phase: 'writing' });
    }
    fullBody += text;
    sseWrite(res, 'delta', { text });
  };

  const handleGenerateContent = (chunk) => {
    if (subjectResolved) {
      pushBody(chunk);
      return;
    }

    head += chunk;
    if (!head.trim()) {
      head = '';
      return;
    }

    const newline = head.search(/\r?\n/);
    if (newline === -1 && head.length < 260) return;

    const line = newline === -1 ? head : head.slice(0, newline);
    const rest = newline === -1 ? '' : head.slice(newline).replace(/^\r?\n/, '');
    head = '';
    subjectResolved = true;

    const parsedSubject = parseSubjectLine(line);
    if (parsedSubject) {
      sseWrite(res, 'subject', { subject: parsedSubject });
      pushBody(rest.replace(/^\s*\r?\n/, ''));
    } else {
      pushBody(line + rest);
    }
  };

  const handleData = (raw) => {
    if (!raw || raw === '[DONE]') return;
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }

    if (json.error) {
      const message =
        json.error.message ?? 'A API interrompeu a geração. Tente novamente com outro modelo.';
      throw new Error(message);
    }

    if (json.choices?.[0]?.finish_reason) {
      finishReason = json.choices[0].finish_reason;
    }

    const delta = json.choices?.[0]?.delta ?? {};
    const reasoning = delta.reasoning ?? delta.reasoning_content;
    if (reasoning && !thinkingSent) {
      thinkingSent = true;
      sseWrite(res, 'status', { phase: 'thinking' });
    }

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      if (request.mode === 'generate') handleGenerateContent(delta.content);
      else pushBody(delta.content);
    }

    if (json.usage) usage = json.usage;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        handleData(line.slice(5).trim());
      }
    }

    if (buffer.startsWith('data:')) handleData(buffer.slice(5).trim());

    if (!subjectResolved) {
      const trailing = head.trim();
      if (trailing) {
        const parsedSubject = parseSubjectLine(trailing);
        if (parsedSubject) sseWrite(res, 'subject', { subject: parsedSubject });
        else pushBody(head);
      }
    }

    if (usage) sseWrite(res, 'usage', usage);

    if (!fullBody.trim()) {
      sseWrite(res, 'error', {
        code: 'empty_response',
        message:
          'O modelo encerrou sem escrever o e-mail. Tente outro modelo ou gere novamente.',
      });
    } else {
      sseWrite(res, 'done', {
        elapsedMs: Math.round(performance.now() - startedAt),
        model: request.model,
        truncated: finishReason === 'length',
      });
    }
  } catch (error) {
    if (!clientGone) {
      console.error('  [stream]', request.model, error?.message ?? error);
      sseWrite(res, 'error', {
        code: timedOut ? 'timeout' : 'stream_error',
        message: timedOut
          ? 'A API demorou demais para responder. Tente novamente.'
          : 'A conexão com a API foi interrompida. Tente gerar novamente.',
      });
    }
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        /* client disconnected */
      }
    }
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    serverKeyConfigured: serverKeyConfigured(),
    apiBase: BASE_URL,
    fetchedAt: new Date().toISOString(),
  });
});

app.get(
  '/api/models',
  asyncRoute(async (req, res) => {
    const key = resolveKey(req);
    if (!key) {
      throw new HttpError(
        401,
        'missing_key',
        'Nenhuma chave de API configurada. Abra "Configurar API" e cole sua chave do OpenCode Go.',
      );
    }
    const { models, fetchedAt } = await listModels(key, sessionIdFrom(req));
    res.json({
      models,
      fetchedAt,
      source: req.get('x-opencode-key')?.trim() ? 'client' : 'server',
    });
  }),
);

app.get(
  '/api/usage',
  asyncRoute(async (req, res) => {
    const key = resolveKey(req);
    if (!key) {
      throw new HttpError(401, 'missing_key', 'Nenhuma chave de API configurada.');
    }
    try {
      const usage = await fetchUsage(key, sessionIdFrom(req));
      res.json(usage);
    } catch (error) {
      if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
        res.json({
          available: false,
          message:
            'O consumo do plano não está disponível para esta chave. Os modelos e o custo por requisição continuam funcionando.',
          fetchedAt: new Date().toISOString(),
        });
        return;
      }
      throw error;
    }
  }),
);

app.post('/api/email/stream', asyncRoute(handleEmailStream));

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .type('text/plain')
      .send(
        'PolySend API está rodando.\nAbra http://localhost:5173 durante o desenvolvimento (npm run dev).',
      );
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Rota de API não encontrada.' } });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  const isBadJson = error?.type === 'entity.parse.failed';
  const status = error instanceof HttpError ? error.status : isBadJson ? 400 : 500;
  const code = error instanceof HttpError ? error.code : isBadJson ? 'bad_json' : 'internal_error';
  const message =
    error instanceof HttpError
      ? error.message
      : isBadJson
        ? 'O corpo da requisição não é um JSON válido.'
        : 'Erro interno no servidor. Tente novamente.';

  console.error(
    `  [error] ${req.method} ${req.path} ${status} ${code} — ${error?.message ?? error}`,
  );
  if (error?.details) console.error('  [detail]', String(error.details).slice(0, 500));

  res.status(status).json({ error: { code, message } });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  PolySend - API');
  console.log('  ---------------------------------------------');
  console.log(`  API      http://localhost:${PORT}`);
  console.log('  Web      http://localhost:5173  (npm run dev)');
  console.log(`  Key      ${serverKeyConfigured() ? 'carregada do .env' : 'nao configurada'}`);
  console.log(`  Upstream ${BASE_URL}`);
  console.log('');
});
