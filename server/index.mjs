import './load-env.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
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
import {
  ResendError,
  getEmail as getResendEmail,
  resolveResendKey,
  resendServerKeyConfigured,
  sendEmail as sendResendEmail,
  validateKey as validateResendKey,
  verifyDomain as verifyResendDomain,
} from './delivery/resend.mjs';
import { textToHtml } from './delivery/templates.mjs';
import { persistResendKey } from './delivery/env.mjs';
import {
  findSend,
  listSends,
  recordSend,
  updateSend,
} from './delivery/store.mjs';
import {
  WhatsAppError,
  bootstrapWhatsApp,
  clearWhatsAppCache,
  connect as connectWhatsApp,
  getAvatar as getWhatsAppAvatar,
  getMedia as getWhatsAppMedia,
  getProfile as getWhatsAppProfile,
  getStatus as getWhatsAppStatus,
  isMockMode as isWhatsAppMock,
  logout as logoutWhatsApp,
  readChat as readWhatsAppChat,
  sendText as sendWhatsAppText,
  whatsappEvents,
} from './whatsapp/session.mjs';
import {
  getChat as getWhatsAppChat,
  getMessages as getWhatsAppMessages,
  listChats as listWhatsAppChats,
} from './whatsapp/store.mjs';
import { buildWhatsAppPrompt } from './whatsapp/prompts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');

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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SEND_LIMIT_PER_HOUR = Math.max(
  1,
  Number(process.env.RESEND_SEND_LIMIT_PER_HOUR) || 20,
);
const sendHits = new Map();

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

function resendDefaults() {
  return {
    fromName: trim(process.env.RESEND_FROM_NAME, 80) || 'PolySend',
    fromEmail: trim(process.env.RESEND_FROM_EMAIL, 320) || null,
    replyTo: trim(process.env.RESEND_REPLY_TO, 320) || null,
  };
}

function deliveryError(error) {
  if (!(error instanceof ResendError)) return error;

  const detail =
    typeof error.details === 'string'
      ? error.details
      : error.details?.message ?? error.message ?? null;

  if (error.status === 401) {
    return new HttpError(
      401,
      'resend_invalid_key',
      'The Resend API key is invalid, inactive, or restricted.',
      detail,
    );
  }
  if (error.status === 403) {
    return new HttpError(
      403,
      'resend_forbidden',
      'Resend rejected this request. Check the sender domain and API key permissions.',
      detail,
    );
  }
  if (error.status === 400 || error.status === 422) {
    return new HttpError(
      422,
      'resend_validation',
      'Resend rejected the email. Check the sender, recipient, and content.',
      detail,
    );
  }
  if (error.status === 429) {
    return new HttpError(
      429,
      'resend_rate_limited',
      'Resend rate limit reached. Wait a moment and try again.',
      detail,
    );
  }
  if (error.status === 504) {
    return new HttpError(
      504,
      'resend_timeout',
      'Resend took too long to respond. Try again.',
      detail,
    );
  }
  return new HttpError(
    502,
    'resend_error',
    'Resend could not process the request. Try again.',
    detail,
  );
}

function validateDeliveryPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'bad_request', 'Invalid delivery payload.');
  }

  const to = trim(body.to, 320);
  const fromEmail = trim(body.fromEmail, 320);
  const replyTo = trim(body.replyTo, 320);
  const fromName = trim(body.fromName, 80).replace(/[<>\r\n"]/g, '').trim();
  const subject = trim(body.subject, 240).replace(/[\r\n]+/g, ' ').trim();
  const text = trim(body.text, 50_000);
  const idempotencyKey = trim(body.idempotencyKey, 256);

  if (!EMAIL_PATTERN.test(to)) {
    throw new HttpError(400, 'invalid_recipient', 'Enter a valid recipient email address.');
  }
  if (!EMAIL_PATTERN.test(fromEmail)) {
    throw new HttpError(400, 'invalid_sender', 'Enter a valid sender email address.');
  }
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
    throw new HttpError(400, 'invalid_reply_to', 'Enter a valid reply-to email address.');
  }
  if (!subject) {
    throw new HttpError(400, 'missing_subject', 'The email subject is required.');
  }
  if (!text) {
    throw new HttpError(400, 'missing_email_body', 'The email body is required.');
  }

  return {
    to,
    fromEmail,
    replyTo: replyTo || null,
    fromName: fromName || 'PolySend',
    subject,
    text,
    idempotencyKey: idempotencyKey || randomUUID(),
  };
}

