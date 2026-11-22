import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  Info,
  Loader2,
  Phone,
  Users,
  X,
} from 'lucide-react';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { fetchWhatsAppProfile } from '../../lib/whatsapp';
import type { WhatsAppProfile } from '../../types';
import { WhatsAppAvatar } from './WhatsAppAvatar';

interface WhatsAppProfileModalProps {
  jid: string;
  blurred?: boolean;
  onClose: () => void;
}

function ProfileRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="wa-profile-row">
      <span className="wa-profile-row-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong className={mono ? 'is-mono' : ''}>{value}</strong>
      </div>
    </div>
  );
}

export function WhatsAppProfileModal({
  jid,
  blurred = false,
  onClose,
}: WhatsAppProfileModalProps) {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);

    void fetchWhatsAppProfile(jid)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jid, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyValue = () => {
    const value = profile?.number || profile?.jid;
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };

  const createdLabel =
    profile?.createdAt != null
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(profile.createdAt),
        )
      : null;

  return (
    <div
      className="wa-profile-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`wa-profile-card ${blurred ? 'is-blurred' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="icon-btn wa-profile-close"
          onClick={onClose}
          aria-label={t('key.close')}
        >
          <X size={16} strokeWidth={2.2} />
        </button>

        {loading ? (
          <div className="wa-profile-loading">
            <Loader2 size={20} className="is-spinning" />
            <span>{t('whatsapp.profileLoading')}</span>
          </div>
        ) : error ? (
          <div className="wa-profile-error">
            <AlertCircle size={18} strokeWidth={2} />
            <strong>{t('whatsapp.profileError')}</strong>
            <span>{error}</span>
          </div>
        ) : profile ? (
          <>
            <div className="wa-profile-hero">
              <WhatsAppAvatar
                name={profile.name}
                color="#c8f751"
                isGroup={profile.isGroup}
                size={92}
                imageUrl={profile.avatarUrl}
              />
              <span className="eyebrow">{t('whatsapp.profileEyebrow')}</span>
              <h2>{profile.name}</h2>
              <p>
                {profile.isGroup
                  ? t('whatsapp.group')
                  : profile.isSelf
                    ? t('whatsapp.myProfile')
                    : profile.number || t('whatsapp.whatsappId')}
              </p>
              <button type="button" className="btn btn-ghost btn-small" onClick={copyValue}>
                {copied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2} />}
                {copied ? t('whatsapp.copied') : t('whatsapp.copy')}
              </button>
            </div>

            <div className="wa-profile-body">
              {!profile.isGroup && (
                <>
                  <ProfileRow
                    icon={<Phone size={14} strokeWidth={2} />}
                    label={t('whatsapp.phone')}
                    value={profile.number || t('whatsapp.whatsappId')}
                    mono={Boolean(profile.number)}
                  />
                  {profile.isLid && (
                    <ProfileRow
                      icon={<Info size={14} strokeWidth={2} />}
                      label={t('whatsapp.whatsappId')}
                      value={profile.jid.split('@')[0]}
                      mono
                    />
                  )}
                  <ProfileRow
                    icon={<Info size={14} strokeWidth={2} />}
                    label={t('whatsapp.about')}
                    value={profile.about || t('whatsapp.noAbout')}
                  />
                </>
              )}

              {profile.isGroup && (
                <>
                  <ProfileRow
                    icon={<Info size={14} strokeWidth={2} />}
                    label={t('whatsapp.groupDescription')}
                    value={profile.description || t('whatsapp.noDescription')}
                  />
                  {profile.participants != null && (
                    <ProfileRow
                      icon={<Users size={14} strokeWidth={2} />}
                      label={t('whatsapp.participants')}
                      value={String(profile.participants)}
                    />
                  )}
                  {profile.owner && (
                    <ProfileRow
                      icon={<Phone size={14} strokeWidth={2} />}
                      label={t('whatsapp.groupOwner')}
                      value={profile.owner.split('@')[0]}
                      mono
                    />
                  )}
                  {createdLabel && (
                    <ProfileRow
                      icon={<Calendar size={14} strokeWidth={2} />}
                      label={t('whatsapp.createdAt')}
                      value={createdLabel}
                    />
                  )}
                </>
              )}

              {!profile.isSelf && profile.jid !== 'me' && (
                <ProfileRow
                  icon={<Info size={14} strokeWidth={2} />}
                  label="JID"
                  value={profile.jid}
                  mono
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
