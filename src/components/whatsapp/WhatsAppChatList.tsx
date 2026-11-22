import { useMemo } from 'react';
import {
  AlertCircle,
  History,
  Loader2,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatShortTime, truncate } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import type { WhatsAppChat, WhatsAppMe, WhatsAppStatus } from '../../types';
import { WhatsAppAvatar } from './WhatsAppAvatar';

interface WhatsAppChatListProps {
  chats: WhatsAppChat[];
  me: WhatsAppMe | null;
  status: WhatsAppStatus | null;
  activeJid: string | null;
  query: string;
  loading: boolean;
  error: string | null;
  onQuery: (value: string) => void;
  onSelect: (jid: string) => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onReimport: () => void;
}

export function WhatsAppChatList({
  chats,
  me,
  status,
  activeJid,
  query,
  loading,
  error,
  onQuery,
  onSelect,
  onDisconnect,
  onRefresh,
  onReimport,
}: WhatsAppChatListProps) {
  const { locale, t } = useI18n();
  const syncing = Boolean(status?.history?.syncing);
  const progress =
    typeof status?.history?.progress === 'number' ? status.history.progress : null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(term) ||
        chat.lastMessage.toLowerCase().includes(term),
    );
  }, [chats, query]);

  return (
    <aside className="wa-sidebar">
      <div className="wa-sidebar-head">
        <div className="wa-brand">
          <span className="wa-brand-icon">
            <MessageCircle size={18} strokeWidth={2.1} />
          </span>
          <div className="wa-brand-copy">
            <span className="eyebrow">WhatsApp</span>
            <strong>{me?.name || t('whatsapp.title')}</strong>
          </div>
          <span
            className={`wa-live-dot ${status?.state === 'connected' ? 'is-on' : ''}`}
            aria-hidden="true"
          />
          {status?.mock && <span className="wa-demo-badge">{t('whatsapp.demoBadge')}</span>}
        </div>

        <div className="wa-sidebar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onRefresh}
            title={t('whatsapp.refresh')}
            aria-label={t('whatsapp.refresh')}
          >
            <RefreshCw size={13} className={loading ? 'is-spinning' : ''} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onDisconnect}
            title={t('whatsapp.disconnect')}
            aria-label={t('whatsapp.disconnect')}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      <label className="wa-search">
        <Search size={13} strokeWidth={2.2} />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('whatsapp.searchChats')}
          aria-label={t('whatsapp.searchChats')}
        />
      </label>

      {syncing && (
        <div className="wa-sync" role="status">
          <div className="wa-sync-line">
            <Loader2 size={11} className="is-spinning" />
            <span>{t('whatsapp.syncingHistory')}</span>
            {progress != null && <b>{Math.round(progress)}%</b>}
          </div>
          <span className={`wa-sync-track ${progress == null ? 'is-indeterminate' : ''}`}>
            <i
              style={
                progress == null
                  ? undefined
                  : { width: `${Math.min(100, Math.max(4, progress))}%` }
              }
            />
          </span>
        </div>
      )}

      {error && (
        <div className="wa-list-error" role="alert">
          <AlertCircle size={12} strokeWidth={2.2} />
          <span>{error}</span>
        </div>
      )}

      <div className="wa-chat-list">
        {loading && !chats.length
          ? [0, 1, 2, 3].map((item) => (
              <div className="wa-chat-skeleton" key={item}>
                <span />
                <div>
                  <i />
                  <i />
                </div>
              </div>
            ))
          : filtered.map((chat) => {
              const active = chat.id === activeJid;
              return (
                <button
                  type="button"
                  key={chat.id}
                  className={`wa-chat-item ${active ? 'is-active' : ''}`}
                  onClick={() => onSelect(chat.id)}
                >
                  <WhatsAppAvatar
                    name={chat.name}
                    color={chat.color}
                    isGroup={chat.isGroup}
                    size={42}
                  />
                  <div className="wa-chat-copy">
                    <div className="wa-chat-line">
                      <strong>{chat.name}</strong>
                      <span>{chat.lastMessageAt ? formatShortTime(chat.lastMessageAt, locale) : ''}</span>
                    </div>
                    <div className="wa-chat-preview">
                      <p>
                        {chat.lastMessageFromMe && (
                          <span className="wa-chat-you">{t('whatsapp.you')}: </span>
                        )}
                        {truncate(chat.lastMessage, 46) || t('whatsapp.noMessages')}
                      </p>
                      {chat.unread > 0 ? (
                        <b>{chat.unread > 99 ? '99+' : chat.unread}</b>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
      </div>

      {!loading && !filtered.length && (
        <div className="wa-chat-empty">
          {syncing ? (
            <Loader2 size={22} className="is-spinning" />
          ) : (
            <MessageCircle size={22} strokeWidth={1.7} />
          )}
          <strong>
            {query
              ? t('whatsapp.searchEmpty')
              : syncing
                ? t('whatsapp.syncingHistory')
                : t('whatsapp.noChats')}
          </strong>
          {!query && (
            <span>{syncing ? t('whatsapp.syncingHistoryHint') : t('whatsapp.importHistoryHint')}</span>
          )}
          {!query && !syncing && (
            <button type="button" className="wa-import-history" onClick={onReimport}>
              <History size={12} strokeWidth={2.2} />
              {t('whatsapp.importHistory')}
            </button>
          )}
        </div>
      )}

      <div className="wa-sidebar-foot">
        <span className={`wa-foot-dot ${status?.state === 'connected' ? 'is-on' : ''}`} />
        <div>
          <span>
            {status?.state === 'connected'
              ? t('whatsapp.connected')
              : status?.state === 'qr' || status?.state === 'connecting'
                ? t('whatsapp.connectingState')
                : t('whatsapp.disconnected')}
          </span>
          {me && (
            <small>
              {t('whatsapp.connectedAs', { name: me.name })}
              {me.number ? ` · ${me.number}` : ''}
            </small>
          )}
        </div>
        {loading && chats.length > 0 && <Loader2 size={12} className="is-spinning" />}
      </div>
    </aside>
  );
}
