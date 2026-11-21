const DEFAULT_BASE_URL = 'https://api.resend.com';
const USER_AGENT = 'polysend-studio/1.0';
const REQUEST_TIMEOUT_MS = 20_000;

export class ResendError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ResendError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function resendServerKeyConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function resolveResendKey(req) {
  return req.get('x-resend-key')?.trim() || process.env.RESEND_API_KEY?.trim() || null;
}

function baseUrl() {
  return (process.env.RESEND_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function resendRequest(key, method, path, body, extraHeaders = {}) {
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    ...extraHeaders,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ResendError(
        504,
        'resend_timeout',
        'Resend took too long to respond.',
        error?.message ?? null,
      );
    }
    throw new ResendError(
      502,
      'resend_network',
      'Could not reach Resend.',
      error?.message ?? null,
    );
  }

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code =
      payload?.name ??
      payload?.code ??
      payload?.error?.type ??
      payload?.error?.code ??
      'resend_error';
    const message =
      payload?.message ??
      payload?.error?.message ??
      (raw ? raw.slice(0, 300) : 'Resend rejected the request.');
    throw new ResendError(response.status, code, message, payload ?? raw.slice(0, 500));
  }

  return payload;
}

function normalizeDomain(domain) {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status ?? 'unknown',
    region: domain.region ?? null,
    createdAt: domain.created_at ?? null,
    openTracking: Boolean(domain.open_tracking),
    clickTracking: Boolean(domain.click_tracking),
    capabilities: domain.capabilities ?? null,
  };
}

function normalizeDomains(payload) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list.map(normalizeDomain);
}

function isSendOnlyKeyError(error) {
  if (!(error instanceof ResendError)) return false;
  if (error.status !== 401 && error.status !== 403) return false;
  return (
    error.code === 'restricted_api_key' &&
    /restricted to only send emails/i.test(error.message)
  );
}

function isInvalidKeyError(error) {
  if (!(error instanceof ResendError)) return false;
  if (error.status !== 400 && error.status !== 401 && error.status !== 403) return false;
  return /api key is invalid|api key is not active|api key is suspended|invalid api key/i.test(
    error.message,
  );
}

export async function validateKey(key) {
  try {
    const payload = await resendRequest(key, 'GET', '/domains');
    return {
      valid: true,
      restricted: false,
      domains: normalizeDomains(payload),
    };
  } catch (error) {
    if (isSendOnlyKeyError(error)) {
      return { valid: true, restricted: true, domains: [] };
    }
    if (isInvalidKeyError(error)) {
      throw new ResendError(401, 'invalid_api_key', error.message, error.details);
    }
    throw error;
  }
}

export async function verifyDomain(key, domainId) {
  return resendRequest(
    key,
    'POST',
    `/domains/${encodeURIComponent(domainId)}/verify`,
    {},
  );
}

export async function sendEmail(
  key,
  { from, to, subject, text, html, replyTo, idempotencyKey },
) {
  const payload = {
    from,
    to: [to],
    subject,
    text,
    html,
    tags: [{ name: 'app', value: 'polysend' }],
  };
  if (replyTo) payload.reply_to = replyTo;

  const result = await resendRequest(key, 'POST', '/emails', payload, {
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  });

  if (!result?.id) {
    throw new ResendError(502, 'resend_invalid_response', 'Resend did not return an email ID.');
  }
  return { id: result.id };
}

export async function getEmail(key, emailId) {
  const payload = await resendRequest(
    key,
    'GET',
    `/emails/${encodeURIComponent(emailId)}`,
  );
  return {
    id: payload?.id ?? emailId,
    lastEvent: payload?.last_event ?? null,
    to: payload?.to ?? [],
    from: payload?.from ?? null,
    subject: payload?.subject ?? null,
    createdAt: payload?.created_at ?? null,
  };
}
