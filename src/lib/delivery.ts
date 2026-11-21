import {
  generateSessionId,
  parseApiError,
} from './api';
import type {
  DeliveryHistoryItem,
  DeliverySendPayload,
  DeliveryStatus,
} from '../types';

function resendHeaders(key?: string, sessionId?: string): HeadersInit {
  return {
    ...(key ? { 'x-resend-key': key } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
  };
}

export async function fetchDeliveryStatus(key?: string): Promise<DeliveryStatus> {
  const response = await fetch('/api/delivery/status', {
    headers: resendHeaders(key, generateSessionId()),
  });
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}

export async function verifyDeliveryDomain(key: string | undefined, id: string): Promise<void> {
  const response = await fetch(`/api/delivery/domains/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...resendHeaders(key, generateSessionId()),
    },
  });
  if (!response.ok) throw await parseApiError(response);
}

export async function fetchDeliveryHistory(): Promise<DeliveryHistoryItem[]> {
  const response = await fetch('/api/delivery/history', {
    headers: resendHeaders(undefined, generateSessionId()),
  });
  if (!response.ok) throw await parseApiError(response);
  const body = (await response.json()) as { items?: DeliveryHistoryItem[] };
  return body.items ?? [];
}

export async function refreshDeliveryItem(
  key: string | undefined,
  id: string,
): Promise<DeliveryHistoryItem> {
  const response = await fetch(`/api/delivery/history/${encodeURIComponent(id)}`, {
    headers: resendHeaders(key, generateSessionId()),
  });
  if (!response.ok) throw await parseApiError(response);
  const body = (await response.json()) as { item: DeliveryHistoryItem };
  return body.item;
}

export async function sendDeliveryEmail(options: {
  key?: string;
  payload: DeliverySendPayload;
}): Promise<DeliveryHistoryItem> {
  const response = await fetch('/api/delivery/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...resendHeaders(options.key, generateSessionId()),
    },
    body: JSON.stringify(options.payload),
  });
  if (!response.ok) throw await parseApiError(response);
  const body = (await response.json()) as { item: DeliveryHistoryItem };
  return body.item;
}

export function extractEmail(value: string): string | null {
  if (!value) return null;
  const angle = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle) return angle[1];
  const direct = value.match(/[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/);
  return direct ? direct[0] : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
