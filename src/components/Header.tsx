import {
  BookOpen,
  Gauge,
  KeyRound,
  Languages,
  LayoutGrid,
  Mail,
  MailCheck,
  MessageCircle,
  Radio,
  Send,
} from 'lucide-react';
import type { ConnectionState, KeySource, Plan, Workspace } from '../types';
import { formatPercent } from '../lib/format';
import { useI18n, type MessageKey } from '../lib/i18n';
import { PLAN_LABELS } from '../lib/models';

interface HeaderProps {
  connection: ConnectionState;
  keySource: KeySource;
  modelCount: number;
  monthlyPercent: number | null;
  plan: Plan;
  workspace: Workspace;
  deliveryConfigured: boolean;
  onWorkspaceChange: (workspace: Workspace) => void;
  onOpenKey: () => void;
  onOpenModels: () => void;
  onOpenDelivery: () => void;
}

const STATUS_KEYS: Record<ConnectionState, MessageKey> = {
  loading: 'header.status.loading',
  ready: 'header.status.ready',
  error: 'header.status.error',
  nokey: 'header.status.nokey',
};

const SOURCE_KEYS: Record<KeySource, MessageKey> = {
  server: 'header.source.server',
  client: 'header.source.client',
  none: 'header.source.none',
};

export function Header({
  connection,
  keySource,
  modelCount,
  monthlyPercent,
  plan,
  workspace,
  deliveryConfigured,
  onWorkspaceChange,
  onOpenKey,
  onOpenModels,
  onOpenDelivery,
}: HeaderProps) {
  const { locale, setLocale, t } = useI18n();
  const percent = monthlyPercent ?? 0;
  const statusLabel = t(STATUS_KEYS[connection]);
  const sourceLabel = t(SOURCE_KEYS[keySource]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Send size={17} strokeWidth={2.2} />
          </div>
          <div className="brand-copy">
            <div className="brand-line">
              <span className="brand-name">PolySend</span>
              <span className="brand-live">
                <Radio size={10} strokeWidth={2.8} />
                live
              </span>
            </div>
            <span className="brand-sub">
              {workspace === 'whatsapp' ? 'whatsapp studio · go api' : 'email studio · go api'}
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="workspace-switch" role="tablist" aria-label={t('workspace.switchAria')}>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'email'}
              className={workspace === 'email' ? 'is-active' : ''}
              onClick={() => onWorkspaceChange('email')}
              title={t('workspace.email')}
            >
              <Mail size={13} strokeWidth={2.2} />
              <span>{t('workspace.email')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'whatsapp'}
              className={workspace === 'whatsapp' ? 'is-active' : ''}
              onClick={() => onWorkspaceChange('whatsapp')}
              title={t('workspace.whatsapp')}
            >
              <MessageCircle size={13} strokeWidth={2.2} />
              <span>{t('workspace.whatsapp')}</span>
            </button>
          </div>

          <button
            type="button"
            className={`status-pill status-${connection}`}
            onClick={onOpenKey}
            title={t('header.configure')}
            aria-label={t('header.statusAria', { status: statusLabel })}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="status-label">{statusLabel}</span>
            <span className="status-divider" aria-hidden="true" />
            <span className="status-source">{sourceLabel}</span>
          </button>

          <div className="plan-pill" title={t('header.planTitle')}>
            <Gauge size={14} strokeWidth={2.2} />
            <span className="plan-pill-label">{PLAN_LABELS[plan]}</span>
            <span className="plan-pill-percent">{formatPercent(monthlyPercent)}</span>
            <span className="plan-pill-caption">{t('header.planCaption')}</span>
            <span className="plan-pill-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
            </span>
          </div>

          {workspace === 'email' && (
            <button type="button" className="btn btn-ghost models-toggle" onClick={onOpenModels}>
              <LayoutGrid size={15} strokeWidth={2} />
              <span>{t('header.models')}</span>
              <span className="btn-count">{modelCount}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-key"
            onClick={onOpenKey}
            aria-label={t('header.configure')}
          >
            <KeyRound size={15} strokeWidth={2} />
            <span className="key-btn-label">{t('header.configure')}</span>
          </button>

          {workspace === 'email' && (
            <button
              type="button"
              className="btn btn-delivery"
              onClick={onOpenDelivery}
              title={t('header.deliveryTitle')}
              aria-label={t('header.deliveryAria')}
            >
              <MailCheck size={15} strokeWidth={2} />
              <span className="delivery-btn-label">{t('header.delivery')}</span>
              <span
                className={`delivery-status-dot ${deliveryConfigured ? 'is-on' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}

          <button
            type="button"
            className="lang-toggle"
            onClick={() => setLocale(locale === 'en' ? 'pt-BR' : 'en')}
            title={t('header.switchLanguage')}
            aria-label={t('header.switchLanguage')}
          >
            <Languages size={14} strokeWidth={2} />
            <span>{locale === 'en' ? 'EN' : 'PT'}</span>
          </button>

          <a
            className="icon-btn"
            href="https://opencode.ai/docs/console/go"
            target="_blank"
            rel="noreferrer"
            title={t('header.docsTitle')}
            aria-label={t('header.docsAria')}
          >
            <BookOpen size={16} strokeWidth={2} />
          </a>
        </div>
      </div>
    </header>
  );
}
