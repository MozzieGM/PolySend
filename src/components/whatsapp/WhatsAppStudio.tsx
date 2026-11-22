import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import {
  clearWhatsAppCache,
  connectWhatsApp,
  detectMessageLanguage,
  fetchWhatsAppChats,
  fetchWhatsAppMessages,
  fetchWhatsAppStatus,
  logoutWhatsApp,
  sendWhatsAppMessage,
  streamWhatsAppMessage,
  subscribeWhatsAppEvents,
} from '../../lib/whatsapp';
import { errorMessage } from '../../lib/errors';
import { pickReasoningEffort } from '../../lib/models';
import { useI18n } from '../../lib/i18n';
import type {
  EmailLength,
  Language,
  Model,
  StreamUsage,
  Tone,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppStatus,
} from '../../types';
import { WhatsAppChatList } from './WhatsAppChatList';
import { WhatsAppConnect } from './WhatsAppConnect';
import { WhatsAppConversation } from './WhatsAppConversation';
import { WhatsAppCopilot } from './WhatsAppCopilot';
import { WhatsAppProfileModal } from './WhatsAppProfileModal';

interface WhatsAppStudioProps {
  storedKey: string;
  hasKey: boolean;
  models: Model[];
  selectedModel: Model | null;
  onModelChange: (id: string) => void;
  onOpenKey: () => void;
}

function replaceChat(list: WhatsAppChat[], chat: WhatsAppChat | null): WhatsAppChat[] {
  if (!chat) return list;
  return [chat, ...list.filter((item) => item.id !== chat.id)];
}

