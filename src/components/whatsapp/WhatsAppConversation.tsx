import { useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  formatDayLabel,
  formatMessageTime,
  sameDay,
} from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import type {
  WhatsAppChat,
  WhatsAppMe,
  WhatsAppMessage,
} from '../../types';
import { WhatsAppAvatar } from './WhatsAppAvatar';

interface WhatsAppConversationProps {
  chat: WhatsAppChat;
  messages: WhatsAppMessage[];
  me: WhatsAppMe | null;
  draft: string;
  sending: boolean;
  aiStreaming: boolean;
  loading: boolean;
  error: string | null;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onOpenAi: () => void;
  onBack: () => void;
}

export function WhatsAppConversation({
  chat,
  messages,
  me,
  draft,
  sending,
  aiStreaming,
  loading,
  error,
  onDraftChange,
  onSend,
  onOpenAi,
  onBack,
}: WhatsAppConversationProps) {
  const { locale, t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const groups = useMemo(() => {
    const result: { day: number; items: WhatsAppMessage[] }[] = [];
    for (const message of messages) {
      const last = result[result.length - 1];
      if (last && sameDay(last.day, message.timestamp)) last.items.push(message);
      else result.push({ day: message.timestamp, items: [message] });
    }
    return result;
  }, [messages]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length, chat.id]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(132, element.scrollHeight)}px`;
  }, [draft]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <section className="wa-conversation">
      <header className="wa-conv-head">
        <button
          type="button"
          className="icon-btn wa-back"
          onClick={onBack}
          title={t('whatsapp.back')}
          aria-label={t('whatsapp.back')}
        >
          <ArrowLeft size={16} strokeWidth={2.2} />
        </button>
        <WhatsAppAvatar
          name={chat.name}
          color={chat.color}
          isGroup={chat.isGroup}
          size={38}
          online
        />
        <div className="wa-conv-title">
          <strong>{chat.name}</strong>
          <span>
            <i className={`wa-conv-dot ${aiStreaming ? 'is-ai' : ''}`} />
            {aiStreaming
              ? t('whatsapp.aiWriting')
              : chat.isGroup
                ? t('whatsapp.group')
                : 'WhatsApp'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost wa-conv-ai"
          onClick={onOpenAi}
          title={t('whatsapp.openAi')}
        >
          <Sparkles size={14} strokeWidth={2.2} />
          <span>AI</span>
        </button>
      </header>

      <div className="wa-messages" ref={scrollRef}>
        {loading && !messages.length ? (
          <div className="wa-messages-loading">
            <Loader2 size={18} className="is-spinning" />
            <span>{t('whatsapp.aiWriting')}</span>
          </div>
        ) : messages.length ? (
          groups.map((group) => (
            <div className="wa-day-group" key={group.day}>
              <div className="wa-day-label">
                <span>{formatDayLabel(group.day, locale)}</span>
              </div>
              {group.items.map((message) => {
                const own = message.fromMe;
                return (
                  <div
                    className={`wa-message ${own ? 'is-own' : 'is-incoming'} ${
                      message.type === 'media' ? 'is-media' : ''
                    }`}
                    key={message.id}
                  >
                    <div className="wa-bubble">
                      {!own && chat.isGroup && (
                        <span className="wa-bubble-sender">{message.senderName}</span>
                      )}
                      <p>{message.text}</p>
                      <span className="wa-bubble-meta">
                        {formatMessageTime(message.timestamp, locale)}
                        {own && <CheckCheck size={11} strokeWidth={2.2} />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="wa-messages-empty">
            <MessageCircle size={24} strokeWidth={1.6} />
            <span>{t('whatsapp.noMessages')}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="wa-composer-error" role="alert">
          {error}
        </div>
      )}

      {aiStreaming && (
        <button type="button" className="wa-ai-typing" onClick={onOpenAi}>
          <Sparkles size={12} strokeWidth={2.2} />
          <span>{t('whatsapp.aiWriting')}</span>
          <i />
          <i />
          <i />
        </button>
      )}

      <footer className="wa-composer-wrap">
        <div className={`wa-composer ${aiStreaming ? 'is-ai' : ''}`}>
          <button
            type="button"
            className="wa-composer-ai"
            onClick={onOpenAi}
            title={t('whatsapp.openAi')}
            aria-label={t('whatsapp.openAi')}
          >
            <Sparkles size={16} strokeWidth={2.1} />
          </button>
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('whatsapp.messagePlaceholder')}
            rows={1}
          />
          <button
            type="button"
            className="wa-send"
            onClick={onSend}
            disabled={!draft.trim() || sending}
            title={t('whatsapp.send')}
            aria-label={t('whatsapp.send')}
          >
            {sending ? (
              <Loader2 size={15} className="is-spinning" />
            ) : (
              <Send size={15} strokeWidth={2.2} />
            )}
          </button>
        </div>
        <div className="wa-composer-foot">
          <span>{t('whatsapp.sendHint')}</span>
          {me && <span>{me.name}</span>}
        </div>
      </footer>
    </section>
  );
}
