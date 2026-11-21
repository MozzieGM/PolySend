import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  MailCheck,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  extractEmail,
  fetchDeliveryHistory,
  fetchDeliveryStatus,
  isValidEmail,
  refreshDeliveryItem,
  sendDeliveryEmail,
  verifyDeliveryDomain,
} from '../lib/delivery';
import { errorMessage } from '../lib/errors';
import { formatRelative } from '../lib/format';
import { useI18n, type MessageKey } from '../lib/i18n';
import type {
  Briefing,
  DeliveryHistoryItem,
  DeliveryStatus,
  Draft,
  ResendDomain,
} from '../types';

type DeliveryTab = 'send' | 'settings';

interface DeliveryModalProps {
  open: boolean;
  initialTab: DeliveryTab;
  draft: Draft;
  briefing: Briefing;
  resendKey: string;
  serverKeyConfigured: boolean;
  onClose: () => void;
  onKeyChange: (key: string) => void;
}

const FROM_NAME_KEY = 'polysend_resend_from_name';
const FROM_EMAIL_KEY = 'polysend_resend_from_email';
const REPLY_TO_KEY = 'polysend_resend_reply_to';

const DOMAIN_STATUS_KEYS: Record<string, MessageKey> = {
  verified: 'delivery.domainStatus.verified',
  pending: 'delivery.domainStatus.pending',
  not_started: 'delivery.domainStatus.not_started',
  failed: 'delivery.domainStatus.failed',
  temporary_failure: 'delivery.domainStatus.temporary_failure',
  unknown: 'delivery.domainStatus.unknown',
};

const EVENT_KEYS: Record<string, MessageKey> = {
  accepted: 'delivery.event.accepted',
  sent: 'delivery.event.sent',
  delivered: 'delivery.event.delivered',
  bounced: 'delivery.event.bounced',
  complained: 'delivery.event.complained',
  opened: 'delivery.event.opened',
  clicked: 'delivery.event.clicked',
  delivery_delayed: 'delivery.event.delivery_delayed',
  failed: 'delivery.event.failed',
  scheduled: 'delivery.event.scheduled',
  unknown: 'delivery.event.unknown',
};

