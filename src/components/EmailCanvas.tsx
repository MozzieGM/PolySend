import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clipboard,
  Cpu,
  Eraser,
  Eye,
  HeartHandshake,
  Highlighter,
  Languages,
  Mail,
  Megaphone,
  Minimize2,
  PenLine,
  RotateCcw,
  Scale,
  Send,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import type { Briefing, Draft, Model, SessionStats } from '../types';
import { useI18n } from '../lib/i18n';
import { formatDuration, formatRate } from '../lib/format';

interface EmailCanvasProps {
  draft: Draft;
  model: Model | null;
  briefing: Briefing;
  stats: SessionStats;
  isStreaming: boolean;
  onDraftChange: (patch: Partial<Pick<Draft, 'to' | 'subject' | 'body' | 'mode'>>) => void;
  onGenerate: () => void;
  onRefine: (instruction: string) => void;
  onRewriteSelection: (payload: {
    start: number;
    end: number;
    text: string;
    instruction: string;
  }) => void;
  onCopy: () => void;
  onDownload: () => void;
  onNew: () => void;
  onOpenModels: () => void;
  onSend: () => void;
}



export function EmailCanvas({
  draft,
  model,
  briefing,
  stats,
  isStreaming,
  onDraftChange,
  onGenerate,
  onRefine,
  onRewriteSelection,
  onCopy,
  onDownload,
  onNew,
  onOpenModels,
  onSend,
}: EmailCanvasProps) {
  const { locale, t } = useI18n();
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null,
  );
  const [selectionInstruction, setSelectionInstruction] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousStatus = useRef(draft.status);

  useEffect(() => {
    const node = scrollRef.current;
    const wasStreaming = previousStatus.current === 'streaming';

    if (node) {
      if (isStreaming) {
        node.scrollTop = node.scrollHeight;
      } else if (wasStreaming && draft.mode === 'preview') {
        node.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    previousStatus.current = draft.status;
  }, [draft.body, draft.mode, draft.status, isStreaming]);

  useEffect(() => {
    if (draft.status === 'streaming') setSelection(null);
  }, [draft.status]);

  useEffect(() => {
    if (draft.mode !== 'edit') setSelection(null);
  }, [draft.mode]);

  const translate =
    briefing.language === 'en'
      ? {
          label: t('refine.translateToPortuguese'),
          instruction: t('refine.translateToPortugueseInstruction'),
        }
      : {
          label: t('refine.translateToEnglish'),
          instruction: t('refine.translateToEnglishInstruction'),
        };

  const refinements = [
    {
      id: 'shorter',
      label: t('refine.shorter'),
      instruction: t('refine.shorterInstruction'),
      Icon: Minimize2,
    },
    {
      id: 'formal',
      label: t('refine.formal'),
      instruction: t('refine.formalInstruction'),
      Icon: Scale,
    },
    {
      id: 'persuasive',
      label: t('refine.persuasive'),
      instruction: t('refine.persuasiveInstruction'),
      Icon: Megaphone,
    },
    {
      id: 'warmer',
      label: t('refine.warmer'),
      instruction: t('refine.warmerInstruction'),
      Icon: HeartHandshake,
    },
    {
      id: 'cta',
      label: t('refine.cta'),
      instruction: t('refine.ctaInstruction'),
      Icon: Target,
    },
    {
      id: 'translate',
      label: translate.label,
      instruction: translate.instruction,
      Icon: Languages,
    },
  ];

  const statusLabel =
    draft.status === 'error'
      ? t('email.status.interrupted')
      : draft.status === 'streaming'
        ? draft.phase === 'connecting'
          ? t('email.status.connecting')
          : draft.phase === 'thinking'
            ? t('email.status.thinking')
            : t('email.status.writing')
        : draft.status === 'ready'
          ? t('email.status.ready')
          : t('email.status.empty');

  const canRefine = Boolean(draft.body) && !isStreaming;
  const showBody = Boolean(draft.body);
  const showControls = showBody || isStreaming;
  const showThinking = isStreaming && !draft.body;
  const showEmpty = !draft.body && !isStreaming && draft.status !== 'error';
  const showErrorState = !draft.body && draft.status === 'error';
  const canUseSelection = Boolean(selection) && draft.mode === 'edit' && !isStreaming;

  const handleSelection = (element: HTMLTextAreaElement) => {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }
    setSelection({ start, end, text: element.value.slice(start, end) });
  };

  const handleRewrite = () => {
    if (!selection) return;
    onRewriteSelection({
      ...selection,
      instruction:
        selectionInstruction.trim() || t('email.selectionDefaultInstruction'),
    });
    setSelection(null);
    setSelectionInstruction('');
  };

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const toggleMode = () => {
    if (isStreaming) return;
    onDraftChange({ mode: draft.mode === 'edit' ? 'preview' : 'edit' });
    if (draft.mode === 'edit') setSelection(null);
  };

  return (
    <section className={`panel email-card ${isStreaming ? 'is-streaming' : ''}`}>
      <div className="email-chrome">
        <div className="email-chrome-left">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="chrome-divider" aria-hidden="true" />
          <span className={`draft-state draft-${draft.status}`}>
            <span className="draft-dot" aria-hidden="true" />
            {statusLabel}
          </span>
        </div>

        <div className="email-chrome-right">
          <button type="button" className="model-chip" onClick={onOpenModels}>
            <Cpu size={13} strokeWidth={2.2} />
            <span>{model?.name ?? t('email.modelChipFallback')}</span>
            <ChevronDown size={12} strokeWidth={2.4} />
          </button>
          <span className="chrome-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn-send-email"
            onClick={onSend}
            disabled={!showBody || isStreaming}
            title={t('email.sendTitle')}
            aria-label={t('email.sendAria')}
          >
            <Send size={13} strokeWidth={2.2} />
            <span>{t('email.send')}</span>
          </button>
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={handleCopy}
            disabled={!showBody}
            title={t('email.copyTitle')}
            aria-label={t('email.copyAria')}
          >
            {copied ? <Check size={15} strokeWidth={2.4} /> : <Clipboard size={15} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={onDownload}
            disabled={!showBody}
            title={t('email.downloadTitle')}
            aria-label={t('email.downloadAria')}
          >
            <ArrowDownToLine size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={onNew}
            disabled={!showBody && !draft.subject}
            title={t('email.newTitle')}
            aria-label={t('email.newAria')}
          >
            <Eraser size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`email-sheet ${draft.status === 'streaming' ? 'paper-live' : ''}`}>
        <div className="email-meta">
          <label className="email-meta-row">
            <span className="email-meta-label">{t('email.to')}</span>
            <input
              type="text"
              value={draft.to}
              onChange={(event) => onDraftChange({ to: event.target.value })}
              placeholder={t('email.toPlaceholder')}
              disabled={isStreaming}
              autoComplete="off"
            />
            <span className="email-meta-time">{t('email.now')}</span>
          </label>
          <label className="email-meta-row email-subject-row">
            <span className="email-meta-label">{t('email.subject')}</span>
            <input
              type="text"
              value={draft.subject}
              onChange={(event) => onDraftChange({ subject: event.target.value })}
              placeholder={
                isStreaming && !draft.subject
                  ? t('email.subjectStreaming')
                  : t('email.subjectPlaceholder')
              }
              disabled={isStreaming}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="email-paper-scroll" ref={scrollRef}>
          {showEmpty && (
            <div className="email-empty">
              <span className="email-empty-icon">
                <Mail size={22} strokeWidth={1.7} />
              </span>
              <h3>{t('email.emptyTitle')}</h3>
              <p>
                {t('email.emptyBefore')}
                <strong>{t('briefing.generate')}</strong>
                {t('email.emptyAfter')}
              </p>
              <div className="email-empty-meta">
                <span>
                  <Zap size={11} strokeWidth={2.4} />
                  {t('email.emptyMetaStreaming')}
                </span>
                <i />
                <span>{t('email.emptyMetaEngine')}</span>
                <i />
                <span>{t('email.emptyMetaEditable')}</span>
              </div>
            </div>
          )}

          {showThinking && (
            <div className="email-thinking">
              <div className="thinking-head">
                <span className="live-dot" aria-hidden="true" />
                {draft.phase === 'connecting'
                  ? t('email.thinkingConnecting')
                  : draft.phase === 'thinking'
                    ? t('email.thinkingModel')
                    : t('email.thinkingPreparing')}
              </div>
              <div className="ghost-lines" aria-hidden="true">
                <span style={{ width: '86%' }} />
                <span style={{ width: '94%' }} />
                <span style={{ width: '72%' }} />
                <span style={{ width: '90%' }} />
                <span style={{ width: '48%' }} />
              </div>
            </div>
          )}

          {showErrorState && (
            <div className="email-error">
              <span className="email-error-icon">
                <AlertTriangle size={20} strokeWidth={1.9} />
              </span>
              <h3>{t('email.errorTitle')}</h3>
              <p>{draft.error ?? t('email.errorFallback')}</p>
              <button type="button" className="btn btn-paper" onClick={onGenerate}>
                <RotateCcw size={14} strokeWidth={2.2} />
                {t('email.retry')}
              </button>
            </div>
          )}

          {showBody &&
            (draft.mode === 'edit' ? (
              <textarea
                ref={textareaRef}
                className="email-editor"
                value={draft.body}
                onChange={(event) => onDraftChange({ body: event.target.value })}
                onSelect={(event) => handleSelection(event.currentTarget)}
                aria-label={t('email.bodyAria')}
                spellCheck
              />
            ) : (
              <div className="email-preview">
                {draft.body.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 8)}`}>{paragraph}</p>
                ))}
                {isStreaming && <span className="typing-caret" aria-hidden="true" />}
              </div>
            ))}
        </div>

        {draft.status === 'error' && showBody && (
          <div className="paper-alert">
            <AlertTriangle size={13} strokeWidth={2.2} />
            <span>{draft.error}</span>
          </div>
        )}
      </div>

      {canUseSelection && selection && (
        <div className="selection-bar">
          <div className="selection-info">
            <Highlighter size={13} strokeWidth={2.2} />
            <span>{t('email.selectionCount', { count: selection.text.length })}</span>
          </div>
          <input
            type="text"
            value={selectionInstruction}
            onChange={(event) => setSelectionInstruction(event.target.value)}
            placeholder={t('email.selectionPlaceholder')}
            aria-label={t('email.selectionAria')}
          />
          <button type="button" className="btn btn-small btn-primary" onClick={handleRewrite}>
            {t('email.rewrite')}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelection(null)}
            title={t('email.cancelSelection')}
            aria-label={t('email.cancelSelection')}
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {showControls && (
        <div className="refine-block">
          <div className="refine-head">
          <span className="refine-title">
            <Sparkles size={13} strokeWidth={2.2} />
            {t('email.refineTitle')}
          </span>
          <button type="button" className="text-btn" onClick={toggleMode} disabled={isStreaming}>
            {draft.mode === 'edit' ? (
              <>
                <Eye size={14} strokeWidth={2} />
                {t('email.viewFormatted')}
              </>
            ) : (
              <>
                <PenLine size={14} strokeWidth={2} />
                {t('email.editText')}
              </>
            )}
          </button>
        </div>

        <div className="refine-chips">
          {refinements.map((refinement) => {
            const Icon = refinement.Icon;
            return (
              <button
                key={refinement.id}
                type="button"
                className="refine-chip"
                onClick={() => onRefine(refinement.instruction)}
                disabled={!canRefine}
                title={t('email.streamingTitle', { label: refinement.label })}
              >
                <Icon size={13} strokeWidth={2} />
                {refinement.label}
              </button>
            );
          })}
        </div>

          <p className="refine-hint">
            {draft.mode === 'edit' ? t('email.refineHintEdit') : t('email.refineHintView')}
          </p>
        </div>
      )}

      {showControls && (
        <div className="email-foot">
          <span className="foot-left">
            <Cpu size={12} strokeWidth={2} />
            {model?.name ?? t('email.noModel')}
            {model && !model.free && (
              <span className="foot-price">${model.price.output.toFixed(2)}/M out</span>
            )}
          </span>
          <span className="foot-right">
            {isStreaming ? (
              <span className="foot-live">
                <span className="live-dot" aria-hidden="true" />
                {t('email.receivingTokens')}
              </span>
            ) : stats.runs > 0 ? (
              <>
                <span>{formatDuration(stats.lastElapsedMs)}</span>
                <i />
                <span>{formatRate(stats.lastTps)}</span>
                <i />
                <span>
                  {t('email.ttft')} {formatDuration(stats.lastTtftMs)}
                </span>
                <i />
                <span>
                  {(stats.inputTokens + stats.outputTokens).toLocaleString(locale)}{' '}
                  {t('email.tokens')}
                </span>
              </>
            ) : (
              <span>{t('email.waitingFirst')}</span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
