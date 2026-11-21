import {
  CalendarClock,
  ChevronDown,
  FileText,
  PenLine,
  ReceiptText,
  Repeat2,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react';
import type { Briefing, Language, EmailLength, Tone } from '../types';
import type { Preset } from '../lib/presets';
import {
  LENGTH_OPTIONS,
  LANGUAGE_OPTIONS,
  PRESETS,
  TONE_OPTIONS,
} from '../lib/presets';

interface BriefingPanelProps {
  briefing: Briefing;
  modelName: string | null;
  isStreaming: boolean;
  canGenerate: boolean;
  onChange: (patch: Partial<Briefing>) => void;
  onApplyPreset: (preset: Preset) => void;
  onGenerate: () => void;
  onStop: () => void;
}

const PRESET_ICONS = {
  orcamento: FileText,
  followup: Repeat2,
  reuniao: CalendarClock,
  cobranca: ReceiptText,
} as const;

const SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? '⌘↵'
    : 'Ctrl↵';

export function BriefingPanel({
  briefing,
  modelName,
  isStreaming,
  canGenerate,
  onChange,
  onApplyPreset,
  onGenerate,
  onStop,
}: BriefingPanelProps) {
  const hasExtra = Boolean(briefing.details.trim() || briefing.signature.trim());

  return (
    <section className="panel briefing-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">01 · briefing</span>
          <h2>O que vamos escrever?</h2>
        </div>
        <span className={`panel-tag ${isStreaming ? 'is-live' : ''}`}>
          <PenLine size={12} strokeWidth={2.2} />
          {isStreaming ? 'ao vivo' : 'rascunho'}
        </span>
      </div>

      <div className="briefing-scroll">
        <div className="preset-grid" aria-label="Exemplos de e-mail">
        {PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.id as keyof typeof PRESET_ICONS] ?? FileText;
          return (
            <button
              key={preset.id}
              type="button"
              className="preset-card"
              onClick={() => onApplyPreset(preset)}
            >
              <span className="preset-icon">
                <Icon size={15} strokeWidth={2} />
              </span>
              <span className="preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="form-stack">
        <label className="field">
          <span className="field-label">
            Destinatário
            <small>nome e e-mail</small>
          </span>
          <input
            type="text"
            value={briefing.recipient}
            onChange={(event) => onChange({ recipient: event.target.value })}
            placeholder="Mariana Costa · mariana@empresa.com"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">
            Empresa
            <small>contexto</small>
          </span>
          <input
            type="text"
            value={briefing.company}
            onChange={(event) => onChange({ company: event.target.value })}
            placeholder="Northwind Tecnologia"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">
            Objetivo
            <small>{briefing.topic.length}/900</small>
          </span>
          <textarea
            rows={4}
            value={briefing.topic}
            onChange={(event) => onChange({ topic: event.target.value.slice(0, 900) })}
            placeholder="Ex.: pedir um orçamento para um app de logística, com lançamento em oito semanas."
          />
        </label>

        <div className="field">
          <span className="field-label">
            Tom
            <small>como deve soar</small>
          </span>
          <div className="chip-row" role="group" aria-label="Tom do e-mail">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip ${briefing.tone === option.value ? 'is-selected' : ''}`}
                aria-pressed={briefing.tone === option.value}
                onClick={() => onChange({ tone: option.value as Tone })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <span className="field-label">Extensão</span>
            <div className="segmented" role="group" aria-label="Extensão do e-mail">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={briefing.length === option.value ? 'is-selected' : ''}
                  aria-pressed={briefing.length === option.value}
                  title={option.hint}
                  onClick={() => onChange({ length: option.value as EmailLength })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">Idioma</span>
            <span className="select-wrap">
              <select
                value={briefing.language}
                onChange={(event) => onChange({ language: event.target.value as Language })}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </label>
        </div>

        <details className="advanced">
          <summary>
            <span>
              Contexto e assinatura
              {hasExtra && <i className="filled-dot" aria-label="preenchido" />}
            </span>
            <ChevronDown size={14} />
          </summary>
          <div className="advanced-body">
            <label className="field">
              <span className="field-label">
                Detalhes
                <small>opcional</small>
              </span>
              <textarea
                rows={3}
                value={briefing.details}
                onChange={(event) => onChange({ details: event.target.value.slice(0, 700) })}
                placeholder="Prazos, valores, restrições, próximos passos…"
              />
            </label>
            <label className="field">
              <span className="field-label">
                Assinatura
                <small>vai no fim do e-mail</small>
              </span>
              <textarea
                rows={2}
                value={briefing.signature}
                onChange={(event) => onChange({ signature: event.target.value.slice(0, 240) })}
                placeholder={'Ana Souza\nHead de Produto · Acme'}
              />
            </label>
          </div>
        </details>
        </div>
      </div>

      <div className="generate-block">
        {isStreaming ? (
          <button type="button" className="btn btn-stop" onClick={onStop}>
            <Square size={14} fill="currentColor" strokeWidth={0} />
            Parar geração
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-generate"
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            <Sparkles size={16} strokeWidth={2.2} />
            Gerar e-mail
            <kbd title="Atalho: Ctrl + Enter">{SHORTCUT}</kbd>
          </button>
        )}
        <p className="generate-hint">
          <WandSparkles size={12} strokeWidth={2.2} />
          {modelName ? (
            <>
              escrevendo com <strong>{modelName}</strong> · token a token
            </>
          ) : (
            <>escolha um modelo no catálogo ao lado</>
          )}
        </p>
      </div>
    </section>
  );
}