export function WhatsAppStudio({
  storedKey,
  hasKey,
  models,
  selectedModel,
  onModelChange,
  onOpenKey,
}: WhatsAppStudioProps) {
  const { locale, t } = useI18n();

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sseLive, setSseLive] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [activeJid, setActiveJid] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [aiInstruction, setAiInstruction] = useState('');
  const [aiTone, setAiTone] = useState<Tone>('amigavel');
  const [aiLength, setAiLength] = useState<EmailLength>('medio');
  const [aiLanguage, setAiLanguage] = useState<Language>(
    locale === 'pt-BR' ? 'pt-BR' : 'en',
  );
  const [aiDraft, setAiDraft] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<StreamUsage | null>(null);
  const [aiElapsed, setAiElapsed] = useState<number | null>(null);
  const aiAbort = useRef<AbortController | null>(null);
  const aiLanguageTouched = useRef(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat' | 'copilot'>('list');
  const [profileJid, setProfileJid] = useState<string | null>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeJid) ?? null,
    [chats, activeJid],
  );

  useEffect(() => {
    activeRef.current = activeJid;
  }, [activeJid]);

  const refreshChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError(null);
    try {
      const next = await fetchWhatsAppChats();
      setChats(
        next.map((chat) =>
          chat.id === activeRef.current ? { ...chat, unread: 0 } : chat,
        ),
      );
    } catch (error) {
      setChatsError(errorMessage(error, t));
    } finally {
      setChatsLoading(false);
    }
  }, [t]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await fetchWhatsAppStatus();
      setStatus(next);
      if (next.state === 'connected') void refreshChats();
    } catch (error) {
      setStatusError(errorMessage(error, t));
    } finally {
      setStatusLoading(false);
    }
  }, [refreshChats, t]);

  useEffect(() => {
    void refreshStatus();
    void refreshChats();
    const unsubscribe = subscribeWhatsAppEvents({
      onStatus: (next) => {
        setStatus(next);
        setStatusError(null);
        if (next.state === 'connected') void refreshChats();
      },
      onChats: (next) => {
        setChats(
          next.map((chat) =>
            chat.id === activeRef.current ? { ...chat, unread: 0 } : chat,
          ),
        );
      },
      onMessage: ({ message, chat }) => {
        if (chat) {
          const normalized =
            chat.id === activeRef.current ? { ...chat, unread: 0 } : chat;
          setChats((previous) => {
            const exists = previous.some((item) => item.id === normalized.id);
            return exists
              ? previous.map((item) => (item.id === normalized.id ? normalized : item))
              : [normalized, ...previous];
          });
        } else {
          void refreshChats();
        }

        if (message.chatId === activeRef.current) {
          setMessages((previous) =>
            previous.some((item) => item.id === message.id)
              ? previous
              : [...previous, message],
          );
        }
      },
      onOpen: () => setSseLive(true),
      onConnectionError: () => setSseLive(false),
    });

    return () => {
      unsubscribe();
    };
    // Boot once; refreshers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!status) return;
    if (status.state === 'connected' || status.state === 'logged_out') return;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [status?.state, refreshStatus]);

  useEffect(() => {
    if (status?.state !== 'connected' || sseLive) return;
    const timer = window.setInterval(() => {
      void refreshChats();
      const jid = activeRef.current;
      if (!jid) return;
      void fetchWhatsAppMessages(jid)
        .then((data) => {
          setMessages((previous) => {
            if (
              previous.length === data.messages.length &&
              previous.every((message, index) => message.id === data.messages[index].id)
            ) {
              return previous;
            }
            return data.messages;
          });
        })
        .catch(() => {
          /* the next tick retries */
        });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [status?.state, sseLive, refreshChats]);

  useEffect(() => {
    if (!activeJid) return;
    if (chats.some((chat) => chat.id === activeJid)) return;
    setActiveJid(null);
    setMessages([]);
    setMobilePane('list');
  }, [chats, activeJid]);

  useEffect(() => {
    if (!activeJid) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setMessagesLoading(true);
    setMessagesError(null);
    setDraft('');
    setSendError(null);
    setAiDraft('');
    setAiError(null);
    setAiUsage(null);
    setAiElapsed(null);
    setAiInstruction('');
    aiLanguageTouched.current = false;

    void fetchWhatsAppMessages(activeJid)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        const detected = detectMessageLanguage(data.messages);
        if (detected && !aiLanguageTouched.current) setAiLanguage(detected);
        setChats((previous) =>
          previous.map((chat) =>
            chat.id === activeJid ? { ...chat, unread: 0 } : chat,
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) setMessagesError(errorMessage(error, t));
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeJid, t]);

  useEffect(() => {
    return () => {
      aiAbort.current?.abort();
    };
  }, []);

  const handleConnect = async () => {
    if (connectBusy) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      const next = await connectWhatsApp();
      setStatus(next);
      if (next.state === 'connected') {
        setMobilePane('list');
        void refreshChats();
      }
    } catch (error) {
      setConnectError(errorMessage(error, t));
    } finally {
      setConnectBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('whatsapp.disconnectConfirm'))) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      const next = await logoutWhatsApp();
      setStatus(next);
      setChats([]);
      setActiveJid(null);
      setMessages([]);
      setMobilePane('list');
    } catch (error) {
      setConnectError(errorMessage(error, t));
    } finally {
      setConnectBusy(false);
    }
  };

  const handleReimport = async () => {
    if (!window.confirm(t('whatsapp.reimportConfirm'))) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      await logoutWhatsApp();
      setChats([]);
      setActiveJid(null);
      setMessages([]);
      setMobilePane('list');
      const next = await connectWhatsApp();
      setStatus(next);
    } catch (error) {
      setConnectError(errorMessage(error, t));
    } finally {
      setConnectBusy(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm(t('whatsapp.clearCacheConfirm'))) return;
    setChatsLoading(true);
    setChatsError(null);
    try {
      const result = await clearWhatsAppCache();
      setChats(result.chats);
      setStatus(result.status);
      setActiveJid(null);
      setMessages([]);
      setQuery('');
      setMobilePane('list');
    } catch (error) {
      setChatsError(errorMessage(error, t));
    } finally {
      setChatsLoading(false);
    }
  };

  const handleSelectChat = (jid: string) => {
    setActiveJid(jid);
    setMobilePane('chat');
  };

  const handleSend = async () => {
    if (!activeChat || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    setSendError(null);
    try {
      const result = await sendWhatsAppMessage(activeChat.id, text);
      setDraft('');
      setMessages((previous) =>
        previous.some((item) => item.id === result.message.id)
          ? previous
          : [...previous, result.message],
      );
      setChats((previous) => replaceChat(previous, result.chat));
    } catch (error) {
      setSendError(errorMessage(error, t));
    } finally {
      setSending(false);
    }
  };

  const handleOpenAi = () => {
    setMobilePane('copilot');
  };

  const handleGenerate = async () => {
    if (!activeChat) {
      setAiError(t('whatsapp.aiNeedsChat'));
      return;
    }
    if (!hasKey) {
      onOpenKey();
      return;
    }
    if (!selectedModel) {
      setAiError(t('whatsapp.aiNoModel'));
      return;
    }

    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    setAiStreaming(true);
    setAiDraft('');
    setAiError(null);
    setAiUsage(null);
    setAiElapsed(null);

    try {
      await streamWhatsAppMessage(
        {
          chatJid: activeChat.id,
          model: selectedModel.id,
          instruction: aiInstruction,
          tone: aiTone,
          language: aiLanguage,
          length: aiLength,
          reasoningEffort: pickReasoningEffort(selectedModel) ?? undefined,
        },
        storedKey || undefined,
        {
          onDelta: (text) => setAiDraft((previous) => previous + text),
          onUsage: (usage) => setAiUsage(usage),
          onDone: (payload) => setAiElapsed(payload.elapsedMs ?? null),
          onError: (error) => setAiError(error.message),
        },
        controller.signal,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setAiError(errorMessage(error, t));
      }
    } finally {
      setAiStreaming(false);
      aiAbort.current = null;
    }
  };

  const handleStop = () => {
    aiAbort.current?.abort();
    aiAbort.current = null;
    setAiStreaming(false);
  };

  const handleAiLanguageChange = (next: Language) => {
    aiLanguageTouched.current = true;
    setAiLanguage(next);
  };

  const handleUseDraft = () => {
    if (!aiDraft.trim()) return;
    setDraft(aiDraft.trim());
    setMobilePane('chat');
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('.wa-composer textarea')?.focus();
    }, 40);
  };

  const showStudio =
    status?.state === 'connected' ||
    (status?.state === 'connecting' && Boolean(status?.me));

  if (status && showStudio) {
    return (
      <>
      <main
        className={`wa-shell ${mobilePane === 'chat' ? 'wa-pane-chat' : ''} ${
          mobilePane === 'copilot' ? 'wa-pane-copilot' : ''
        }`}
      >
        <WhatsAppChatList
          chats={chats}
          me={status.me}
          status={status}
          activeJid={activeJid}
          query={query}
          loading={chatsLoading}
          error={chatsError}
          onQuery={setQuery}
          onSelect={handleSelectChat}
          onDisconnect={() => void handleDisconnect()}
          onRefresh={() => void refreshChats()}
          onReimport={() => void handleReimport()}
          onClearCache={() => void handleClearCache()}
          onOpenProfile={setProfileJid}
        />

        {activeChat ? (
          <WhatsAppConversation
            chat={activeChat}
            messages={messages}
            me={status.me}
            draft={draft}
            sending={sending}
            aiStreaming={aiStreaming}
            loading={messagesLoading}
            mock={Boolean(status.mock)}
            error={sendError ?? messagesError}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
            onOpenAi={handleOpenAi}
            onOpenProfile={() => setProfileJid(activeChat.id)}
            onBack={() => setMobilePane('list')}
          />
        ) : (
          <section className="wa-conversation wa-conversation-empty">
            <div className="wa-empty">
              <span className="wa-empty-mark">
                <MessageCircle size={26} strokeWidth={1.7} />
              </span>
              <span className="eyebrow">{t('whatsapp.eyebrow')}</span>
              <h1>{t('whatsapp.selectChat')}</h1>
              <p>{t('whatsapp.selectChatBody')}</p>
              <div className="wa-empty-hints">
                <span>
                  <MessageCircle size={12} strokeWidth={2} />
                  Live
                </span>
                <span>
                  <Sparkles size={12} strokeWidth={2} />
                  AI copilot
                </span>
                <span>
                  <ArrowRight size={12} strokeWidth={2} />
                  Baileys
                </span>
              </div>
            </div>
          </section>
        )}

        <WhatsAppCopilot
          chat={activeChat}
          hasKey={hasKey}
          models={models}
          modelId={selectedModel?.id ?? ''}
          instruction={aiInstruction}
          tone={aiTone}
          length={aiLength}
          language={aiLanguage}
          draft={aiDraft}
          streaming={aiStreaming}
          error={aiError}
          usage={aiUsage}
          elapsedMs={aiElapsed}
          onModelChange={onModelChange}
          onInstructionChange={setAiInstruction}
          onToneChange={setAiTone}
          onLengthChange={setAiLength}
          onLanguageChange={handleAiLanguageChange}
          onGenerate={() => void handleGenerate()}
          onStop={handleStop}
          onUse={handleUseDraft}
          onOpenKey={onOpenKey}
          onClose={() => setMobilePane('chat')}
        />
      </main>

      {profileJid && (
        <WhatsAppProfileModal jid={profileJid} onClose={() => setProfileJid(null)} />
      )}
      </>
    );
  }

  return (
    <WhatsAppConnect
      status={status}
      loading={statusLoading || connectBusy}
      error={connectError ?? statusError}
      onConnect={() => void handleConnect()}
    />
  );
}
