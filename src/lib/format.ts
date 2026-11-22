import type { Locale } from '../types';

export function formatUSD(value: number | null | undefined, digits = 2): string {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatCost(value: number | null | undefined): string {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (number === 0) return '$0.00';
  if (number < 0.000001) return '<$0.000001';
  return formatUSD(number, 6);
}

export function formatTokens(value: number | null | undefined): string {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (number >= 1_000_000) {
    const millions = number / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(millions % 1 === 0 ? 0 : 1)}M`;
  }
  if (number >= 1000) {
    const thousands = number / 1000;
    return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(thousands % 1 === 0 ? 0 : 1)}k`;
  }
  return `${Math.round(number)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value === 0) return '0%';
  if (value < 0.1) return '<0.1%';
  if (value < 10 && !Number.isInteger(value)) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatRate(tps: number | null | undefined): string {
  if (typeof tps !== 'number' || !Number.isFinite(tps) || tps <= 0) return '—';
  return `${Math.round(tps)} tok/s`;
}

export function formatReset(
  resetsAt: string | null | undefined,
  locale: Locale = 'en',
): string {
  if (!resetsAt) return '—';
  const time = new Date(resetsAt).getTime();
  if (!Number.isFinite(time)) return '—';
  const diff = time - Date.now();
  const prefix = locale === 'pt-BR' ? 'em ' : 'in ';
  if (diff <= 0) return locale === 'pt-BR' ? 'agora' : 'now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${prefix}${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0 ? `${prefix}${hours}h ${rest}min` : `${prefix}${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${prefix}${days}d ${restHours}h` : `${prefix}${days}d`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatRelative(
  iso: string | null | undefined,
  locale: Locale = 'en',
): string {
  if (!iso) return locale === 'pt-BR' ? 'agora' : 'just now';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 45_000) {
    return locale === 'pt-BR' ? 'agora' : 'just now';
  }
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return locale === 'pt-BR' ? `há ${minutes} min` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  return locale === 'pt-BR' ? `há ${hours}h` : `${hours}h ago`;
}

export function formatShortTime(timestamp: number, locale: Locale = 'en'): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date);
}

export function formatMessageTime(timestamp: number, locale: Locale = 'en'): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function sameDay(a: number, b: number): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

export function formatDayLabel(timestamp: number, locale: Locale = 'en'): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (sameDay(timestamp, now.getTime())) return locale === 'pt-BR' ? 'Hoje' : 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(timestamp, yesterday.getTime())) {
    return locale === 'pt-BR' ? 'Ontem' : 'Yesterday';
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return '?';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncate(value: string, max: number): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
