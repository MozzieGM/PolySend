import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  Cpu,
  Download,
  FileText,
  ImageOff,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  formatBytes,
  formatDayLabel,
  formatMessageTime,
  formatUSD,
  sameDay,
} from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { whatsAppAvatarUrl } from '../../lib/whatsapp';
import type {
  Model,
  WhatsAppChat,
  WhatsAppMessage,
} from '../../types';
import { WhatsAppAvatar } from './WhatsAppAvatar';

function mediaSource(message: WhatsAppMessage): string {
  if (message.media?.url) return message.media.url;
  return `/api/whatsapp/media/${encodeURIComponent(message.id)}`;
}

function WhatsAppMediaContent({
  message,
  onOpen,
}: {
  message: WhatsAppMessage;
  onOpen: (src: string) => void;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const media = message.media;
  if (!media) return null;
  const src = mediaSource(message);

  if (failed) {
    return (
      <div className="wa-media-failed">
        <ImageOff size={16} strokeWidth={1.8} />
        <span>{t('whatsapp.mediaUnavailable')}</span>
      </div>
    );
  }

  if (media.kind === 'image' || media.kind === 'sticker') {
    return (
      <button
        type="button"
        className={`wa-media-image ${media.kind === 'sticker' ? 'is-sticker' : ''}`}
        onClick={() => onOpen(src)}
        title={message.text || media.fileName || 'Photo'}
      >
        <img
          src={src}
          alt={message.text || media.fileName || 'Photo'}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </button>
    );
  }

  if (media.kind === 'video') {
    return (
      <video
        className="wa-media-video"
        src={src}
        controls
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  if (media.kind === 'audio') {
    return (
      <div className="wa-media-audio">
        <audio src={src} controls preload="metadata" onError={() => setFailed(true)} />
        {media.seconds != null && (
          <span>
            {media.ptt ? 'Voice' : 'Audio'} · {Math.round(media.seconds)}s
          </span>
        )}
      </div>
    );
  }

  return (
    <a
      className="wa-media-doc"
      href={src}
      download={media.fileName || 'document'}
      target="_blank"
      rel="noreferrer"
    >
      <span className="wa-doc-icon">
        <FileText size={17} strokeWidth={1.9} />
      </span>
      <span className="wa-doc-copy">
        <strong>{media.fileName || 'Document'}</strong>
        <small>
          {[media.mimetype?.split('/').pop()?.toUpperCase(), formatBytes(media.fileLength)]
            .filter(Boolean)
            .join(' · ')}
        </small>
      </span>
      <Download size={14} strokeWidth={2} />
    </a>
  );
}

interface WhatsAppConversationProps {
  chat: WhatsAppChat;
  messages: WhatsAppMessage[];
  model: Model | null;
  draft: string;
  sending: boolean;
  aiStreaming: boolean;
  loading: boolean;
  mock: boolean;
  error: string | null;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onOpenAi: () => void;
  onOpenProfile: () => void;
  onOpenModels: () => void;
  onBack: () => void;
}

export function WhatsAppConversation({
  chat,
  messages,
  model,
  draft,
  sending,
  aiStreaming,
  loading,
  mock,
  error,
  onDraftChange,
  onSend,
  onOpenAi,
  onOpenProfile,
  onOpenModels,
  onBack,
}: WhatsAppConversationProps) {
  const { locale, t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

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
        <button
          type="button"
          className="wa-conv-profile"
          onClick={onOpenProfile}
          title={t('whatsapp.profileAria')}
        >
          <WhatsAppAvatar
            name={chat.name}
            color={chat.color}
            isGroup={chat.isGroup}
            size={38}
            online
            imageUrl={mock ? null : whatsAppAvatarUrl(chat.id)}
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
        </button>
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
                    } ${message.media?.kind === 'sticker' ? 'is-sticker' : ''}`}
                    key={message.id}
                  >
                    <div className="wa-bubble">
                      {!own && chat.isGroup && (
                        <span className="wa-bubble-sender">{message.senderName}</span>
                      )}
                      {message.media ? (
                        <>
                          <WhatsAppMediaContent message={message} onOpen={setLightbox} />
                          {message.text && <p className="wa-media-caption">{message.text}</p>}
                        </>
                      ) : (
                        <p>{message.text}</p>
                      )}
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
          <button
            type="button"
            className="wa-composer-model"
            onClick={onOpenModels}
            title={t('whatsapp.changeModel')}
          >
            <Cpu size={10} strokeWidth={2.1} />
            <span>{model?.name ?? t('whatsapp.aiNoModel')}</span>
            {model?.free && <b>{t('models.badgeFree')}</b>}
            {model && (
              <small>
                {formatUSD(model.price.input, 2)}→{formatUSD(model.price.output, 2)}/1M
              </small>
            )}
            <ChevronDown size={9} strokeWidth={2.2} />
          </button>
          <span>{t('whatsapp.sendHint')}</span>
        </div>
      </footer>

      {lightbox && (
        <div
          className="wa-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="wa-lightbox-close"
            aria-label={t('key.close')}
            onClick={(event) => {
              event.stopPropagation();
              setLightbox(null);
            }}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
          <img
            src={lightbox}
            alt=""
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