function readSetting(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeSetting(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function eventLabel(item: DeliveryHistoryItem, t: ReturnType<typeof useI18n>['t']): string {
  const event = item.lastEvent ?? item.status ?? 'unknown';
  const key = EVENT_KEYS[event];
  return key ? t(key) : event;
}

function eventTone(item: DeliveryHistoryItem): string {
  const event = item.lastEvent ?? item.status;
  if (event === 'delivered' || event === 'opened' || event === 'clicked') return 'ok';
  if (event === 'bounced' || event === 'complained' || event === 'failed') return 'danger';
  return 'neutral';
}

function DomainStatus({ domain }: { domain: ResendDomain }) {
  const { t } = useI18n();
  const key = DOMAIN_STATUS_KEYS[domain.status] ?? DOMAIN_STATUS_KEYS.unknown;
  return (
    <span className={`delivery-domain-status status-${domain.status}`}>{t(key)}</span>
  );
}

export function DeliveryModal({
  open,
  initialTab,
  draft,
  briefing,
  resendKey,
  serverKeyConfigured,
  onClose,
  onKeyChange,
}: DeliveryModalProps) {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<DeliveryTab>(initialTab);
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [domainBusyId, setDomainBusyId] = useState<string | null>(null);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [fromName, setFromName] = useState(() => readSetting(FROM_NAME_KEY));
  const [fromEmail, setFromEmail] = useState(() => readSetting(FROM_EMAIL_KEY));
  const [replyTo, setReplyTo] = useState(() => readSetting(REPLY_TO_KEY));
  const [to, setTo] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendDetails, setSendDetails] = useState<string | null>(null);
  const [sent, setSent] = useState<DeliveryHistoryItem | null>(null);
  const [history, setHistory] = useState<DeliveryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const idempotencyRef = useRef<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  const verifiedDomains = useMemo(
    () => (status?.domains ?? []).filter((domain) => domain.status === 'verified'),
    [status],
  );

  const fromDomain = fromEmail.includes('@')
    ? fromEmail.split('@').pop()?.toLowerCase()
    : null;
  const fromDomainVerified = fromDomain
    ? verifiedDomains.some((domain) => domain.name.toLowerCase() === fromDomain)
    : false;
  const showFromWarning =
    Boolean(status) &&
    !status?.restricted &&
    (status?.domains.length ?? 0) > 0 &&
    isValidEmail(fromEmail) &&
    !fromDomainVerified;

  const isBusy = sendBusy || testBusy || keyBusy;

  const loadStatus = async (key: string | undefined) => {
    if (!key && !serverKeyConfigured) {
      setStatus(null);
      setStatusError(null);
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await fetchDeliveryStatus(key);
      setStatus(data);
      setFromName((previous) => previous || data.defaults.fromName || 'PolySend');
      setFromEmail((previous) => {
        if (previous) return previous;
        if (data.defaults.fromEmail) return data.defaults.fromEmail;
        const firstVerified = data.domains.find((domain) => domain.status === 'verified');
        return firstVerified ? `hello@${firstVerified.name}` : '';
      });
      setReplyTo((previous) => previous || data.defaults.replyTo || '');
    } catch (error) {
      setStatus(null);
      setStatusError(errorMessage(error, t));
    } finally {
      setStatusLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await fetchDeliveryHistory());
    } catch (error) {
      setHistoryError(errorMessage(error, t));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setTo(extractEmail(draft.to) || extractEmail(briefing.recipient) || '');
    setReviewed(false);
    setSent(null);
    setSendError(null);
    setSendDetails(null);
    setTestMessage(null);
    setTestError(null);
    setKeyError(null);
    setDomainError(null);
    setDomainMessage(null);
    setKeyInput('');
    idempotencyRef.current = null;
    void loadHistory();
    // Only reset when the modal is opened or its entry tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    void loadStatus(resendKey || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resendKey, serverKeyConfigured, t]);

  useEffect(() => {
    writeSetting(FROM_NAME_KEY, fromName);
  }, [fromName]);

  useEffect(() => {
    writeSetting(FROM_EMAIL_KEY, fromEmail);
  }, [fromEmail]);

  useEffect(() => {
    writeSetting(REPLY_TO_KEY, replyTo);
  }, [replyTo]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isBusy, onClose]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  if (!open) return null;

  const close = () => {
    if (!isBusy) onClose();
  };

  const handleConnectKey = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = keyInput.trim();
    if (!candidate || keyBusy) {
      if (!candidate) setKeyError(t('delivery.keyInvalid'));
      return;
    }

    setKeyBusy(true);
    setKeyError(null);
    try {
      const data = await fetchDeliveryStatus(candidate);
      onKeyChange(candidate);
      setStatus(data);
      setStatusError(null);
      setKeyInput('');
      setFromName((previous) => previous || data.defaults.fromName || 'PolySend');
      setFromEmail((previous) => {
        if (previous) return previous;
        if (data.defaults.fromEmail) return data.defaults.fromEmail;
        const firstVerified = data.domains.find((domain) => domain.status === 'verified');
        return firstVerified ? `hello@${firstVerified.name}` : '';
      });
      setReplyTo((previous) => previous || data.defaults.replyTo || '');
    } catch (error) {
      setKeyError(errorMessage(error, t));
    } finally {
      setKeyBusy(false);
    }
  };

  const handleRemoveKey = () => {
    onKeyChange('');
    setKeyInput('');
    setStatus(null);
    setStatusError(null);
    setKeyError(null);
  };

  const handleUseServerKey = () => {
    onKeyChange('');
    setKeyInput('');
    setKeyError(null);
    setStatusError(null);
  };

  const handleVerifyDomain = async (id: string) => {
    if (domainBusyId) return;
    setDomainBusyId(id);
    setDomainError(null);
    setDomainMessage(null);
    try {
      await verifyDeliveryDomain(resendKey || undefined, id);
      setDomainMessage(t('delivery.domainVerifyStarted'));
      window.setTimeout(() => {
        void loadStatus(resendKey || undefined);
      }, 2500);
    } catch (error) {
      setDomainError(errorMessage(error, t));
    } finally {
      setDomainBusyId(null);
    }
  };

  const handleSend = async () => {
    if (!status || sendBusy) return;
    if (!isValidEmail(to)) {
      setSendError(t('delivery.invalidTo'));
      return;
    }
    if (!isValidEmail(fromEmail)) {
      setSendError(t('delivery.missingFrom'));
      return;
    }
    if (!reviewed) return;

    setSendBusy(true);
    setSendError(null);
    setSendDetails(null);
    if (!idempotencyRef.current) idempotencyRef.current = crypto.randomUUID();

    try {
      const item = await sendDeliveryEmail({
        key: resendKey || undefined,
        payload: {
          to: to.trim(),
          fromName: fromName.trim() || 'PolySend',
          fromEmail: fromEmail.trim(),
          replyTo: replyTo.trim() || null,
          subject: draft.subject,
          text: draft.body,
          idempotencyKey: idempotencyRef.current,
        },
      });
      setSent(item);
      setReviewed(false);
      idempotencyRef.current = null;
      void loadHistory();
    } catch (error) {
      setSendError(errorMessage(error, t));
      if (error instanceof ApiError && error.details) setSendDetails(error.details);
    } finally {
      setSendBusy(false);
    }
  };

  const handleTest = async () => {
    if (testBusy || !status) return;
    if (!isValidEmail(testTo)) {
      setTestError(t('delivery.testInvalid'));
      return;
    }
    if (!isValidEmail(fromEmail)) {
      setTestError(t('delivery.testFromRequired'));
      return;
    }

    setTestBusy(true);
    setTestError(null);
    setTestMessage(null);
    try {
      await sendDeliveryEmail({
        key: resendKey || undefined,
        payload: {
          to: testTo.trim(),
          fromName: fromName.trim() || 'PolySend',
          fromEmail: fromEmail.trim(),
          replyTo: replyTo.trim() || null,
          subject: t('delivery.testSubject'),
          text: t('delivery.testText'),
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setTestMessage(t('delivery.testSuccess'));
      void loadHistory();
    } catch (error) {
      setTestError(errorMessage(error, t));
    } finally {
      setTestBusy(false);
    }
  };

  const handleRefreshHistory = async (id: string) => {
    if (refreshingId) return;
    setRefreshingId(id);
    setHistoryError(null);
    try {
      const item = await refreshDeliveryItem(resendKey || undefined, id);
      setHistory((previous) => previous.map((entry) => (entry.id === id ? item : entry)));
    } catch (error) {
      setHistoryError(errorMessage(error, t));
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopiedId(id);
        if (copyTimer.current) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopiedId(null), 1600);
      })
      .catch(() => setCopiedId(null));
  };

  const canSend =
    Boolean(status) &&
    isValidEmail(to) &&
    isValidEmail(fromEmail) &&
    reviewed &&
    !sendBusy;

  const renderSendTab = () => {
    if (!draft.body.trim()) {
      return (
        <div className="delivery-empty">
          <MailCheck size={22} strokeWidth={1.8} />
          <h3>{t('delivery.noDraftTitle')}</h3>
          <p>{t('delivery.noDraftBody')}</p>
          <button type="button" className="btn btn-ghost btn-small" onClick={close}>
            {t('email.editText')}
          </button>
        </div>
      );
    }

    if (!status) {
      return (
        <div className="delivery-empty">
          <span className={`delivery-empty-icon ${statusError ? 'has-error' : ''}`}>
            {statusLoading ? (
              <Loader2 size={20} className="is-spinning" />
            ) : (
              <MailCheck size={20} strokeWidth={1.8} />
            )}
          </span>
          <h3>
            {statusLoading
              ? t('delivery.loading')
              : t('delivery.connectTitle')}
          </h3>
          {!statusLoading && <p>{statusError ?? t('delivery.connectBody')}</p>}
          {!statusLoading && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => setTab('settings')}
            >
              <KeyRound size={13} strokeWidth={2.2} />
              {t('delivery.connectButton')}
            </button>
          )}
        </div>
      );
    }

    if (sent) {
      return (
        <div className="delivery-success">
          <span className="delivery-success-icon">
            <CheckCircle2 size={22} strokeWidth={2} />
          </span>
          <div>
            <h3>{t('delivery.sendSuccessTitle')}</h3>
            <p>{t('delivery.sendSuccessBody')}</p>
            <div className="delivery-id-row">
              <span>{t('delivery.sendSuccessId')}</span>
              <code>{sent.id}</code>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleCopyId(sent.id)}
                title={t('delivery.copyId')}
                aria-label={t('delivery.copyId')}
              >
                {copiedId === sent.id ? (
                  <Check size={13} strokeWidth={2.4} />
                ) : (
                  <Copy size={13} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-small" onClick={close}>
            {t('delivery.done')}
          </button>
        </div>
      );
    }

    return (
      <div className="delivery-send">
        <div className="delivery-section-head delivery-send-head">
          <div>
            <span className="eyebrow">{t('delivery.providerResend')}</span>
            <h3>{t('delivery.reviewTitle')}</h3>
          </div>
          <span className={`delivery-key-badge ${status.restricted ? 'is-restricted' : ''}`}>
            {status.restricted ? t('delivery.restricted') : t('delivery.fullAccess')}
          </span>
        </div>

        <div className="delivery-send-fields">
          <label className="field">
            <span className="field-label">{t('delivery.to')}</span>
            <input
              type="email"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setReviewed(false);
                setSendError(null);
              }}
              placeholder={t('delivery.toPlaceholder')}
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className="delivery-from-row">
            <div>
              <span className="field-label">{t('delivery.from')}</span>
              <div className="delivery-from-value">
                {isValidEmail(fromEmail) ? (
                  <>
                    <strong>{fromName || 'PolySend'}</strong>
                    <span>&lt;{fromEmail}&gt;</span>
                  </>
                ) : (
                  <span className="delivery-muted">{t('delivery.missingFrom')}</span>
                )}
              </div>
            </div>
            {replyTo && (
              <div className="delivery-reply-summary">
                <span className="field-label">{t('delivery.replyTo')}</span>
                <span>{replyTo}</span>
              </div>
            )}
            <button
              type="button"
              className="text-btn"
              onClick={() => setTab('settings')}
            >
              {t('delivery.changeSender')}
            </button>
          </div>

          {showFromWarning && (
            <div className="delivery-inline-warning">
              <AlertCircle size={13} strokeWidth={2.2} />
              <span>{t('delivery.fromNotVerified')}</span>
            </div>
          )}
        </div>

        <div className="delivery-preview">
          <div className="delivery-preview-subject">
            <span>{t('delivery.subject')}</span>
            <strong>{draft.subject || '—'}</strong>
          </div>
          <div className="delivery-preview-body">{draft.body}</div>
        </div>

        {sendError && (
          <div className="delivery-error" role="alert">
            <AlertCircle size={14} strokeWidth={2.2} />
            <div>
              <p>{sendError}</p>
              {sendDetails && (
                <details>
                  <summary>{t('delivery.providerDetails')}</summary>
                  <code>{sendDetails}</code>
                </details>
              )}
            </div>
          </div>
        )}

        <div className="delivery-send-foot">
          <label className="delivery-checkbox">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            <span>{t('delivery.reviewCheckbox')}</span>
          </label>
          <div className="delivery-send-actions">
            <span>{t('delivery.rateNote')}</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSend()}
              disabled={!canSend}
            >
              {sendBusy ? (
                <Loader2 size={14} className="is-spinning" />
              ) : (
                <Send size={14} strokeWidth={2.2} />
              )}
              {sendBusy ? t('delivery.sending') : t('delivery.sendButton')}
            </button>
          </div>
        </div>
        <p className="delivery-footnote">{t('delivery.sendNote')}</p>
      </div>
    );
  };

  const renderSettingsTab = () => (
    <div className="delivery-settings">
      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.provider')}</span>
            <h3>{t('delivery.providerResend')}</h3>
          </div>
          <span className="delivery-provider-badge">
            <span className="delivery-provider-dot" />
            {t('delivery.providerResend')}
          </span>
        </div>
        <p className="delivery-note">{t('delivery.providerReady')}</p>
      </section>

      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.keySection')}</span>
            <h3>{t('delivery.keyTitle')}</h3>
          </div>
          <div className="delivery-connection-state">
            <span
              className={`delivery-connection-dot ${
                statusError ? 'is-error' : status ? 'is-on' : 'is-off'
              }`}
            />
            <span>
              {statusLoading
                ? t('delivery.loading')
                : status
                  ? t('delivery.connected')
                  : t('delivery.notConnected')}
            </span>
          </div>
        </div>

        {statusError && (
          <div className="delivery-error" role="alert">
            <AlertCircle size={14} strokeWidth={2.2} />
            <div>
              <p>{statusError}</p>
              <button type="button" className="text-btn" onClick={() => void loadStatus(resendKey || undefined)}>
                {t('delivery.retry')}
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className="delivery-connection-meta">
            <span>
              {status.keySource === 'server'
                ? t('delivery.serverKey')
                : t('delivery.panelKey')}
            </span>
            <span className="delivery-dot-sep" />
            <span>
              {status.restricted ? t('delivery.restricted') : t('delivery.fullAccess')}
            </span>
            {status.restricted && (
              <span className="delivery-muted">{t('delivery.fullAccessHint')}</span>
            )}
          </div>
        )}

        <form className="delivery-key-form" onSubmit={(event) => void handleConnectKey(event)}>
          <label className="key-label" htmlFor="resend-key">
            <span>{t('delivery.keyTitle')}</span>
            <a
              className="delivery-help-link"
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              {t('delivery.openApiKeys')}
            </a>
          </label>
          <div className={`key-input-wrap ${keyError ? 'has-error' : ''}`}>
            <KeyRound size={15} strokeWidth={2} />
            <input
              id="resend-key"
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(event) => {
                setKeyInput(event.target.value);
                setKeyError(null);
              }}
              placeholder={keyInput ? t('delivery.keyPlaceholder') : status?.keySource === 'client' ? '••••••••' : t('delivery.keyPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              disabled={keyBusy}
            />
            <button
              type="button"
              className="icon-btn key-eye"
              onClick={() => setShowKey((previous) => !previous)}
              aria-label={showKey ? t('key.hide') : t('key.show')}
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
            </button>
          </div>
          {keyError && (
            <div className="delivery-inline-error" role="alert">
              {keyError}
            </div>
          )}
          <p className="delivery-note">{t('delivery.keyHelp')}</p>
          <div className="delivery-key-actions">
            <button type="submit" className="btn btn-primary btn-small" disabled={!keyInput.trim() || keyBusy}>
              {keyBusy ? (
                <Loader2 size={13} className="is-spinning" />
              ) : (
                <KeyRound size={13} strokeWidth={2.2} />
              )}
              {keyBusy ? t('delivery.keyValidating') : t('delivery.keyValidate')}
            </button>
            {serverKeyConfigured && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={handleUseServerKey}
                disabled={keyBusy}
              >
                <Server size={13} strokeWidth={2} />
                {t('delivery.keyUseServer')}
              </button>
            )}
            {resendKey && (
              <button
                type="button"
                className="delivery-remove-key"
                onClick={handleRemoveKey}
                disabled={keyBusy}
              >
                {t('delivery.keyRemove')}
              </button>
            )}
          </div>
        </form>
        <div className="delivery-security-note">
          <ShieldCheck size={13} strokeWidth={2} />
          <span>{t('delivery.security')}</span>
        </div>
      </section>

      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.providerResend')}</span>
            <h3>{t('delivery.domainsTitle')}</h3>
          </div>
          <div className="delivery-section-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void loadStatus(resendKey || undefined)}
              disabled={statusLoading}
              title={t('delivery.domainsRefresh')}
              aria-label={t('delivery.domainsRefresh')}
            >
              <RefreshCw size={13} className={statusLoading ? 'is-spinning' : ''} />
            </button>
            <a
              className="delivery-help-link"
              href="https://resend.com/domains"
              target="_blank"
              rel="noreferrer"
            >
              {t('delivery.addDomain')}
            </a>
          </div>
        </div>

        {status?.restricted ? (
          <p className="delivery-inline-warning">{t('delivery.domainsRestricted')}</p>
        ) : status?.domains.length ? (
          <div className="delivery-domain-list" aria-label={t('delivery.domainAria')}>
            {status.domains.map((domain) => (
              <div className="delivery-domain" key={domain.id}>
                <div className="delivery-domain-main">
                  <Globe size={14} strokeWidth={2} />
                  <strong>{domain.name}</strong>
                  <DomainStatus domain={domain} />
                </div>
                <div className="delivery-domain-actions">
                  {domain.region && <span className="delivery-muted">{domain.region}</span>}
                  {domain.status !== 'verified' && (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => void handleVerifyDomain(domain.id)}
                      disabled={Boolean(domainBusyId)}
                    >
                      {domainBusyId === domain.id ? (
                        <Loader2 size={12} className="is-spinning" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      {domainBusyId === domain.id
                        ? t('delivery.domainVerifying')
                        : t('delivery.domainVerify')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="delivery-note">
            {statusLoading ? t('delivery.loading') : t('delivery.domainsEmpty')}
          </p>
        )}
        <p className="delivery-note">{t('delivery.domainsHint')}</p>
        {domainMessage && <p className="delivery-success-text">{domainMessage}</p>}
        {domainError && <p className="delivery-inline-error">{domainError}</p>}
      </section>

      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.tabs.send')}</span>
            <h3>{t('delivery.senderTitle')}</h3>
          </div>
        </div>
        <div className="delivery-form-grid">
          <label className="field">
            <span className="field-label">{t('delivery.fromName')}</span>
            <input
              type="text"
              value={fromName}
              onChange={(event) => setFromName(event.target.value.slice(0, 80))}
              placeholder="PolySend"
            />
          </label>
          <label className="field">
            <span className="field-label">{t('delivery.fromEmail')}</span>
            <input
              type="email"
              value={fromEmail}
              onChange={(event) => setFromEmail(event.target.value)}
              placeholder="hello@mail.yourdomain.com"
              autoComplete="off"
              list="polysend-sender-options"
            />
            <datalist id="polysend-sender-options">
              {verifiedDomains.flatMap((domain) => [
                <option key={`hello-${domain.id}`} value={`hello@${domain.name}`} />,
                <option key={`noreply-${domain.id}`} value={`noreply@${domain.name}`} />,
              ])}
            </datalist>
          </label>
          <label className="field">
            <span className="field-label">{t('delivery.replyTo')}</span>
            <input
              type="email"
              value={replyTo}
              onChange={(event) => setReplyTo(event.target.value)}
              placeholder={fromEmail || 'you@yourdomain.com'}
              autoComplete="off"
            />
          </label>
        </div>
        {showFromWarning && (
          <div className="delivery-inline-warning">
            <AlertCircle size={13} strokeWidth={2.2} />
            <span>{t('delivery.fromNotVerified')}</span>
          </div>
        )}
        <p className="delivery-note">{t('delivery.replyHint')}</p>
        <p className="delivery-autosave">{t('delivery.autosave')}</p>
      </section>

      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.providerResend')}</span>
            <h3>{t('delivery.testTitle')}</h3>
          </div>
        </div>
        <p className="delivery-note">{t('delivery.testBody')}</p>
        <div className="delivery-test-row">
          <input
            type="email"
            value={testTo}
            onChange={(event) => {
              setTestTo(event.target.value);
              setTestError(null);
              setTestMessage(null);
            }}
            placeholder={t('delivery.testTo')}
            aria-label={t('delivery.testTo')}
          />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => void handleTest()}
            disabled={testBusy || !testTo.trim() || !isValidEmail(fromEmail) || !status}
          >
            {testBusy ? (
              <Loader2 size={13} className="is-spinning" />
            ) : (
              <Send size={13} strokeWidth={2} />
            )}
            {testBusy ? t('delivery.testing') : t('delivery.testButton')}
          </button>
        </div>
        {testMessage && <p className="delivery-success-text">{testMessage}</p>}
        {testError && <p className="delivery-inline-error">{testError}</p>}
        <p className="delivery-autosave">{t('delivery.testNote')}</p>
      </section>

      <section className="delivery-section">
        <div className="delivery-section-head">
          <div>
            <span className="eyebrow">{t('delivery.providerResend')}</span>
            <h3>{t('delivery.historyTitle')}</h3>
          </div>
          <div className="delivery-section-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              title={t('delivery.historyRefresh')}
              aria-label={t('delivery.historyRefresh')}
            >
              <RefreshCw size={13} className={historyLoading ? 'is-spinning' : ''} />
            </button>
            <a
              className="delivery-help-link"
              href="https://resend.com/emails"
              target="_blank"
              rel="noreferrer"
            >
              {t('delivery.viewDashboard')}
            </a>
          </div>
        </div>

        {historyError && (
          <p className="delivery-inline-error">
            {historyError}
            {status?.restricted ? ` ${t('delivery.historyFullAccess')}` : ''}
          </p>
        )}

        {history.length ? (
          <div className="delivery-history">
            {history.map((item) => {
              const busy = refreshingId === item.id;
              return (
                <div className="delivery-history-item" key={item.id}>
                  <div className="delivery-history-main">
                    <div className="delivery-history-subject">{item.subject}</div>
                    <div className="delivery-history-meta">
                      <span>{item.to}</span>
                      <span className="delivery-dot-sep" />
                      <span>{formatRelative(item.createdAt, locale)}</span>
                      <span className={`delivery-event event-${eventTone(item)}`}>
                        {eventLabel(item, t)}
                      </span>
                    </div>
                  </div>
                  <div className="delivery-history-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleCopyId(item.id)}
                      title={t('delivery.copyId')}
                      aria-label={t('delivery.copyId')}
                    >
                      {copiedId === item.id ? (
                        <Check size={13} strokeWidth={2.4} />
                      ) : (
                        <Copy size={13} strokeWidth={2} />
                      )}
                    </button>
                    {!status?.restricted && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void handleRefreshHistory(item.id)}
                        disabled={Boolean(refreshingId)}
                        title={t('delivery.historyRefresh')}
                        aria-label={t('delivery.historyRefresh')}
                      >
                        <RefreshCw size={13} className={busy ? 'is-spinning' : ''} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !historyLoading && (
            <p className="delivery-note">
              {historyError ? t('delivery.historyError') : t('delivery.historyEmpty')}
            </p>
          )
        )}
        {status?.restricted && (
          <p className="delivery-note">{t('delivery.historyFullAccess')}</p>
        )}
      </section>
    </div>
  );

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="delivery-modal modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-modal-title"
      >
        <div className="modal-head delivery-head">
          <span className="modal-icon">
            <MailCheck size={19} strokeWidth={2} />
          </span>
          <div className="modal-heading">
            <span className="eyebrow">{t('delivery.eyebrow')}</span>
            <h2 id="delivery-modal-title">{t('delivery.title')}</h2>
          </div>
          <span className="delivery-head-provider">
            <span className="delivery-provider-dot" />
            {t('delivery.providerResend')}
          </span>
          <button
            type="button"
            className="icon-btn modal-close"
            onClick={close}
            disabled={isBusy}
            aria-label={t('key.close')}
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <div className="delivery-tabs" role="tablist" aria-label={t('delivery.title')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'send'}
            className={tab === 'send' ? 'is-active' : ''}
            onClick={() => setTab('send')}
          >
            <Send size={14} strokeWidth={2.2} />
            {t('delivery.tabs.send')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'settings'}
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => setTab('settings')}
          >
            <KeyRound size={14} strokeWidth={2.2} />
            {t('delivery.tabs.settings')}
          </button>
        </div>

        <div className="delivery-body">
          {tab === 'send' ? renderSendTab() : renderSettingsTab()}
        </div>
      </div>
    </div>
  );
}
