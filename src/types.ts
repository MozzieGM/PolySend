export type Plan = 'go' | 'go-plus' | 'go-teams';
export type Tone = 'profissional' | 'direto' | 'amigavel' | 'persuasivo' | 'empatico' | 'formal';
export type EmailLength = 'curto' | 'medio' | 'longo';
export type Language = 'pt-BR' | 'en' | 'es';
export type StreamMode = 'generate' | 'refine' | 'selection';
export type Phase = 'idle' | 'connecting' | 'thinking' | 'writing';
export type DraftStatus = 'empty' | 'streaming' | 'ready' | 'error';
export type ConnectionState = 'loading' | 'ready' | 'error' | 'nokey';
export type KeySource = 'server' | 'client' | 'none';

export interface GoLimit {
  go: number | null;
  goPlus: number | null;
  goTeams: number | null;
}

export interface Model {
  id: string;
  name: string;
  description: string | null;
  context: number | null;
  maxOutput: number | null;
  price: { input: number; output: number; cacheRead: number | null };
  free: boolean;
  go: {
    monthlyUsage: GoLimit | null;
    zdr: boolean;
    training: boolean;
    featured: boolean;
    limitedRegions: boolean;
  };
  reasoning: { supported: boolean; efforts: string[] };
  nativeApi: string | null;
  releaseDate: string | null;
}

export interface ModelsResponse {
  models: Model[];
  fetchedAt: string;
  source: 'server' | 'client';
}

export interface UsageWindow {
  status: string;
  percent: number | null;
  resetsAt: string | null;
}

export interface GoUsage {
  available: boolean;
  rolling: UsageWindow | null;
  weekly: UsageWindow | null;
  monthly: UsageWindow | null;
  fetchedAt: string;
  message?: string;
}

export interface Health {
  ok: boolean;
  serverKeyConfigured: boolean;
  apiBase: string;
  fetchedAt: string;
}

export interface Briefing {
  recipient: string;
  company: string;
  topic: string;
  details: string;
  signature: string;
  tone: Tone;
  length: EmailLength;
  language: Language;
}

export interface StreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  opencode?: {
    billing_source?: string;
    list_cost?: number;
    allowance?: number;
    estimated?: boolean;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache_read?: number;
      cache_write_5m?: number;
      cache_write_1h?: number;
    };
  };
}

export interface SessionStats {
  runs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  listCost: number;
  allowance: number;
  lastTtftMs: number | null;
  lastTps: number | null;
  lastElapsedMs: number | null;
  lastModel: string | null;
}

export interface Draft {
  to: string;
  subject: string;
  body: string;
  status: DraftStatus;
  mode: 'preview' | 'edit';
  error: string | null;
  phase: Phase;
}

export interface StreamHandlers {
  onStatus?: (phase: Phase) => void;
  onSubject?: (subject: string) => void;
  onDelta?: (text: string) => void;
  onUsage?: (usage: StreamUsage) => void;
  onDone?: (payload: { elapsedMs?: number; model?: string; truncated?: boolean }) => void;
  onError?: (error: { code: string; message: string }) => void;
}