function allowSendHit(bucket, limit) {
  const now = Date.now();
  const recent = (sendHits.get(bucket) ?? []).filter((time) => now - time < 3_600_000);
  if (recent.length >= limit) {
    sendHits.set(bucket, recent);
    return false;
  }
  recent.push(now);
  sendHits.set(bucket, recent);
  return true;
}

function checkSendRate(sessionId, ip) {
  const sessionAllowed = allowSendHit(`session:${sessionId}`, SEND_LIMIT_PER_HOUR);
  const ipAllowed = allowSendHit(`ip:${ip}`, SEND_LIMIT_PER_HOUR * 2);
  return sessionAllowed && ipAllowed;
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

function whatsappJid(value) {
  const jid = trim(value, 140);
  if (!/^[A-Za-z0-9._:-]+@(s\.whatsapp\.net|g\.us|lid)$/.test(jid)) {
    throw new HttpError(400, 'whatsapp_invalid_chat', 'Invalid WhatsApp chat.');
  }
  return jid;
}

function whatsappError(error) {
  if (error instanceof WhatsAppError) {
    return new HttpError(error.status, error.code, error.message);
  }
  return error;
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

async function handleWhatsAppStream(req, res) {
  const key = resolveKey(req);
  if (!key) {
    throw new HttpError(
      401,
      'missing_key',
      'Nenhuma chave de API configurada. Abra "Configurar API" e cole sua chave do OpenCode Go.',
    );
  }

  const body = req.body ?? {};
  const chatJid = whatsappJid(body.chatJid);
  const chat = getWhatsAppChat(chatJid);
  if (!chat) {
    throw new HttpError(404, 'whatsapp_chat_not_found', 'Chat not found.');
  }

  const model = trim(body.model, 120);
  if (!model) {
    throw new HttpError(400, 'invalid_model', 'Choose a model before generating.');
  }

  const tone = TONES.has(body.tone) ? body.tone : 'amigavel';
  const language = LANGUAGES.has(body.language) ? body.language : 'pt-BR';
  const length = LENGTHS.has(body.length) ? body.length : 'medio';
  const instruction = trim(body.instruction, 600);
  const reasoningEffort =
    typeof body.reasoningEffort === 'string' && EFFORTS.has(body.reasoningEffort)
      ? body.reasoningEffort
      : undefined;

  const { messages, maxTokens } = buildWhatsAppPrompt({
    chatName: chat.name,
    isGroup: chat.isGroup,
    history: getWhatsAppMessages(chatJid),
    instruction,
    tone,
    language,
    length,
  });

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
      model,
      messages,
      maxTokens,
      reasoningEffort,
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
  let text = '';
  let usage = null;
  let finishReason = null;
  let started = false;
  let thinking = false;

  const handleData = (raw) => {
    if (!raw || raw === '[DONE]') return;
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    if (json.error) {
      throw new Error(
        json.error.message ?? 'A API interrompeu a geração. Tente novamente com outro modelo.',
      );
    }
    if (json.choices?.[0]?.finish_reason) {
      finishReason = json.choices[0].finish_reason;
    }
    const delta = json.choices?.[0]?.delta ?? {};
    if ((delta.reasoning || delta.reasoning_content) && !thinking) {
      thinking = true;
      sseWrite(res, 'status', { phase: 'thinking' });
    }
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      if (!started) {
        started = true;
        sseWrite(res, 'status', { phase: 'writing' });
      }
      text += delta.content;
      sseWrite(res, 'delta', { text: delta.content });
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

    if (usage) sseWrite(res, 'usage', usage);

    if (!text.trim()) {
      sseWrite(res, 'error', {
        code: 'empty_response',
        message:
          'O modelo encerrou sem escrever a mensagem. Tente outro modelo ou gere novamente.',
      });
    } else {
      sseWrite(res, 'done', {
        elapsedMs: Math.round(performance.now() - startedAt),
        model,
        truncated: finishReason === 'length',
      });
    }
  } catch (error) {
    if (!clientGone) {
      console.error('  [whatsapp-ai]', model, error?.message ?? error);
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
    resendKeyConfigured: resendServerKeyConfigured(),
    resendProvider: 'resend',
    resendDefaults: resendDefaults(),
    whatsappState: getWhatsAppStatus().state,
    whatsappMock: isWhatsAppMock(),
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

app.get(
  '/api/delivery/status',
  asyncRoute(async (req, res) => {
    const key = resolveResendKey(req);
    if (!key) {
      throw new HttpError(
        401,
        'missing_resend_key',
        'No Resend API key configured. Open Delivery settings and connect your Resend key.',
      );
    }

    try {
      const result = await validateResendKey(key);
      res.json({
        provider: 'resend',
        configured: true,
        valid: true,
        keySource: req.get('x-resend-key')?.trim() ? 'client' : 'server',
        restricted: result.restricted,
        domains: result.domains,
        defaults: resendDefaults(),
      });
    } catch (error) {
      throw deliveryError(error);
    }
  }),
);

app.post(
  '/api/delivery/key',
  asyncRoute(async (req, res) => {
    const key = trim(req.body?.key, 200);
    if (!/^re_[A-Za-z0-9_-]{8,}$/.test(key)) {
      throw new HttpError(400, 'invalid_resend_key', 'Paste a valid Resend API key.');
    }

    let result;
    try {
      result = await validateResendKey(key);
    } catch (error) {
      throw deliveryError(error);
    }

    try {
      await persistResendKey(key, ENV_PATH);
    } catch (error) {
      throw new HttpError(
        500,
        'env_write_failed',
        'Could not save the Resend key to the server .env file.',
        error?.code ?? error?.message,
      );
    }
    process.env.RESEND_API_KEY = key;

    res.json({
      saved: true,
      provider: 'resend',
      configured: true,
      valid: true,
      keySource: 'server',
      restricted: result.restricted,
      domains: result.domains,
      defaults: resendDefaults(),
    });
  }),
);

app.post(
  '/api/delivery/domains/:id/verify',
  asyncRoute(async (req, res) => {
    const key = resolveResendKey(req);
    if (!key) {
      throw new HttpError(401, 'missing_resend_key', 'No Resend API key configured.');
    }
    const domainId = trim(req.params.id, 100);
    if (!domainId) {
      throw new HttpError(400, 'invalid_domain', 'Invalid domain ID.');
    }

    try {
      await verifyResendDomain(key, domainId);
      res.json({ ok: true });
    } catch (error) {
      throw deliveryError(error);
    }
  }),
);

app.get(
  '/api/delivery/history',
  asyncRoute(async (req, res) => {
    res.json({ items: listSends(sessionIdFrom(req)) });
  }),
);

app.get(
  '/api/delivery/history/:id',
  asyncRoute(async (req, res) => {
    const key = resolveResendKey(req);
    if (!key) {
      throw new HttpError(401, 'missing_resend_key', 'No Resend API key configured.');
    }

    const sessionId = sessionIdFrom(req);
    const emailId = trim(req.params.id, 120);
    const item = findSend(sessionId, emailId);
    if (!item) {
      throw new HttpError(404, 'email_not_found', 'This email is not in this session history.');
    }

    try {
      const remote = await getResendEmail(key, emailId);
      const updated = updateSend(sessionId, emailId, {
        lastEvent: remote.lastEvent,
        status: remote.lastEvent ?? item.status,
        lastCheckedAt: new Date().toISOString(),
      });
      res.json({ item: updated ?? item });
    } catch (error) {
      throw deliveryError(error);
    }
  }),
);

app.post(
  '/api/delivery/send',
  asyncRoute(async (req, res) => {
    const key = resolveResendKey(req);
    if (!key) {
      throw new HttpError(
        401,
        'missing_resend_key',
        'No Resend API key configured. Open Delivery settings and connect your Resend key.',
      );
    }

    const sessionId = sessionIdFrom(req);
    if (!checkSendRate(sessionId, req.ip)) {
      throw new HttpError(
        429,
        'send_rate_limited',
        'Too many emails sent from this session. Wait a few minutes and try again.',
      );
    }

    const payload = validateDeliveryPayload(req.body);
    const fromName = payload.fromName;
    const from = `${fromName} <${payload.fromEmail}>`;
    const html = textToHtml(payload.text);

    let result;
    try {
      result = await sendResendEmail(key, {
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html,
        replyTo: payload.replyTo,
        idempotencyKey: payload.idempotencyKey,
      });
    } catch (error) {
      throw deliveryError(error);
    }

    const item = {
      id: result.id,
      provider: 'resend',
      keySource: req.get('x-resend-key')?.trim() ? 'client' : 'server',
      to: payload.to,
      from,
      subject: payload.subject,
      createdAt: new Date().toISOString(),
      status: 'accepted',
      lastEvent: null,
    };
    recordSend(sessionId, item);

    res.status(201).json({ item });
  }),
);

app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    ...getWhatsAppStatus(),
    chatCount: listWhatsAppChats().length,
  });
});

app.post(
  '/api/whatsapp/connect',
  asyncRoute(async (req, res) => {
    try {
      const status = await connectWhatsApp();
      res.json({ ...status, chatCount: listWhatsAppChats().length });
    } catch (error) {
      throw whatsappError(error);
    }
  }),
);

app.post(
  '/api/whatsapp/logout',
  asyncRoute(async (req, res) => {
    try {
      const status = await logoutWhatsApp();
      res.json({ ...status, chatCount: listWhatsAppChats().length });
    } catch (error) {
      throw whatsappError(error);
    }
  }),
);

app.post(
  '/api/whatsapp/cache/clear',
  asyncRoute(async (req, res) => {
    try {
      const status = await clearWhatsAppCache();
      res.json({ ok: true, status, chats: listWhatsAppChats() });
    } catch (error) {
      throw whatsappError(error);
    }
  }),
);

app.get('/api/whatsapp/chats', (req, res) => {
  const query = trim(req.query.q, 80);
  res.json({ chats: listWhatsAppChats(query) });
});

app.get('/api/whatsapp/chats/:jid/messages', (req, res) => {
  const jid = whatsappJid(req.params.jid);
  const chat = getWhatsAppChat(jid);
  if (!chat) {
    throw new HttpError(404, 'whatsapp_chat_not_found', 'Chat not found.');
  }
  readWhatsAppChat(jid);
  res.json({ chat: { ...chat, unread: 0 }, messages: getWhatsAppMessages(jid) });
});

app.post(
  '/api/whatsapp/chats/:jid/messages',
  asyncRoute(async (req, res) => {
    const jid = whatsappJid(req.params.jid);
    const text = trim(req.body?.text, 4000);
    if (!text) {
      throw new HttpError(400, 'whatsapp_empty_message', 'Type a message before sending.');
    }
    try {
      const message = await sendWhatsAppText(jid, text);
      res.status(201).json({ message, chat: getWhatsAppChat(jid) });
    } catch (error) {
      throw whatsappError(error);
    }
  }),
);

app.post('/api/whatsapp/chats/:jid/read', (req, res) => {
  const jid = whatsappJid(req.params.jid);
  try {
    const chat = readWhatsAppChat(jid);
    res.json({ chat: { ...chat, unread: 0 } });
  } catch (error) {
    throw whatsappError(error);
  }
});

app.get(
  '/api/whatsapp/profile/:jid',
  asyncRoute(async (req, res) => {
    const jid = trim(req.params.jid, 140);
    try {
      const profile = await getWhatsAppProfile(jid);
      res.json({ profile });
    } catch (error) {
      throw whatsappError(error);
    }
  }),
);

app.get(
  '/api/whatsapp/avatar/:jid',
  asyncRoute(async (req, res) => {
    const jid = trim(req.params.jid, 140);
    let avatar;
    try {
      avatar = await getWhatsAppAvatar(jid);
    } catch (error) {
      const status = error instanceof WhatsAppError ? error.status : 502;
      res.status(status === 404 ? 404 : 502).end();
      return;
    }
    if (avatar.redirectUrl) {
      res.redirect(302, avatar.redirectUrl);
      return;
    }
    res.setHeader('Content-Type', avatar.mimetype);
    res.setHeader('Content-Length', avatar.buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(avatar.buffer);
  }),
);

app.get(
  '/api/whatsapp/media/:id',
  asyncRoute(async (req, res) => {
    const id = trim(req.params.id, 200);
    if (!id) {
      throw new HttpError(400, 'whatsapp_media_invalid', 'Invalid media ID.');
    }

    let media;
    try {
      media = await getWhatsAppMedia(id);
    } catch (error) {
      throw whatsappError(error);
    }

    const fallback = {
      image: 'image/jpeg',
      sticker: 'image/webp',
      audio: 'audio/ogg',
      video: 'video/mp4',
      document: 'application/octet-stream',
    };
    const mimetype = media.mimetype || fallback[media.kind] || 'application/octet-stream';
    const fileName = media.fileName || 'media';
    const safeName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Length', media.buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader(
      'Content-Disposition',
      media.kind === 'document'
        ? `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : 'inline',
    );
    res.send(media.buffer);
  }),
);

app.get('/api/whatsapp/events', (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => sseWrite(res, event, data);
  const statusWithCount = () => ({
    ...getWhatsAppStatus(),
    chatCount: listWhatsAppChats().length,
  });

  send('status', statusWithCount());
  send('chats', { chats: listWhatsAppChats() });

  const onStatus = (status) => send('status', { ...status, chatCount: listWhatsAppChats().length });
  const onMessage = (payload) => send('message', payload);
  const onChats = (chats) => send('chats', { chats });

  whatsappEvents.on('status', onStatus);
  whatsappEvents.on('message', onMessage);
  whatsappEvents.on('chats', onChats);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      try {
        res.write(': ping\n\n');
      } catch {
        /* client disconnected */
      }
    }
  }, HEARTBEAT_MS);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    whatsappEvents.off('status', onStatus);
    whatsappEvents.off('message', onMessage);
    whatsappEvents.off('chats', onChats);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        /* noop */
      }
    }
  };

  res.on('close', cleanup);
  req.on('close', cleanup);
});

app.post('/api/whatsapp/ai/stream', asyncRoute(handleWhatsAppStream));

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

  const details =
    error?.details == null
      ? undefined
      : typeof error.details === 'string'
        ? error.details.slice(0, 500)
        : JSON.stringify(error.details).slice(0, 500);

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
});

void bootstrapWhatsApp();

app.listen(PORT, () => {
  console.log('');
  console.log('  PolySend - API');
  console.log('  ---------------------------------------------');
  console.log(`  API      http://localhost:${PORT}`);
  console.log('  Web      http://localhost:5173  (npm run dev)');
  console.log(`  Go key   ${serverKeyConfigured() ? 'carregada do .env' : 'nao configurada'}`);
  console.log(
    `  Resend   ${resendServerKeyConfigured() ? 'chave no .env' : 'aguardando chave pelo painel'}`,
  );
  console.log(
    `  WhatsApp ${isWhatsAppMock() ? 'modo demo (WHATSAPP_MOCK=1)' : getWhatsAppStatus().state}`,
  );
  console.log(`  Upstream ${BASE_URL}`);
  console.log('');
});
