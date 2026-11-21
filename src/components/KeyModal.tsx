import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface ConnectResult {
  ok: boolean;
  error?: string;
  count?: number;
}

interface KeyModalProps {
  open: boolean;
  serverKeyConfigured: boolean;
  userKeyActive: boolean;
  onClose: () => void;
  onConnect: (key: string) => Promise<ConnectResult>;
  onUseServer: () => Promise<ConnectResult>;
  onDisconnect: () => void;
}

export function KeyModal({
  open,
  serverKeyConfigured,
  userKeyActive,
  onClose,
  onConnect,
  onUseServer,
  onDisconnect,
}: KeyModalProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setShow(false);
    setError(null);
    setSuccess(null);
    setBusy(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, busy, onClose]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!open) return null;

  const finishSuccess = (message: string) => {
    setSuccess(message);
    setBusy(false);
    closeTimer.current = window.setTimeout(() => {
      onClose();
    }, 850);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!key || busy) return;

    setBusy(true);
    setError(null);
    const result = await onConnect(key);
    if (!result.ok) {
      setError(result.error ?? t('key.validationFailed'));
      setBusy(false);
      return;
    }
    finishSuccess(t('key.successModels', { count: result.count ?? 0 }));
  };

  const handleServer = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onUseServer();
    if (!result.ok) {
      setError(result.error ?? t('key.serverFailed'));
      setBusy(false);
      return;
    }
    finishSuccess(t('key.successServer'));
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-modal-title"
      >
        <div className="modal-head">
          <span className="modal-icon">
            <KeyRound size={19} strokeWidth={2} />
          </span>
          <div className="modal-heading">
            <span className="eyebrow">{t('key.eyebrow')}</span>
            <h2 id="key-modal-title">{t('key.title')}</h2>
          </div>
          <button
            type="button"
            className="icon-btn modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t('key.close')}
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <p className="modal-intro">{t('key.intro')}</p>

        {success ? (
          <div className="modal-success" role="status">
            <span className="success-check">
              <Check size={16} strokeWidth={3} />
            </span>
            <div>
              <strong>{t('key.successTitle')}</strong>
              <p>{success}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="key-form">
            <label className="key-label" htmlFor="api-key">
              <span>{t('key.label')}</span>
              {userKeyActive && <em>{t('key.already')}</em>}
            </label>
            <div className={`key-input-wrap ${error ? 'has-error' : ''}`}>
              <LockKeyhole size={15} strokeWidth={2} />
              <input
                id="api-key"
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                placeholder={t('key.placeholder')}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
              <button
                type="button"
                className="icon-btn key-eye"
                onClick={() => setShow((current) => !current)}
                aria-label={show ? t('key.hide') : t('key.show')}
                tabIndex={-1}
              >
                {show ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
              </button>
            </div>

            {error && (
              <div className="modal-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary modal-submit"
              disabled={!value.trim() || busy}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="is-spinning" />
                  {t('key.validating')}
                </>
              ) : (
                <>
                  {t('key.submit')}
                  <ArrowRight size={15} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>
        )}

        {serverKeyConfigured && !success && (
          <>
            <div className="modal-divider">
              <span>{t('key.or')}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost modal-server"
              onClick={handleServer}
              disabled={busy}
            >
              <Server size={14} strokeWidth={2} />
              {t('key.useServer')}
            </button>
          </>
        )}

        {userKeyActive && !success && (
          <button type="button" className="modal-disconnect" onClick={onDisconnect} disabled={busy}>
            {t('key.remove')}
          </button>
        )}

        <div className="modal-help">
          <span className="modal-help-title">{t('key.helpTitle')}</span>
          <ol>
            <li>
              {t('key.help1Before')}
              <a href="https://opencode.ai/console" target="_blank" rel="noreferrer">
                {t('key.consoleLink')} <ArrowRight size={10} />
              </a>
              {t('key.help1After')}
            </li>
            <li>
              {t('key.help2Before')}
              <strong>{t('key.accountLink')}</strong>
              {t('key.help2After')}
            </li>
            <li>{t('key.help3')}</li>
          </ol>
        </div>

        <div className="modal-security">
          <ShieldCheck size={15} strokeWidth={2} />
          <p>{t('key.security')}</p>
        </div>
      </div>
    </div>
  );
}
