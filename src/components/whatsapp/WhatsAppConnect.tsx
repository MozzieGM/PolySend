import {
  AlertCircle,
  ArrowRight,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import type { WhatsAppStatus } from '../../types';

interface WhatsAppConnectProps {
  status: WhatsAppStatus | null;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
}

export function WhatsAppConnect({
  status,
  loading,
  error,
  onConnect,
}: WhatsAppConnectProps) {
  const { t } = useI18n();
  const state = status?.state ?? 'disconnected';
  const hasQr = Boolean(status?.qr);
  const waiting = loading || state === 'connecting';

  return (
    <section className="wa-connect-shell">
      <div className="wa-connect-card">
        <div className="wa-connect-main">
          <div className="wa-connect-brand">
            <span className="wa-connect-mark">
              <MessageCircle size={21} strokeWidth={2.1} />
            </span>
            <div>
              <span className="eyebrow">{t('whatsapp.eyebrow')}</span>
              <h1>{t('whatsapp.connectTitle')}</h1>
            </div>
          </div>

          <p className="wa-connect-body">{t('whatsapp.connectBody')}</p>

          <ol className="wa-connect-steps">
            <li>
              <span>01</span>
              <Smartphone size={15} strokeWidth={2} />
              <p>{t('whatsapp.qrStep1')}</p>
            </li>
            <li>
              <span>02</span>
              <ArrowRight size={15} strokeWidth={2} />
              <p>{t('whatsapp.qrStep2')}</p>
            </li>
            <li>
              <span>03</span>
              <QrCode size={15} strokeWidth={2} />
              <p>{t('whatsapp.qrStep3')}</p>
            </li>
          </ol>

          <div className="wa-connect-security">
            <ShieldCheck size={14} strokeWidth={2} />
            <span>{t('whatsapp.sessionNote')}</span>
          </div>

          <div className="wa-connect-warning">
            <AlertCircle size={14} strokeWidth={2} />
            <span>{t('whatsapp.unofficial')}</span>
          </div>
        </div>

        <div className="wa-connect-side">
          <div className={`wa-qr-frame ${hasQr ? 'has-qr' : ''}`}>
            {hasQr ? (
              <img
                className="wa-qr-image"
                src={status?.qr ?? ''}
                alt={t('whatsapp.qrTitle')}
                draggable={false}
              />
            ) : (
              <div className="wa-qr-placeholder">
                {waiting ? (
                  <Loader2 size={26} className="is-spinning" />
                ) : (
                  <QrCode size={30} strokeWidth={1.6} />
                )}
                <strong>{waiting ? t('whatsapp.connecting') : t('whatsapp.qrTitle')}</strong>
                <span>{t('whatsapp.qrRefresh')}</span>
              </div>
            )}
          </div>

          {state === 'logged_out' && (
            <p className="wa-connect-status">{t('whatsapp.loggedOut')}</p>
          )}

          {error && (
            <div className="wa-connect-error" role="alert">
              <AlertCircle size={14} strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          {hasQr ? (
            <p className="wa-connect-status">{t('whatsapp.qrRefresh')}</p>
          ) : (
            <button
              type="button"
              className="btn btn-primary wa-connect-button"
              onClick={onConnect}
              disabled={waiting}
            >
              {waiting ? (
                <Loader2 size={15} className="is-spinning" />
              ) : (
                <MessageCircle size={15} strokeWidth={2.2} />
              )}
              {waiting
                ? t('whatsapp.connecting')
                : state === 'logged_out'
                  ? t('whatsapp.scanAgain')
                  : t('whatsapp.connectButton')}
            </button>
          )}

          {!hasQr && !waiting && (
            <button type="button" className="wa-connect-retry" onClick={onConnect}>
              <RefreshCw size={12} strokeWidth={2.2} />
              {t('whatsapp.refresh')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
