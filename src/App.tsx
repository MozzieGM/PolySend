import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { BriefingPanel } from './components/BriefingPanel';
import { EmailCanvas } from './components/EmailCanvas';
import { ModelsPanel } from './components/ModelsPanel';
import { UsageBar } from './components/UsageBar';
import { MobileTabs, type MobileTab } from './components/MobileTabs';
import { DeliveryModal } from './components/DeliveryModal';
import { KeyModal } from './components/KeyModal';
import { WhatsAppStudio } from './components/whatsapp/WhatsAppStudio';
import { Toast, type ToastData, type ToastTone } from './components/Toast';
import {
  ApiError,
  fetchHealth,
  fetchModels,
  fetchUsage,
  generateSessionId,
  streamEmail,
} from './lib/api';
import { slugify, truncate } from './lib/format';
import { pickReasoningEffort } from './lib/models';
import { getDefaultBriefing, type Preset } from './lib/presets';
import { errorMessage, streamErrorMessage } from './lib/errors';
import { useI18n } from './lib/i18n';
import type {
  Briefing,
  ConnectionState,
  Draft,
  GoUsage,
  Health,
  KeySource,
  Model,
  ModelsResponse,
  Plan,
  SessionStats,
  StreamMode,
  StreamUsage,
  Workspace,
} from './types';

const KEY_STORAGE = 'oc_live_api_key';
const RESEND_KEY_STORAGE = 'polysend_resend_key';
const MODEL_STORAGE = 'oc_live_model';
const PLAN_STORAGE = 'oc_live_plan';
const WORKSPACE_STORAGE = 'polysend_workspace';

const EMPTY_DRAFT: Draft = {
  to: '',
  subject: '',
  body: '',
  status: 'empty',
  mode: 'preview',
  error: null,
  phase: 'idle',
};

const EMPTY_STATS: SessionStats = {
  runs: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cacheRead: 0,
  listCost: 0,
  allowance: 0,
  lastTtftMs: null,
  lastTps: null,
  lastElapsedMs: null,
  lastModel: null,
};

type StreamJob =
  | { mode: 'generate' }
  | { mode: 'refine'; instruction: string }
  | { mode: 'selection'; instruction: string; start: number; end: number; selectedText: string };

