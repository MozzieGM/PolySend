import { generateSessionId, parseApiError } from './api';
import type {
  Language,
  WhatsAppAIPayload,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppMessageEvent,
  WhatsAppStatus,
  StreamUsage,
} from '../types';

function openCodeHeaders(key?: string): HeadersInit {
  return {
    ...(key ? { 'x-opencode-key': key } : {}),
    'x-session-id': generateSessionId(),
  };
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseApiError(response);
  return response.json() as Promise<T>;
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  return json<WhatsAppStatus>(await fetch('/api/whatsapp/status'));
}

export async function connectWhatsApp(): Promise<WhatsAppStatus> {
  return json<WhatsAppStatus>(
    await fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  );
}

export async function logoutWhatsApp(): Promise<WhatsAppStatus> {
  return json<WhatsAppStatus>(
    await fetch('/api/whatsapp/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  );
}

export async function clearWhatsAppCache(): Promise<{
  status: WhatsAppStatus;
  chats: WhatsAppChat[];
}> {
  return json<{ status: WhatsAppStatus; chats: WhatsAppChat[] }>(
    await fetch('/api/whatsapp/cache/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  );
}

export async function fetchWhatsAppChats(query = ''): Promise<WhatsAppChat[]> {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
  const body = await json<{ chats: WhatsAppChat[] }>(
    await fetch(`/api/whatsapp/chats${suffix}`),
  );
  return body.chats ?? [];
}

export async function fetchWhatsAppMessages(jid: string): Promise<{
  chat: WhatsAppChat | null;
  messages: WhatsAppMessage[];
}> {
  return json<{ chat: WhatsAppChat | null; messages: WhatsAppMessage[] }>(
    await fetch(`/api/whatsapp/chats/${encodeURIComponent(jid)}/messages`),
  );
}

export async function sendWhatsAppMessage(
  jid: string,
  text: string,
): Promise<{ message: WhatsAppMessage; chat: WhatsAppChat | null }> {
  return json<{ message: WhatsAppMessage; chat: WhatsAppChat | null }>(
    await fetch(`/api/whatsapp/chats/${encodeURIComponent(jid)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  );
}

export async function markWhatsAppRead(jid: string): Promise<void> {
  const response = await fetch(`/api/whatsapp/chats/${encodeURIComponent(jid)}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw await parseApiError(response);
}

export function detectMessageLanguage(messages: WhatsAppMessage[]): Language | null {
  const text = messages
    .slice(-14)
    .map((message) => message.text)
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return null;

  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  const pt =
    count(/[ãõçáéíóúâêô]/g) +
    count(
      /\b(oi|olá|ola|você|voce|obrigad[oa]|não|nao|sim|tudo|bem|proposta|reunião|reuniao|amanhã|amanha|consegue|fechado|vou|mando|hoje|ainda|fase|prazo|semana)\b/g,
    ) *
      2;
  const en =
    count(
      /\b(the|you|and|thanks|hello|hi|meeting|tomorrow|proposal|send|just|happy|would|could|please|with|that|this)\b/g,
    ) * 2;
  const es =
    count(/[ñ¿¡]/g) +
    count(
      /\b(hola|gracias|mañana|reunión|reunion|propuesta|puedes|quieres|estimación|estimacion)\b/g,
    ) *
      2;

  const best = Math.max(pt, en, es);
  if (best < 2) return null;
  if (pt === best) return 'pt-BR';
  if (es === best) return 'es';
  return 'en';
}

export interface WhatsAppEventHandlers {
  onStatus?: (status: WhatsAppStatus) => void;
  onChats?: (chats: WhatsAppChat[]) => void;
  onMessage?: (event: WhatsAppMessageEvent) => void;
  onOpen?: () => void;
  onConnectionError?: () => void;
}

export function subscribeWhatsAppEvents(handlers: WhatsAppEventHandlers): () => void {
  const source = new EventSource('/api/whatsapp/events');

  const read = <T,>(event: MessageEvent): T | null => {
    try {
      return JSON.parse(event.data) as T;
    } catch {
      return null;
    }
  };

  const onStatus = (event: MessageEvent) => {
    const status = read<WhatsAppStatus>(event);
    if (status) handlers.onStatus?.(status);
  };
  const onChats = (event: MessageEvent) => {
    const data = read<{ chats: WhatsAppChat[] }>(event);
    if (data?.chats) handlers.onChats?.(data.chats);
  };
  const onMessage = (event: MessageEvent) => {
    const data = read<WhatsAppMessageEvent>(event);
    if (data?.message) handlers.onMessage?.(data);
  };

  source.addEventListener('status', onStatus);
  source.addEventListener('chats', onChats);
  source.addEventListener('message', onMessage);
  source.onopen = () => handlers.onOpen?.();
  source.onerror = () => handlers.onConnectionError?.();

  return () => source.close();
}

export interface WhatsAppStreamHandlers {
  onStatus?: (phase: 'thinking' | 'writing') => void;
  onDelta?: (text: string) => void;
  onUsage?: (usage: StreamUsage) => void;
  onDone?: (payload: { elapsedMs?: number; model?: string; truncated?: boolean }) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export async function streamWhatsAppMessage(
  payload: WhatsAppAIPayload,
  key: string | undefined,
  handlers: WhatsAppStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/whatsapp/ai/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openCodeHeaders(key),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw await parseApiError(response);
  if (!response.body) throw new Error('The AI stream is unavailable.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block: string) => {
    const lines = block.split('\n');
    let event = 'message';
    let raw = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) raw += line.slice(5).trim();
    }
    if (!raw) return;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (event === 'status') {
      const phase = (data as { phase?: string }).phase;
      if (phase === 'thinking' || phase === 'writing') handlers.onStatus?.(phase);
    } else if (event === 'delta') {
      const text = (data as { text?: string }).text;
      if (typeof text === 'string') handlers.onDelta?.(text);
    } else if (event === 'usage') {
      handlers.onUsage?.(data as StreamUsage);
    } else if (event === 'done') {
      handlers.onDone?.(data as { elapsedMs?: number; model?: string; truncated?: boolean });
    } else if (event === 'error') {
      const error = data as { code?: string; message?: string };
      handlers.onError?.({
        code: error.code ?? 'stream_error',
        message: error.message ?? 'The AI stream failed.',
      });
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n\n');
      while (index >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        dispatch(block);
        index = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}
