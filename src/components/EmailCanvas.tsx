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
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import type { Briefing, Draft, Model, SessionStats } from '../types';
import { REFINEMENTS, TRANSLATE_INSTRUCTION } from '../lib/presets';
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
}

const REFINEMENT_ICONS = {
  curto: Minimize2,
  formal: Scale,
  persuasivo: Megaphone,
  cordial: HeartHandshake,
  cta: Target,
} as const;

function statusLabel(draft: Draft): string {
  if (draft.status === 'error') return 'interrompido';
  if (draft.status === 'streaming') {
    if (draft.phase === 'connecting') return 'conectando';
    if (draft.phase === 'thinking') return 'pensando';
    return 'escrevendo ao vivo';
  }
  if (draft.status === 'ready') return 'rascunho pronto';
  return 'rascunho vazio';
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
}: EmailCanvasProps) {
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
      ? { id: 'traduzir', label: 'Traduzir p/ português', instruction: TRANSLATE_INSTRUCTION.toPortuguese }
      : { id: 'traduzir', label: 'Traduzir p/ inglês', instruction: TRANSLATE_INSTRUCTION.toEnglish };

  const refinements = [...REFINEMENTS, translate];
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
        selectionInstruction.trim() ||
        'Deixe este trecho mais claro e natural, mantendo o tom e o sentido.',
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
            {statusLabel(draft)}
          </span>
        </div>

        <div className="email-chrome-right">
          <button type="button" className="model-chip" onClick={onOpenModels}>
            <Cpu size={13} strokeWidth={2.2} />
            <span>{model?.name ?? 'Escolher modelo'}</span>
            <ChevronDown size={12} strokeWidth={2.4} />
          </button>
          <span className="chrome-divider" aria-hidden="true" />
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={handleCopy}
            disabled={!showBody}
            title="Copiar e-mail completo"
            aria-label="Copiar e-mail completo"
          >
            {copied ? <Check size={15} strokeWidth={2.4} /> : <Clipboard size={15} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={onDownload}
            disabled={!showBody}
            title="Baixar como .txt"
            aria-label="Baixar e-mail como arquivo de texto"
          >
            <ArrowDownToLine size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn chrome-icon"
            onClick={onNew}
            disabled={!showBody && !draft.subject}
            title="Novo rascunho"
            aria-label="Limpar e começar um novo rascunho"
          >
            <Eraser size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`email-sheet ${draft.status === 'streaming' ? 'paper-live' : ''}`}>
        <div className="email-meta">
          <label className="email-meta-row">
            <span className="email-meta-label">Para</span>
            <input
              type="text"
              value={draft.to}
              onChange={(event) => onDraftChange({ to: event.target.value })}
              placeholder="destinatário@empresa.com"
              disabled={isStreaming}
              autoComplete="off"
            />
            <span className="email-meta-time">agora</span>
          </label>
          <label className="email-meta-row email-subject-row">
            <span className="email-meta-label">Assunto</span>
            <input
              type="text"
              value={draft.subject}
              onChange={(event) => onDraftChange({ subject: event.target.value })}
              placeholder={
                isStreaming && !draft.subject ? 'O assunto chega nos primeiros tokens…' : 'Assunto do e-mail'
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
              <h3>Seu e-mail nasce aqui</h3>
              <p>
                Preencha o briefing e clique em <strong>Gerar e-mail</strong>. A resposta é
                escrita em tempo real, token a token.
              </p>
              <div className="email-empty-meta">
                <span>
                  <Zap size={11} strokeWidth={2.4} />
                  streaming SSE
                </span>
                <i />
                <span>opencode go</span>
                <i />
                <span>editável</span>
              </div>
            </div>
          )}

          {showThinking && (
            <div className="email-thinking">
              <div className="thinking-head">
                <span className="live-dot" aria-hidden="true" />
                {draft.phase === 'connecting'
                  ? 'Conectando ao modelo…'
                  : draft.phase === 'thinking'
                    ? 'O modelo está pensando…'
                    : 'Preparando as primeiras palavras…'}
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
              <h3>Não deu para gerar</h3>
              <p>{draft.error ?? 'A geração foi interrompida.'}</p>
              <button type="button" className="btn btn-paper" onClick={onGenerate}>
                <RotateCcw size={14} strokeWidth={2.2} />
                Tentar novamente
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
                aria-label="Corpo do e-mail"
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
            <span>
              <strong>{selection.text.length}</strong> caracteres selecionados
            </span>
          </div>
          <input
            type="text"
            value={selectionInstruction}
            onChange={(event) => setSelectionInstruction(event.target.value)}
            placeholder="Ex.: mais direto, foco no prazo, sem jargão…"
            aria-label="Instrução para reescrever a seleção"
          />
          <button type="button" className="btn btn-small btn-primary" onClick={handleRewrite}>
            Reescrever
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelection(null)}
            title="Cancelar seleção"
            aria-label="Cancelar seleção"
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
            Ajustar com IA
          </span>
          <button type="button" className="text-btn" onClick={toggleMode} disabled={isStreaming}>
            {draft.mode === 'edit' ? (
              <>
                <Eye size={14} strokeWidth={2} />
                Ver formatado
              </>
            ) : (
              <>
                <PenLine size={14} strokeWidth={2} />
                Editar texto
              </>
            )}
          </button>
        </div>

        <div className="refine-chips">
          {refinements.map((refinement) => {
            const Icon =
              REFINEMENT_ICONS[refinement.id as keyof typeof REFINEMENT_ICONS] ?? Languages;
            return (
              <button
                key={refinement.id}
                type="button"
                className="refine-chip"
                onClick={() => onRefine(refinement.instruction)}
                disabled={!canRefine}
                title={`Streaming: ${refinement.label}`}
              >
                <Icon size={13} strokeWidth={2} />
                {refinement.label}
              </button>
            );
          })}
        </div>

          <p className="refine-hint">
            {draft.mode === 'edit'
              ? 'Selecione um trecho no texto para reescrever apenas ele — sem refazer o e-mail inteiro.'
              : 'Clique em “Editar texto” para ajustar manualmente ou selecionar um trecho.'}
          </p>
        </div>
      )}

      {showControls && (
        <div className="email-foot">
          <span className="foot-left">
            <Cpu size={12} strokeWidth={2} />
            {model?.name ?? 'nenhum modelo'}
            {model && !model.free && (
              <span className="foot-price">${model.price.output.toFixed(2)}/M out</span>
            )}
          </span>
          <span className="foot-right">
            {isStreaming ? (
              <span className="foot-live">
                <span className="live-dot" aria-hidden="true" />
                recebendo tokens…
              </span>
            ) : stats.runs > 0 ? (
              <>
                <span>{formatDuration(stats.lastElapsedMs)}</span>
                <i />
                <span>{formatRate(stats.lastTps)}</span>
                <i />
                <span>TTFT {formatDuration(stats.lastTtftMs)}</span>
                <i />
                <span>{(stats.inputTokens + stats.outputTokens).toLocaleString('pt-BR')} tok</span>
              </>
            ) : (
              <span>aguardando a primeira geração</span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