function readStorage(storage: 'local' | 'session', key: string): string {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(storage: 'local' | 'session', key: string, value: string) {
  try {
    const target = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value) target.setItem(key, value);
    else target.removeItem(key);
  } catch {
    /* noop */
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default function App() {
  const { locale, t } = useI18n();
  const isWide = useMediaQuery('(min-width: 1360px)');
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [storedKey, setStoredKey] = useState(() => readStorage('session', KEY_STORAGE));
  const [resendKey, setResendKey] = useState(() =>
    readStorage('session', RESEND_KEY_STORAGE),
  );
  const [health, setHealth] = useState<Health | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsSource, setModelsSource] = useState<KeySource>('none');
  const [modelsFetchedAt, setModelsFetchedAt] = useState<string | null>(null);
  const [usage, setUsage] = useState<GoUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(() => readStorage('local', MODEL_STORAGE) || 'glm-5.3-flash');
  const [plan, setPlan] = useState<Plan>(() => {
    const stored = readStorage('local', PLAN_STORAGE);
    return stored === 'go-plus' || stored === 'go-teams' ? stored : 'go';
  });
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const requested = new URLSearchParams(window.location.search).get('workspace');
    if (requested === 'whatsapp' || requested === 'email') return requested;
    return readStorage('local', WORKSPACE_STORAGE) === 'whatsapp' ? 'whatsapp' : 'email';
  });
  const [briefing, setBriefing] = useState<Briefing>(() => getDefaultBriefing(locale));
  const [briefingDirty, setBriefingDirty] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<'send' | 'settings'>('settings');
  const [modelsDrawerOpen, setModelsDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('briefing');
  const [toast, setToast] = useState<ToastData | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const discardRef = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const usageRefreshTimer = useRef<number | null>(null);
  const sessionIdRef = useRef(generateSessionId());

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId) ?? null,
    [models, selectedId],
  );

  const hasKey =
    Boolean(storedKey) || Boolean(health?.serverKeyConfigured) || modelsSource !== 'none';
  const keySource: KeySource =
    modelsSource !== 'none'
      ? modelsSource
      : health?.serverKeyConfigured
        ? 'server'
        : storedKey
          ? 'client'
          : 'none';
  const monthlyPercent = usage?.available ? usage.monthly?.percent ?? null : null;
  const isStreaming = draft.status === 'streaming';

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const applyCatalog = useCallback((data: ModelsResponse) => {
    setModels(data.models);
    setModelsFetchedAt(data.fetchedAt);
    setModelsSource(data.source);
    setModelsError(null);
    setModelsLoading(false);
    setConnection('ready');
    setSelectedId((previous) => {
      if (data.models.some((model) => model.id === previous)) return previous;
      const fallback =
        data.models.find((model) => model.id === 'glm-5.3-flash') ??
        data.models.find((model) => model.go.featured && !model.free) ??
        data.models[0];
      return fallback?.id ?? previous;
    });
  }, []);

  const loadModels = useCallback(
    async (key?: string) => {
      setModelsLoading(true);
      try {
        const data = await fetchModels(key);
        applyCatalog(data);
        return data;
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        setModelsError(errorMessage(error, t));
        if (apiError?.status === 401) {
          setConnection(key || health?.serverKeyConfigured ? 'error' : 'nokey');
        } else {
          setConnection('error');
        }
        throw error;
      } finally {
        setModelsLoading(false);
      }
    },
    [applyCatalog, health?.serverKeyConfigured, t],
  );

  const loadUsage = useCallback(
    async (key?: string) => {
      setUsageLoading(true);
      setUsageError(null);
      try {
        const data = await fetchUsage(key);
        setUsage(data);
        if (!data.available) setUsageError(t('usage.unavailable'));
      } catch (error) {
        setUsageError(errorMessage(error, t));
      } finally {
        setUsageLoading(false);
      }
    },
    [t],
  );

  const scheduleUsageRefresh = useCallback(() => {
    if (usageRefreshTimer.current) window.clearTimeout(usageRefreshTimer.current);
    usageRefreshTimer.current = window.setTimeout(() => {
      void loadUsage(storedKey || undefined);
    }, 1800);
  }, [loadUsage, storedKey]);

  const finalizeStats = useCallback(
    (
      usagePayload: StreamUsage | null,
      startedAt: number,
      firstTokenAt: number | null,
      elapsedMs: number,
      modelName: string | null,
    ) => {
      const inputTokens =
        usagePayload?.opencode?.tokens?.input ?? usagePayload?.prompt_tokens ?? 0;
      const outputTokens =
        usagePayload?.opencode?.tokens?.output ?? usagePayload?.completion_tokens ?? 0;
      const reasoningTokens = usagePayload?.opencode?.tokens?.reasoning ?? 0;
      const cacheRead = usagePayload?.opencode?.tokens?.cache_read ?? 0;
      const listCost = usagePayload?.opencode?.list_cost ?? usagePayload?.cost ?? 0;
      const allowance = usagePayload?.opencode?.allowance ?? 0;
      const ttft = firstTokenAt ? firstTokenAt - startedAt : null;
      const generationSeconds =
        firstTokenAt != null ? Math.max(0.2, (performance.now() - firstTokenAt) / 1000) : 0;
      const tps = generationSeconds > 0 && outputTokens > 0 ? outputTokens / generationSeconds : null;

      setStats((previous) => ({
        runs: previous.runs + 1,
        inputTokens: previous.inputTokens + inputTokens,
        outputTokens: previous.outputTokens + outputTokens,
        reasoningTokens: previous.reasoningTokens + reasoningTokens,
        cacheRead: previous.cacheRead + cacheRead,
        listCost: previous.listCost + listCost,
        allowance: previous.allowance + allowance,
        lastTtftMs: ttft ?? previous.lastTtftMs,
        lastTps: tps ?? previous.lastTps,
        lastElapsedMs: elapsedMs,
        lastModel: modelName ?? previous.lastModel,
      }));
    },
    [],
  );

  const runStream = useCallback(
    async (job: StreamJob) => {
      if (busyRef.current) return;

      discardRef.current = false;

      if (!hasKey) {
        setKeyModalOpen(true);
        showToast(t('toast.connectToGenerate'), 'error');
        return;
      }
      if (!selectedModel) {
        if (isMobile) setMobileTab('models');
        else if (!isWide) setModelsDrawerOpen(true);
        showToast(t('toast.chooseModel'), 'error');
        return;
      }
      if (job.mode === 'generate' && !briefing.topic.trim()) {
        showToast(t('toast.describeGoal'), 'error');
        return;
      }
      if (job.mode !== 'generate' && !draft.body.trim()) return;

      if (isMobile && job.mode === 'generate') setMobileTab('email');

      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      const startedAt = performance.now();
      let firstTokenAt: number | null = null;
      let finalUsage: StreamUsage | null = null;
      let streamError: string | null = null;
      let truncated = false;
      let accumulated = '';
      let subject = '';
      let applied = false;

      const original = draft;
      const before = job.mode === 'selection' ? original.body.slice(0, job.start) : '';
      const after = job.mode === 'selection' ? original.body.slice(job.end) : '';
      const fallbackSubject = truncate(briefing.topic, 78);

      setDraft((previous) => ({
        ...previous,
        to:
          job.mode === 'generate'
            ? briefing.recipient.trim() || briefing.company.trim()
            : previous.to,
        subject: job.mode === 'generate' ? '' : previous.subject,
        body: job.mode === 'generate' ? '' : previous.body,
        status: 'streaming',
        mode: 'preview',
        phase: 'connecting',
        error: null,
      }));

      try {
        await streamEmail({
          key: storedKey || undefined,
          sessionId: sessionIdRef.current,
          payload: {
            model: selectedModel.id,
            mode: job.mode as StreamMode,
            briefing,
            body: job.mode === 'generate' ? undefined : original.body,
            selection: job.mode === 'selection' ? job.selectedText : undefined,
            instruction: job.mode === 'generate' ? undefined : job.instruction,
            reasoningEffort: pickReasoningEffort(selectedModel),
          },
          signal: controller.signal,
          handlers: {
            onStatus: (phase) => {
              if (discardRef.current) return;
              setDraft((previous) =>
                previous.status === 'streaming' ? { ...previous, phase } : previous,
              );
            },
            onSubject: (value) => {
              if (!value || discardRef.current) return;
              subject = value;
              setDraft((previous) => ({ ...previous, subject: previous.subject || value }));
            },
            onDelta: (text) => {
              if (!text || discardRef.current) return;
              if (firstTokenAt === null) firstTokenAt = performance.now();
              accumulated += text;
              applied = true;
              setDraft((previous) => ({
                ...previous,
                body:
                  job.mode === 'selection'
                    ? before + accumulated + after
                    : accumulated,
                phase: 'writing',
              }));
            },
            onUsage: (value) => {
              finalUsage = value;
            },
            onDone: (done) => {
              if (done.truncated) truncated = true;
            },
            onError: (error) => {
              streamError = streamErrorMessage(error.code, t);
            },
          },
        });

        if (discardRef.current) return;

        const elapsedMs = performance.now() - startedAt;
        const cleanBody = accumulated.replace(/^\s*\n+/, '').trim();
        const cleanReplacement = accumulated.trim();

        if (job.mode === 'selection') {
          const replaced = cleanReplacement
            ? before + cleanReplacement + after
            : original.body;
          setDraft((previous) => ({
            ...previous,
            body: replaced,
            status: streamError ? 'error' : 'ready',
            mode: 'edit',
            phase: 'idle',
            error: streamError,
          }));
        } else if (job.mode === 'refine') {
          setDraft((previous) => ({
            ...previous,
            body: cleanBody || original.body,
            status: streamError ? 'error' : 'ready',
            mode: 'preview',
            phase: 'idle',
            error: streamError,
          }));
        } else {
          setDraft((previous) => ({
            ...previous,
            subject:
              previous.subject ||
              (cleanBody ? subject || fallbackSubject : ''),
            body: cleanBody,
            status: streamError || !cleanBody ? 'error' : 'ready',
            mode: 'preview',
            phase: 'idle',
            error:
              streamError ??
              (!cleanBody ? t('errors.empty_response') : null),
          }));
        }

        if (finalUsage || applied) {
          finalizeStats(
            finalUsage,
            startedAt,
            firstTokenAt,
            elapsedMs,
            selectedModel.name,
          );
        }
        if (streamError) {
          showToast(streamError, 'error');
        } else if (truncated) {
          showToast(t('toast.truncated'), 'info');
        }
        scheduleUsageRefresh();
      } catch (error) {
        if (discardRef.current) return;

        const aborted = (error as { name?: string })?.name === 'AbortError';
        const elapsedMs = performance.now() - startedAt;

        if (aborted) {
          const cleanBody = accumulated.replace(/^\s*\n+/, '').trim();
          if (job.mode === 'selection') {
            setDraft((previous) => ({
              ...previous,
              body: cleanBody ? before + cleanBody + after : original.body,
              status: 'ready',
              mode: 'edit',
              phase: 'idle',
              error: null,
            }));
          } else if (job.mode === 'refine') {
            setDraft((previous) => ({
              ...previous,
              body: cleanBody || original.body,
              status: 'ready',
              phase: 'idle',
              error: null,
            }));
          } else {
            setDraft((previous) => ({
              ...previous,
              subject: previous.subject || (cleanBody ? fallbackSubject : ''),
              body: cleanBody,
              status: cleanBody ? 'ready' : 'empty',
              phase: 'idle',
              error: null,
            }));
          }
          if (finalUsage || applied) {
            finalizeStats(finalUsage, startedAt, firstTokenAt, elapsedMs, selectedModel.name);
          }
          showToast(t('toast.stopped'), 'info');
        } else {
          const message = errorMessage(error, t);
          const cleanBody = accumulated.replace(/^\s*\n+/, '').trim();
          if (job.mode === 'selection') {
            setDraft((previous) => ({
              ...previous,
              body: cleanBody ? before + cleanBody + after : original.body,
              status: 'error',
              mode: 'edit',
              phase: 'idle',
              error: message,
            }));
          } else if (job.mode === 'refine') {
            setDraft((previous) => ({
              ...previous,
              body: cleanBody || original.body,
              status: 'error',
              phase: 'idle',
              error: message,
            }));
          } else {
            setDraft((previous) => ({
              ...previous,
              subject: previous.subject || (cleanBody ? fallbackSubject : ''),
              body: cleanBody,
              status: 'error',
              phase: 'idle',
              error: message,
            }));
          }
          if (finalUsage || applied) {
            finalizeStats(finalUsage, startedAt, firstTokenAt, elapsedMs, selectedModel.name);
          }
          showToast(message, 'error');
          if (error instanceof ApiError && error.status === 401) {
            setKeyModalOpen(true);
          }
          scheduleUsageRefresh();
        }
      } finally {
        busyRef.current = false;
        abortRef.current = null;
      }
    },
    [
      briefing,
      draft,
      finalizeStats,
      hasKey,
      isMobile,
      isWide,
      scheduleUsageRefresh,
      selectedModel,
      showToast,
      storedKey,
      t,
    ],
  );

  const runStreamRef = useRef(runStream);
  runStreamRef.current = runStream;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let healthResult: Health | null = null;
      try {
        healthResult = await fetchHealth();
        if (!cancelled) setHealth(healthResult);
      } catch {
        if (!cancelled) {
          setHealth({
            ok: false,
            serverKeyConfigured: false,
            apiBase: 'https://opencode.ai/inference/go',
            fetchedAt: new Date().toISOString(),
          });
        }
      }

      if (cancelled) return;
      const key = storedKey || undefined;

      try {
        const data = await fetchModels(key);
        if (cancelled) return;
        applyCatalog(data);
        void loadUsage(key);
      } catch (error) {
        if (cancelled) return;
        const apiError = error instanceof ApiError ? error : null;
        setModelsError(errorMessage(error, t));
        setModelsLoading(false);
        setConnection(
          apiError?.status === 401 && !key && !healthResult?.serverKeyConfigured
            ? 'nokey'
            : 'error',
        );
        if (apiError?.status === 401) setKeyModalOpen(true);
        void loadUsage(key);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Boot once. User actions refresh the catalog explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasKey) return;
    const interval = window.setInterval(() => {
      void loadUsage(storedKey || undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [hasKey, loadUsage, storedKey]);

  const previousLocale = useRef(locale);
  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    if (!briefingDirty && !draft.body) {
      setBriefing(getDefaultBriefing(locale));
    }
  }, [briefingDirty, draft.body, locale]);

  useEffect(() => {
    writeStorage('local', MODEL_STORAGE, selectedId);
  }, [selectedId]);

  useEffect(() => {
    writeStorage('local', PLAN_STORAGE, plan);
  }, [plan]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!busyRef.current) void runStreamRef.current({ mode: 'generate' });
      }
      if (event.key === 'Escape') setModelsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (usageRefreshTimer.current) window.clearTimeout(usageRefreshTimer.current);
    },
    [],
  );

  const handleBriefingChange = (patch: Partial<Briefing>) => {
    setBriefingDirty(true);
    setBriefing((previous) => ({ ...previous, ...patch }));
  };

  const handleApplyPreset = (preset: Preset) => {
    setBriefingDirty(false);
    setBriefing(preset.briefing);
    showToast(t('briefing.presetLoaded', { label: preset.label }), 'info');
  };

  const handleDraftChange = (patch: Partial<Pick<Draft, 'to' | 'subject' | 'body' | 'mode'>>) => {
    setDraft((previous) => ({
      ...previous,
      ...patch,
      ...(patch.body !== undefined && previous.status === 'error' && !isStreaming
        ? { status: 'ready' as const, error: null }
        : {}),
    }));
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleCopy = () => {
    if (!draft.body) return;
    const content = `${t('email.subject')}: ${draft.subject}\n${t('email.to')}: ${draft.to}\n\n${draft.body}`;
    navigator.clipboard
      .writeText(content)
      .then(() => showToast(t('toast.copied'), 'success'))
      .catch(() => showToast(t('toast.copyFailed'), 'error'));
  };

  const handleDownload = () => {
    if (!draft.body) return;
    const content = `${t('email.subject')}: ${draft.subject}\n${t('email.to')}: ${draft.to}\n\n${draft.body}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const fallback = t('email.draftFilename');
    anchor.href = url;
    anchor.download = `email-${slugify(draft.to || briefing.company || fallback) || fallback}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(t('toast.downloadStarted'), 'success');
  };

  const handleNewDraft = () => {
    discardRef.current = true;
    if (isStreaming) abortRef.current?.abort();
    setDraft(EMPTY_DRAFT);
    showToast(t('toast.newDraft'), 'info');
  };

  const handleConnectKey = async (key: string) => {
    try {
      const data = await fetchModels(key);
      setStoredKey(key);
      writeStorage('session', KEY_STORAGE, key);
      applyCatalog(data);
      void loadUsage(key);
      return { ok: true, count: data.models.length };
    } catch (error) {
      return { ok: false, error: errorMessage(error, t) };
    }
  };

  const handleUseServerKey = async () => {
    try {
      const data = await fetchModels();
      setStoredKey('');
      writeStorage('session', KEY_STORAGE, '');
      applyCatalog(data);
      void loadUsage();
      return { ok: true, count: data.models.length };
    } catch (error) {
      return { ok: false, error: errorMessage(error, t) };
    }
  };

  const handleDisconnect = () => {
    setStoredKey('');
    writeStorage('session', KEY_STORAGE, '');
    setKeyModalOpen(false);

    if (health?.serverKeyConfigured) {
      void loadModels()
        .then(() => {
          void loadUsage();
          showToast(t('toast.panelKeyRemovedServer'), 'info');
        })
        .catch((error) => showToast(errorMessage(error, t), 'error'));
    } else {
      setModels([]);
      setModelsFetchedAt(null);
      setModelsSource('none');
      setModelsError(null);
      setConnection('nokey');
      setUsage(null);
      setUsageError(null);
      showToast(t('toast.panelKeyRemoved'), 'info');
    }
  };

  const handleRefreshCatalog = async () => {
    try {
      await loadModels(storedKey || undefined);
      void loadUsage(storedKey || undefined);
    } catch (error) {
      showToast(errorMessage(error, t), 'error');
    }
  };

  const handleOpenDelivery = () => {
    setDeliveryTab('settings');
    setDeliveryOpen(true);
  };

  const handleOpenSend = () => {
    setDeliveryTab('send');
    setDeliveryOpen(true);
  };

  const handleResendKeyChange = (key: string) => {
    setResendKey(key);
    writeStorage('session', RESEND_KEY_STORAGE, key);
  };

  const handleResendKeySaved = () => {
    setHealth((previous) =>
      previous ? { ...previous, resendKeyConfigured: true } : previous,
    );
  };

  const handleSelectModel = (id: string) => {
    setSelectedId(id);
    if (isMobile) {
      setMobileTab('email');
      return;
    }
    if (!isWide) setModelsDrawerOpen(false);
  };

  const handleOpenModels = () => {
    if (isMobile) {
      setMobileTab('models');
      return;
    }
    if (!isWide) {
      setModelsDrawerOpen(true);
      return;
    }
    document.getElementById('model-search')?.focus();
  };

  const handlePlanChange = (nextPlan: Plan) => {
    setPlan(nextPlan);
  };

  const handleWorkspaceChange = (next: Workspace) => {
    setWorkspace(next);
    writeStorage('local', WORKSPACE_STORAGE, next);
    setModelsDrawerOpen(false);
    setDeliveryOpen(false);
  };

  const handleWorkspaceModelChange = (id: string) => {
    setSelectedId(id);
    writeStorage('local', MODEL_STORAGE, id);
  };

  const selectedName = selectedModel?.name ?? null;
  const canGenerate = Boolean(selectedModel) && Boolean(briefing.topic.trim()) && !isStreaming;

  return (
    <div className="app-shell">
      <Header
        connection={connection}
        keySource={keySource}
        modelCount={models.length}
        monthlyPercent={monthlyPercent}
        plan={plan}
        workspace={workspace}
        onWorkspaceChange={handleWorkspaceChange}
        onOpenKey={() => setKeyModalOpen(true)}
        onOpenModels={handleOpenModels}
        onOpenDelivery={handleOpenDelivery}
        deliveryConfigured={Boolean(resendKey) || Boolean(health?.resendKeyConfigured)}
      />

      {workspace === 'whatsapp' ? (
        <WhatsAppStudio
          storedKey={storedKey}
          hasKey={hasKey}
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleWorkspaceModelChange}
          onOpenKey={() => setKeyModalOpen(true)}
        />
      ) : (
        <>

      <main className={`layout ${isMobile ? 'is-mobile' : ''}`}>
        <div
          className={`area-briefing ${isMobile && mobileTab === 'briefing' ? 'is-active' : ''}`}
        >
          <BriefingPanel
            briefing={briefing}
            modelName={selectedName}
            isStreaming={isStreaming}
            canGenerate={canGenerate}
            onChange={handleBriefingChange}
            onApplyPreset={handleApplyPreset}
            onGenerate={() => void runStream({ mode: 'generate' })}
            onStop={handleStop}
          />
        </div>

        <div
          className={`area-email ${isMobile && mobileTab === 'email' ? 'is-active' : ''}`}
        >
          <EmailCanvas
            draft={draft}
            model={selectedModel}
            briefing={briefing}
            stats={stats}
            isStreaming={isStreaming}
            onDraftChange={handleDraftChange}
            onGenerate={() => void runStream({ mode: 'generate' })}
            onRefine={(instruction) => void runStream({ mode: 'refine', instruction })}
            onRewriteSelection={(payload) =>
              void runStream({
                mode: 'selection',
                instruction: payload.instruction,
                start: payload.start,
                end: payload.end,
                selectedText: payload.text,
              })
            }
            onCopy={handleCopy}
            onDownload={handleDownload}
            onNew={handleNewDraft}
            onOpenModels={handleOpenModels}
            onSend={handleOpenSend}
          />
          <UsageBar
            usage={usage}
            usageLoading={usageLoading}
            usageError={usageError}
            stats={stats}
            plan={plan}
            model={selectedModel}
            hasKey={hasKey}
            onRefresh={() => void loadUsage(storedKey || undefined)}
            onOpenKey={() => setKeyModalOpen(true)}
          />
        </div>

        <div
          className={`area-models ${modelsDrawerOpen ? 'is-open' : ''} ${
            isMobile && mobileTab === 'models' ? 'is-active' : ''
          }`}
        >
          <ModelsPanel
            models={models}
            selectedId={selectedId}
            plan={plan}
            loading={modelsLoading}
            error={modelsError}
            fetchedAt={modelsFetchedAt}
            source={modelsSource}
            hasKey={hasKey}
            isDrawer={!isWide && !isMobile}
            onSelect={handleSelectModel}
            onPlanChange={handlePlanChange}
            onRefresh={() => void handleRefreshCatalog()}
            onOpenKey={() => setKeyModalOpen(true)}
            onClose={() => setModelsDrawerOpen(false)}
          />
        </div>
      </main>

      {isMobile && (
        <MobileTabs
          active={mobileTab}
          modelCount={models.length}
          onChange={setMobileTab}
        />
      )}

      {!isWide && !isMobile && modelsDrawerOpen && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onClick={() => setModelsDrawerOpen(false)}
        />
      )}
        </>
      )}

      <KeyModal
        open={keyModalOpen}
        serverKeyConfigured={Boolean(health?.serverKeyConfigured)}
        userKeyActive={Boolean(storedKey)}
        onClose={() => setKeyModalOpen(false)}
        onConnect={handleConnectKey}
        onUseServer={handleUseServerKey}
        onDisconnect={handleDisconnect}
      />

      <DeliveryModal
        open={deliveryOpen}
        initialTab={deliveryTab}
        draft={draft}
        briefing={briefing}
        resendKey={resendKey}
        serverKeyConfigured={Boolean(health?.resendKeyConfigured)}
        onClose={() => setDeliveryOpen(false)}
        onKeyChange={handleResendKeyChange}
        onKeySaved={handleResendKeySaved}
      />

      <Toast toast={toast} />
    </div>
  );
}
