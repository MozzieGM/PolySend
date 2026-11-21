const BASE_URL = 'https://opencode.ai/inference/go';
const USER_AGENT = 'polysend-studio/1.0';
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function serverKeyConfigured() {
  return Boolean(process.env.OPENCODE_API_KEY?.trim());
}

export function resolveKey(req) {
  const fromClient = req.get('x-opencode-key')?.trim();
  const fromEnv = process.env.OPENCODE_API_KEY?.trim();
  return fromClient || fromEnv || null;
}

function requestHeaders(key, sessionId, accept) {
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: accept,
    'User-Agent': USER_AGENT,
  };
  if (sessionId) headers['x-opencode-session'] = sessionId;
  return headers;
}

function readNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeCachePrice(cache) {
  if (typeof cache === 'number') return cache;
  if (!cache || typeof cache !== 'object') return null;
  for (const value of Object.values(cache)) {
    if (typeof value === 'number') return value;
  }
  return null;
}

function normalizeModel(model) {
  const input = readNumber(model.cost?.text?.input?.price) ?? 0;
  const output = readNumber(model.cost?.text?.output?.price) ?? 0;
  const cacheRead = normalizeCachePrice(model.cost?.text?.input?.cache?.read);
  const monthly = model.go?.monthly_usage;

  return {
    id: model.id,
    name: model.name ?? model.id,
    description: model.description ?? null,
    context: readNumber(model.limit?.context),
    maxOutput: readNumber(model.limit?.output),
    price: { input, output, cacheRead },
    free: input === 0 && output === 0,
    go: {
      monthlyUsage: monthly
        ? {
            go: readNumber(monthly.go),
            goPlus: readNumber(monthly['go-plus']),
            goTeams: readNumber(monthly['go-teams']),
          }
        : null,
      zdr: Boolean(model.go?.zdr),
      training: Boolean(model.go?.training),
      featured: Boolean(model.go?.featured),
      limitedRegions: Boolean(model.go?.limited_regions),
    },
    reasoning: {
      supported: Boolean(model.capabilities?.reasoning?.supported),
      efforts: Array.isArray(model.capabilities?.reasoning?.effort)
        ? model.capabilities.reasoning.effort.filter((e) => EFFORTS.has(e))
        : [],
    },
    nativeApi: Object.keys(model.api ?? {})[0] ?? null,
    releaseDate: model.release_date ?? null,
  };
}

async function upstreamError(response) {
  let body = null;
  let raw = '';
  try {
    raw = await response.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  const upstreamMessage =
    body?.error?.message ??
    body?.message ??
    (raw && raw.length < 300 ? raw : null);

  const status = response.status;
  if (status === 401) {
    return new HttpError(
      401,
      'invalid_key',
      'Chave de API inválida ou expirada. Confira a chave no OpenCode Console.',
      upstreamMessage,
    );
  }
  if (status === 403) {
    return new HttpError(
      403,
      'forbidden',
      'Essa chave não tem acesso aos modelos Go. Verifique a assinatura e as permissões da chave.',
      upstreamMessage,
    );
  }
  if (status === 402) {
    return new HttpError(
      402,
      'no_credit',
      'Sem saldo ou limite disponível para este modelo agora.',
      upstreamMessage,
    );
  }
  if (status === 404) {
    return new HttpError(
      404,
      'not_found',
      'Modelo não encontrado no catálogo Go. Atualize a lista de modelos.',
      upstreamMessage,
    );
  }
  if (status === 429) {
    return new HttpError(
      429,
      'rate_limited',
      'Limite de uso atingido. Aguarde a janela renovar ou escolha outro modelo.',
      upstreamMessage,
    );
  }
  return new HttpError(
    status >= 500 ? 502 : status,
    'upstream_error',
    'A API do OpenCode não respondeu como esperado. Tente novamente em instantes.',
    upstreamMessage,
  );
}

async function callApi(url, key, sessionId, init = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...requestHeaders(key, sessionId, init.accept ?? 'application/json'),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new HttpError(
      502,
      'network_error',
      'Não foi possível falar com a API do OpenCode. Verifique sua conexão.',
      error?.message ?? null,
    );
  }
  if (!response.ok) throw await upstreamError(response);
  return response;
}

export async function listModels(key, sessionId) {
  const response = await callApi(`${BASE_URL}/v1/models`, key, sessionId);
  const body = await response.json();
  const models = Array.isArray(body?.data) ? body.data.map(normalizeModel) : [];
  return { models, fetchedAt: new Date().toISOString() };
}

function normalizeWindow(window) {
  if (!window || typeof window !== 'object') return null;
  const percent = readNumber(window.percent);
  return {
    status: typeof window.status === 'string' ? window.status : 'unknown',
    percent: percent == null ? null : Math.min(100, Math.max(0, percent)),
    resetsAt: typeof window.resetsAt === 'string' ? window.resetsAt : null,
  };
}

export async function fetchUsage(key, sessionId) {
  const response = await callApi(`${BASE_URL}/v1/usage`, key, sessionId);
  const body = await response.json();
  const usage = body?.usage ?? {};
  return {
    available: true,
    rolling: normalizeWindow(usage.rolling),
    weekly: normalizeWindow(usage.weekly),
    monthly: normalizeWindow(usage.monthly),
    fetchedAt: new Date().toISOString(),
  };
}

export async function streamCompletion({
  key,
  model,
  messages,
  maxTokens,
  reasoningEffort,
  sessionId,
  signal,
}) {
  const payload = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: maxTokens,
  };
  if (reasoningEffort && EFFORTS.has(reasoningEffort)) {
    payload.reasoning_effort = reasoningEffort;
  }

  return callApi(`${BASE_URL}/openai/v1/chat/completions`, key, sessionId, {
    method: 'POST',
    accept: 'text/event-stream',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export { upstreamError };
