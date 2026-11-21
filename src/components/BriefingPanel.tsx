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
  getPresets,
  LANGUAGE_VALUES,
  LENGTH_VALUES,
  TONE_VALUES,
} from '../lib/presets';
import { useI18n, type MessageKey } from '../lib/i18n';

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

const TONE_KEYS: Record<Tone, MessageKey> = {
  profissional: 'tone.profissional',
  direto: 'tone.direto',
  amigavel: 'tone.amigavel',
  persuasivo: 'tone.persuasivo',
  empatico: 'tone.empatico',
  formal: 'tone.formal',
};

const LENGTH_KEYS: Record<EmailLength, MessageKey> = {
  curto: 'length.curto',
  medio: 'length.medio',
  longo: 'length.longo',
};

const LENGTH_HINT_KEYS: Record<EmailLength, MessageKey> = {
  curto: 'length.curtoHint',
  medio: 'length.medioHint',
  longo: 'length.longoHint',
};

const LANGUAGE_KEYS: Record<Language, MessageKey> = {
  'pt-BR': 'language.ptBR',
  en: 'language.en',
  es: 'language.es',
};

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
  const { locale, t } = useI18n();
  const presets = getPresets(locale);
  const hasExtra = Boolean(briefing.details.trim() || briefing.signature.trim());

  return (
    <section className="panel briefing-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">{t('briefing.eyebrow')}</span>
          <h2>{t('briefing.title')}</h2>
        </div>
        <span className={`panel-tag ${isStreaming ? 'is-live' : ''}`}>
          <PenLine size={12} strokeWidth={2.2} />
          {isStreaming ? t('briefing.tagLive') : t('briefing.tagDraft')}
        </span>
      </div>

      <div className="briefing-scroll">
        <div className="preset-grid" aria-label={t('briefing.examplesAria')}>
        {presets.map((preset) => {
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
            {t('briefing.recipient')}
            <small>{t('briefing.recipientHint')}</small>
          </span>
          <input
            type="text"
            value={briefing.recipient}
            onChange={(event) => onChange({ recipient: event.target.value })}
            placeholder={t('briefing.recipientPlaceholder')}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">
            {t('briefing.company')}
            <small>{t('briefing.companyHint')}</small>
          </span>
          <input
            type="text"
            value={briefing.company}
            onChange={(event) => onChange({ company: event.target.value })}
            placeholder={t('briefing.companyPlaceholder')}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">
            {t('briefing.goal')}
            <small>{briefing.topic.length}/900</small>
          </span>
          <textarea
            rows={4}
            value={briefing.topic}
            onChange={(event) => onChange({ topic: event.target.value.slice(0, 900) })}
            placeholder={t('briefing.goalPlaceholder')}
          />
        </label>

        <div className="field">
          <span className="field-label">
            {t('briefing.tone')}
            <small>{t('briefing.toneHint')}</small>
          </span>
          <div className="chip-row" role="group" aria-label={t('briefing.toneAria')}>
            {TONE_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${briefing.tone === value ? 'is-selected' : ''}`}
                aria-pressed={briefing.tone === value}
                onClick={() => onChange({ tone: value as Tone })}
              >
                {t(TONE_KEYS[value])}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <span className="field-label">{t('briefing.length')}</span>
            <div className="segmented" role="group" aria-label={t('briefing.lengthAria')}>
              {LENGTH_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={briefing.length === value ? 'is-selected' : ''}
                  aria-pressed={briefing.length === value}
                  title={t(LENGTH_HINT_KEYS[value])}
                  onClick={() => onChange({ length: value as EmailLength })}
                >
                  {t(LENGTH_KEYS[value])}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">{t('briefing.language')}</span>
            <span className="select-wrap">
              <select
                value={briefing.language}
                onChange={(event) => onChange({ language: event.target.value as Language })}
              >
                {LANGUAGE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(LANGUAGE_KEYS[value])}
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
              {t('briefing.context')}
              {hasExtra && <i className="filled-dot" aria-label={t('briefing.filled')} />}
            </span>
            <ChevronDown size={14} />
          </summary>
          <div className="advanced-body">
            <label className="field">
              <span className="field-label">
                {t('briefing.details')}
                <small>{t('briefing.optional')}</small>
              </span>
              <textarea
                rows={3}
                value={briefing.details}
                onChange={(event) => onChange({ details: event.target.value.slice(0, 700) })}
                placeholder={t('briefing.detailsPlaceholder')}
              />
            </label>
            <label className="field">
              <span className="field-label">
                {t('briefing.signature')}
                <small>{t('briefing.signatureHint')}</small>
              </span>
              <textarea
                rows={2}
                value={briefing.signature}
                onChange={(event) => onChange({ signature: event.target.value.slice(0, 240) })}
                placeholder={t('briefing.signaturePlaceholder')}
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
            {t('briefing.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-generate"
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            <Sparkles size={16} strokeWidth={2.2} />
            {t('briefing.generate')}
            <kbd title={t('briefing.shortcutTitle')}>{SHORTCUT}</kbd>
          </button>
        )}
        <p className="generate-hint">
          <WandSparkles size={12} strokeWidth={2.2} />
          {modelName
            ? t('briefing.writingWith', { model: modelName })
            : t('briefing.chooseModelHint')}
        </p>
      </div>
    </section>
  );
}
