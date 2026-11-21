import type {
  GoUsage,
  Health,
  ModelsResponse,
  StreamHandlers,
  StreamMode,
  StreamUsage,
  Briefing,
} from '../types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(status: number, code: string, message: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  let code = 'request_failed';
  let message = 'Não foi possível concluir a requisição.';
  let details: string | undefined;
  try {
    const body = await response.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      if (typeof body.error.details === 'string') details = body.error.details;
    }
  } catch {
    /* keep defaults */
  }
  return new ApiError(response.status, code, message, details);
}

function keyHeaders(key?: string): HeadersInit {
  return key ? { 'x-opencode-key': key } : {};
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health');
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}

export async function fetchModels(key?: string): Promise<ModelsResponse> {
  const response = await fetch('/api/models', { headers: keyHeaders(key) });
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}

export async function fetchUsage(key?: string): Promise<GoUsage> {
  const response = await fetch('/api/usage', { headers: keyHeaders(key) });
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}

export interface StreamPayload {
  model: string;
  mode: StreamMode;
  briefing: Briefing;
  body?: string;
  selection?: string;
  instruction?: string;
  reasoningEffort?: string | null;
}

function dispatch(event: string, payload: unknown, handlers: StreamHandlers) {
  switch (event) {
    case 'status': {
      const phase = (payload as { phase?: string })?.phase;
      if (phase === 'thinking' || phase === 'writing') handlers.onStatus?.(phase);
      break;
    }
    case 'subject':
      handlers.onSubject?.((payload as { subject?: string })?.subject ?? '');
      break;
    case 'delta':
      handlers.onDelta?.((payload as { text?: string })?.text ?? '');
      break;
    case 'usage':
      handlers.onUsage?.(payload as StreamUsage);
      break;
    case 'done':
      handlers.onDone?.(
        payload as { elapsedMs?: number; model?: string; truncated?: boolean },
      );
      break;
    case 'error': {
      const error = payload as { code?: string; message?: string };
      handlers.onError?.({
        code: error?.code ?? 'stream_error',
        message: error?.message ?? 'A geração foi interrompida.',
      });
      break;
    }
    default:
      break;
  }
}

export async function streamEmail(options: {
  key?: string;
  sessionId: string;
  payload: StreamPayload;
  signal?: AbortSignal;
  handlers: StreamHandlers;
}): Promise<void> {
  const { key, sessionId, payload, signal, handlers } = options;
  const response = await fetch('/api/email/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
      ...keyHeaders(key),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw await parseApiError(response);
  if (!response.body) throw new ApiError(502, 'empty_stream', 'O servidor não retornou um stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        let event = 'message';
        const dataLines: string[] = [];
        for (const rawLine of block.split('\n')) {
          const line = rawLine.replace(/\r$/, '');
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) continue;

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(dataLines.join('\n'));
        } catch {
          continue;
        }
        dispatch(event, parsed, handlers);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

export function generateSessionId(): string {
  const existing = sessionStorage.getItem('oc_live_session');
  if (existing) return existing;

  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replaceAll('-', '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const id = `ses_live_${random.slice(0, 24)}`;
  try {
    sessionStorage.setItem('oc_live_session', id);
  } catch {
    /* noop */
  }
  return id;
}
