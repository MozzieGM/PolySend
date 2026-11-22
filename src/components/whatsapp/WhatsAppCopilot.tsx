import {
  AlertCircle,
  ChevronDown,
  CornerDownLeft,
  Cpu,
  KeyRound,
  Loader2,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { formatCost, formatDuration, formatTokens, formatUSD } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { whatsAppAvatarUrl } from '../../lib/whatsapp';
import type {
  EmailLength,
  Language,
  Model,
  StreamUsage,
  Tone,
  WhatsAppChat,
} from '../../types';
import { WhatsAppAvatar } from './WhatsAppAvatar';

const TONES: Tone[] = ['amigavel', 'direto', 'profissional', 'persuasivo', 'formal'];
const LENGTHS: EmailLength[] = ['curto', 'medio', 'longo'];
const LANGUAGES: Language[] = ['pt-BR', 'en', 'es'];

interface WhatsAppCopilotProps {
  chat: WhatsAppChat | null;
  mock: boolean;
  hasKey: boolean;
  selectedModel: Model | null;
  instruction: string;
  tone: Tone;
  length: EmailLength;
  language: Language;
  draft: string;
  streaming: boolean;
  error: string | null;
  usage: StreamUsage | null;
  elapsedMs: number | null;
  sessionUsage: { runs: number; tokens: number; cost: number };
  onOpenModels: () => void;
  onInstructionChange: (value: string) => void;
  onToneChange: (tone: Tone) => void;
  onLengthChange: (length: EmailLength) => void;
  onLanguageChange: (language: Language) => void;
  onGenerate: () => void;
  onStop: () => void;
  onUse: () => void;
  onOpenKey: () => void;
  onClose: () => void;
}

export function WhatsAppCopilot({
  chat,
  mock,
  hasKey,
  selectedModel,
  instruction,
  tone,
  length,
  language,
  draft,
  streaming,
  error,
  usage,
  elapsedMs,
  sessionUsage,
  onOpenModels,
  onInstructionChange,
  onToneChange,
  onLengthChange,
  onLanguageChange,
  onGenerate,
  onStop,
  onUse,
  onOpenKey,
  onClose,
}: WhatsAppCopilotProps) {
  const { t } = useI18n();
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const tokens = usage?.total_tokens ?? null;
  const cost = usage?.opencode?.list_cost ?? usage?.cost ?? null;
  const canGenerate = Boolean(chat) && hasKey && Boolean(selectedModel) && !streaming;

  return (
    <aside className="wa-copilot">
      <div className="wa-copilot-head">
        <span className="wa-copilot-mark">
          <Sparkles size={17} strokeWidth={2.1} />
        </span>
        <div>
          <span className="eyebrow">{t('whatsapp.aiEyebrow')}</span>
          <h2>{t('whatsapp.aiTitle')}</h2>
        </div>
        <button
          type="button"
          className="icon-btn wa-copilot-close"
          onClick={onClose}
          title={t('whatsapp.closeAi')}
          aria-label={t('whatsapp.closeAi')}
        >
          <X size={15} strokeWidth={2.1} />
        </button>
      </div>

      <div className="wa-copilot-body">
        {!chat ? (
          <div className="wa-copilot-empty">
            <Sparkles size={22} strokeWidth={1.8} />
            <strong>{t('whatsapp.aiNeedsChat')}</strong>
          </div>
        ) : (
          <>
            <div className="wa-copilot-context">
              <WhatsAppAvatar
                name={chat.name}
                color={chat.color}
                isGroup={chat.isGroup}
                size={32}
                imageUrl={mock ? null : whatsAppAvatarUrl(chat.id)}
              />
              <div>
                <span>{t('whatsapp.aiContext', { name: chat.name })}</span>
                <p>{chat.lastMessage || t('whatsapp.noMessages')}</p>
              </div>
            </div>

            {!hasKey && (
              <div className="wa-copilot-callout">
                <KeyRound size={14} strokeWidth={2} />
                <span>{t('whatsapp.aiNeedsKey')}</span>
                <button type="button" className="text-btn" onClick={onOpenKey}>
                  {t('header.configure')}
                </button>
              </div>
            )}

            <div className="wa-field">
              <span className="field-label">{t('whatsapp.aiModel')}</span>
              <button
                type="button"
                className="wa-model-trigger"
                onClick={onOpenModels}
                disabled={streaming}
                title={t('whatsapp.changeModel')}
              >
                <span className="wa-model-trigger-icon">
                  <Cpu size={14} strokeWidth={2.1} />
                </span>
                <span className="wa-model-trigger-copy">
                  <strong>{selectedModel?.name ?? t('whatsapp.aiNoModel')}</strong>
                  <small>
                    {selectedModel
                      ? `${formatUSD(selectedModel.price.input, 2)} in → ${formatUSD(
                          selectedModel.price.output,
                          2,
                        )} out /1M · ${formatTokens(selectedModel.context)} ctx`
                      : t('whatsapp.modelOpenHint')}
                  </small>
                </span>
                {selectedModel?.free && (
                  <span className="mini-badge free">{t('models.badgeFree')}</span>
                )}
                <ChevronDown size={13} strokeWidth={2.2} />
              </button>
              <span className="wa-model-hint">{t('whatsapp.modelFreeFirst')}</span>
            </div>

            <label className="wa-field">
              <span className="field-label">{t('whatsapp.aiInstruction')}</span>
              <textarea
                value={instruction}
                onChange={(event) => onInstructionChange(event.target.value.slice(0, 600))}
                placeholder={t('whatsapp.aiInstructionPlaceholder')}
                rows={3}
                disabled={streaming}
              />
            </label>

            <div className="wa-field">
              <span className="field-label">{t('whatsapp.tone')}</span>
              <div className="wa-tone-chips">
                {TONES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={tone === option ? 'is-active' : ''}
                    onClick={() => onToneChange(option)}
                    disabled={streaming}
                  >
                    {t(`whatsapp.tone.${option}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="wa-field-row">
              <div className="wa-field">
                <span className="field-label">{t('whatsapp.length')}</span>
                <div className="wa-segment">
                  {LENGTHS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={length === option ? 'is-active' : ''}
                      onClick={() => onLengthChange(option)}
                      disabled={streaming}
                    >
                      {t(
                        option === 'curto'
                          ? 'whatsapp.aiShort'
                          : option === 'longo'
                            ? 'whatsapp.aiLong'
                            : 'whatsapp.aiMedium',
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <label className="wa-field">
                <span className="field-label">{t('whatsapp.language')}</span>
                <select
                  value={language}
                  onChange={(event) => onLanguageChange(event.target.value as Language)}
                  disabled={streaming}
                >
                  {LANGUAGES.map((option) => (
                    <option key={option} value={option}>
                      {option === 'pt-BR' ? 'Português' : option === 'en' ? 'English' : 'Español'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="wa-copilot-actions">
              {streaming ? (
                <button type="button" className="btn btn-ghost wa-ai-button" onClick={onStop}>
                  <Square size={13} strokeWidth={2.4} />
                  {t('whatsapp.stop')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary wa-ai-button"
                  onClick={onGenerate}
                  disabled={!canGenerate}
                >
                  <Sparkles size={14} strokeWidth={2.2} />
                  {draft ? t('whatsapp.regenerate') : t('whatsapp.generate')}
                </button>
              )}
              {streaming && (
                <span className="wa-ai-live">
                  <span className="wa-ai-pulse" />
                  {t('whatsapp.aiWriting')}
                </span>
              )}
            </div>

            {error && (
              <div className="wa-copilot-error" role="alert">
                <AlertCircle size={13} strokeWidth={2.2} />
                <span>{error}</span>
              </div>
            )}

            <div className={`wa-draft-card ${streaming ? 'is-streaming' : ''}`}>
              <div className="wa-draft-head">
                <span>{t('whatsapp.aiTitle')}</span>
                <div>
                  {draft && <span>{t('whatsapp.aiWords', { count: words })}</span>}
                  {tokens != null && <span>{t('whatsapp.aiTokens', { count: tokens })}</span>}
                  {cost != null && <span>{formatCost(cost)}</span>}
                  {elapsedMs != null && <span>{formatDuration(elapsedMs)}</span>}
                </div>
              </div>
              {draft ? (
                <p className="wa-draft-text">
                  {draft}
                  {streaming && <span className="wa-ai-caret" aria-hidden="true" />}
                </p>
              ) : (
                <div className="wa-draft-empty">
                  {streaming ? (
                    <Loader2 size={18} className="is-spinning" />
                  ) : (
                    <Sparkles size={18} strokeWidth={1.7} />
                  )}
                  <strong>{t('whatsapp.aiEmpty')}</strong>
                  <span>{t('whatsapp.aiEmptyHint')}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-ghost wa-use-draft"
              onClick={onUse}
              disabled={!draft.trim() || streaming}
            >
              <CornerDownLeft size={14} strokeWidth={2.2} />
              {t('whatsapp.useDraft')}
            </button>

            {sessionUsage.runs > 0 && (
              <div className="wa-ai-session">
                <span>{t('whatsapp.aiSession')}</span>
                <b>{formatTokens(sessionUsage.tokens)} tok</b>
                <b>{formatCost(sessionUsage.cost)}</b>
                <b>
                  {sessionUsage.runs === 1
                    ? t('whatsapp.aiOneRun')
                    : t('whatsapp.aiRuns', { count: sessionUsage.runs })}
                </b>
              </div>
            )}

            <p className="wa-copilot-foot">{t('whatsapp.aiDisclaimer')}</p>
          </>
        )}
      </div>
    </aside>
  );
}
