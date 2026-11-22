import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import {
  addMessage,
  clearChatCache,
  clearMediaRaw,
  contactNameFor,
  deleteChats,
  displayNameFor,
  formatPhone,
  getChat,
  getMediaRaw,
  initStore,
  isChatHidden,
  listChats,
  markChatRead,
  seedMockChats,
  setContactName,
  setMediaRaw,
  unhideChat,
  upsertChat,
} from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MOCK = process.env.WHATSAPP_MOCK === '1';
const AUTH_DIR = path.join(ROOT, '.wa-auth');
const STORE_FILE = path.join(ROOT, MOCK ? '.wa-store.mock.json' : '.wa-store.json');
const logger = pino({ level: 'silent' });

export const whatsappEvents = new EventEmitter();
whatsappEvents.setMaxListeners(80);

export class WhatsAppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'WhatsAppError';
    this.status = status;
    this.code = code;
  }
}

let sock = null;
let state = MOCK ? 'connected' : 'disconnected';
let qrDataUrl = null;
let lastQr = null;
let me = null;
let lastError = null;
let connectingPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let userLogout = false;
let historyTimer = null;
let historySync = { active: false, progress: null, isLatest: false };
const lastIncomingKey = new Map();
const mediaMessages = new Map();
const MAX_CACHED_MEDIA = 800;
const MAX_MEDIA_BYTES = 40 * 1024 * 1024;
const avatarCache = new Map();
const avatarMisses = new Map();
const profileCache = new Map();
const AVATAR_TTL_MS = 10 * 60_000;
const AVATAR_MISS_TTL_MS = 5 * 60_000;
const PROFILE_TTL_MS = 2 * 60_000;
const MAX_AVATAR_CACHE = 300;

const MOCK_ME = {
  id: 'demo@localhost',
  name: 'PolySend Demo',
  number: '+55 11 99999-0000',
};

const MOCK_REPLIES = [
  'Perfeito! Vou revisar e te respondo ainda hoje. 🙌',
  'Fechado! Pode seguir com esse plano.',
  'Gostei da proposta. Consegue me mandar o cronograma?',
  'Combinado. Qualquer coisa me chama por aqui.',
  'Show, já anotei. Obrigado pelo retorno!',
];

export function isMockMode() {
  return MOCK;
}

export function getStatus() {
  return {
    state,
    qr: qrDataUrl,
    me,
    lastError,
    mock: MOCK,
    history: {
      syncing: historySync.active,
      progress: historySync.progress,
      isLatest: historySync.isLatest,
    },
  };
}

function emitStatus() {
  whatsappEvents.emit('status', getStatus());
}

function resetHistory() {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
  historySync = { active: false, progress: null, isLatest: false };
}

function emitMessage(message, chat) {
  whatsappEvents.emit('message', { message, chat });
}

function shouldSkipJid(jid) {
  if (!jid) return true;
  return (
    jid === 'status@broadcast' ||
    jid === '0@s.whatsapp.net' ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter')
  );
}

function timestampOf(value) {
  if (!value) return Date.now();
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value?.toNumber === 'function') {
    return value.toNumber() * 1000;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (parsed < 1e12 ? parsed * 1000 : parsed) : Date.now();
}

function withTimeout(promise, ms, message = 'Request timed out.') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value?.toNumber === 'function') return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unwrapMessage(message) {
  if (!message) return null;
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessageV2Extension?.message) {
    return unwrapMessage(message.viewOnceMessageV2Extension.message);
  }
  if (message.documentWithCaptionMessage?.message) {
    return unwrapMessage(message.documentWithCaptionMessage.message);
  }
  return message;
}

function mediaInfo(kind, media, extra = {}) {
  return {
    kind,
    mimetype: media?.mimetype || null,
    fileName: media?.fileName || null,
    fileLength: numberValue(media?.fileLength),
    seconds: numberValue(media?.seconds),
    ptt: Boolean(media?.ptt),
    width: numberValue(media?.width),
    height: numberValue(media?.height),
    ...extra,
  };
}

function extractContent(message) {
  const content = unwrapMessage(message);
  if (!content) return null;
  if (typeof content.conversation === 'string') {
    return { text: content.conversation, type: 'text' };
  }
  if (typeof content.extendedTextMessage?.text === 'string') {
    return { text: content.extendedTextMessage.text, type: 'text' };
  }
  if (content.imageMessage) {
    return {
      text: content.imageMessage.caption || '',
      type: 'media',
      media: mediaInfo('image', content.imageMessage),
    };
  }
  if (content.videoMessage) {
    return {
      text: content.videoMessage.caption || '',
      type: 'media',
      media: mediaInfo('video', content.videoMessage),
    };
  }
  if (content.ptvMessage) {
    return {
      text: '',
      type: 'media',
      media: mediaInfo('video', content.ptvMessage),
    };
  }
  if (content.audioMessage) {
    return {
      text: '',
      type: 'media',
      media: mediaInfo('audio', content.audioMessage),
    };
  }
  if (content.documentMessage) {
    return {
      text: content.documentMessage.caption || '',
      type: 'media',
      media: mediaInfo('document', content.documentMessage),
    };
  }
  if (content.stickerMessage) {
    return {
      text: '',
      type: 'media',
      media: mediaInfo('sticker', content.stickerMessage),
    };
  }
  if (content.lottieStickerMessage?.message) {
    return { text: 'Sticker', type: 'media', media: null };
  }
  if (content.locationMessage) {
    return { text: 'Location', type: 'text' };
  }
  if (content.contactMessage) {
    return { text: 'Contact', type: 'text' };
  }
  return null;
}

function normalizeMessage(raw) {
  const key = raw?.key;
  const jid = key?.remoteJid;
  if (!key?.id || shouldSkipJid(jid)) return null;

  const content = extractContent(raw.message);
  if (!content) return null;

  const fromMe = Boolean(key.fromMe);
  const senderId = key.participant || jid;
  const existing = getChat(jid);
  const senderName = fromMe
    ? existing?.name || 'You'
    : raw.pushName?.trim() ||
      contactNameFor(senderId) ||
      (jid.endsWith('@g.us') ? formatPhone(senderId) : displayNameFor(jid));

  const message = {
    id: key.id,
    chatId: jid,
    senderId,
    senderName,
    text: content.text.trim(),
    timestamp: timestampOf(raw.messageTimestamp),
    fromMe,
    type: content.type,
    media: content.media ?? null,
  };

  if (message.media) {
    mediaMessages.set(message.id, raw);
    setMediaRaw(message.id, raw);
    if (mediaMessages.size > MAX_CACHED_MEDIA) {
      const oldest = mediaMessages.keys().next().value;
      if (oldest) mediaMessages.delete(oldest);
    }
  }

  return message;
}

function handleIncoming(raw, { emit = true, unread = true, live = false } = {}) {
  const jid = raw?.key?.remoteJid;
  if (live && jid) unhideChat(jid);
  if (!live && jid && isChatHidden(jid)) return null;

  const message = normalizeMessage(raw);
  if (!message) return null;

  if (message.fromMe) message.senderName = me?.name || 'You';
  else if (raw?.key) lastIncomingKey.set(message.chatId, raw.key);
  const chat = addMessage(message);
  if (!chat && !getChat(message.chatId)) return null;

  if (!unread && chat) chat.unread = Math.max(0, chat.unread - 1);

  if (emit) emitMessage(message, getChat(message.chatId));
  return message;
}

function normalizeChat(chat) {
  if (!chat?.id || shouldSkipJid(chat.id)) return null;
  return {
    id: chat.id,
    name: chat.name || chat.subject || contactNameFor(chat.id) || undefined,
    isGroup: chat.id.endsWith('@g.us'),
    unread: typeof chat.unreadCount === 'number' ? chat.unreadCount : undefined,
  };
}

async function applyHistory(data) {
  const contacts = data?.contacts ?? [];
  for (const contact of contacts) {
    const jid = contact?.id;
    const name = contact?.name || contact?.verifiedName || contact?.notify;
    if (jid && name) {
      setContactName(jid, name);
    }
  }

  for (const chat of data?.chats ?? []) {
    const normalized = normalizeChat(chat);
    if (!normalized) continue;
    upsertChat(normalized.id, {
      name: normalized.name,
      isGroup: normalized.isGroup,
      unread: normalized.unread,
    });
  }

  const recent = (data?.messages ?? []).slice(-600);
  for (const raw of recent) {
    handleIncoming(raw, { emit: false, unread: false, live: false });
  }

  for (const chat of data?.chats ?? []) {
    const normalized = normalizeChat(chat);
    if (normalized) upsertChat(normalized.id, { unread: normalized.unread });
  }

  whatsappEvents.emit('chats', listChats());
}

async function setQr(qr) {
  if (!qr || qr === lastQr) return;
  lastQr = qr;
  state = 'qr';
  lastError = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qr, {
      margin: 1,
      width: 340,
      color: { dark: '#0b0f06', light: '#f4f1e9' },
    });
  } catch {
    qrDataUrl = null;
  }
  emitStatus();
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(credsRegistered) {
  if (!credsRegistered || userLogout || MOCK) return;
  clearReconnect();
  const delay = Math.min(15_000, 1_500 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect().catch(() => {});
  }, delay);
  reconnectTimer.unref?.();
}

async function pruneLeftGroups(socket) {
  if (typeof socket?.groupFetchAllParticipating !== 'function') return;
  try {
    const groups = await socket.groupFetchAllParticipating();
    const joined = new Set(Object.keys(groups ?? {}));
    const stale = listChats()
      .filter((chat) => chat.isGroup && !joined.has(chat.id))
      .map((chat) => chat.id);
    if (!stale.length) return;
    deleteChats(stale);
    whatsappEvents.emit('chats', listChats());
    console.log(`  [whatsapp] removed ${stale.length} cached groups that are no longer joined`);
  } catch (error) {
    console.warn('  [whatsapp] could not refresh group membership:', error?.message || error);
  }
}

function setDisconnected(errorMessage) {
  state = 'disconnected';
  qrDataUrl = null;
  lastQr = null;
  me = null;
  resetHistory();
  if (errorMessage) lastError = errorMessage;
  emitStatus();
}

function attachSocketHandlers(socket, authState) {
  socket.ev.on('creds.update', authState.saveCreds);

  socket.ev.on('connection.update', async (update) => {
    if (update.qr) {
      await setQr(update.qr);
    }

    if (update.connection === 'connecting') {
      state = 'connecting';
      emitStatus();
      return;
    }

    if (update.connection === 'open') {
      state = 'connected';
      qrDataUrl = null;
      lastQr = null;
      lastError = null;
      reconnectAttempt = 0;
      clearReconnect();
      historySync = { active: true, progress: 0, isLatest: false };
      if (historyTimer) clearTimeout(historyTimer);
      historyTimer = setTimeout(() => {
        historyTimer = null;
        if (historySync.active && !historySync.isLatest) {
          historySync = { active: false, progress: null, isLatest: false };
          console.log('  [whatsapp] history sync timed out; showing chats received so far');
          emitStatus();
        }
      }, 45_000);
      historyTimer.unref?.();
      const rawId = socket.user?.id ? jidNormalizedUser(socket.user.id) : null;
      me = rawId
        ? {
            id: rawId,
            name: socket.user?.name || socket.user?.verifiedName || 'WhatsApp',
            number: `+${rawId.split('@')[0]}`,
          }
        : null;
      emitStatus();
      whatsappEvents.emit('chats', listChats());
      const pruneTimer = setTimeout(() => {
        void pruneLeftGroups(socket);
      }, 4_000);
      pruneTimer.unref?.();
      return;
    }

    if (update.connection === 'close') {
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const reason = update.lastDisconnect?.error?.message;
      const loggedOut =
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 401 ||
        statusCode === 403;

      try {
        socket.ev.removeAllListeners('connection.update');
        socket.ev.removeAllListeners('creds.update');
      } catch {
        /* noop */
      }

      sock = null;

      if (loggedOut) {
        userLogout = true;
        state = 'logged_out';
        qrDataUrl = null;
        lastQr = null;
        me = null;
        resetHistory();
        lastError = 'WhatsApp session ended. Connect again to scan a new QR code.';
        await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
        emitStatus();
        return;
      }

      setDisconnected(reason || 'WhatsApp connection closed.');
      scheduleReconnect(Boolean(authState.creds?.registered));
    }
  });

  socket.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const raw of messages ?? []) {
      handleIncoming(raw, { live: true });
    }
  });

  socket.ev.on('chats.upsert', (chats) => {
    for (const chat of chats ?? []) {
      if (!chat?.id || isChatHidden(chat.id)) continue;
      const normalized = normalizeChat(chat);
      if (!normalized) continue;
      upsertChat(normalized.id, normalized);
    }
    whatsappEvents.emit('chats', listChats());
  });

  socket.ev.on('chats.update', (chats) => {
    for (const chat of chats ?? []) {
      if (!chat?.id || shouldSkipJid(chat.id) || isChatHidden(chat.id)) continue;
      upsertChat(chat.id, {
        name: chat.name || chat.subject,
        isGroup: chat.id.endsWith('@g.us'),
        unread: typeof chat.unreadCount === 'number' ? chat.unreadCount : undefined,
      });
    }
    whatsappEvents.emit('chats', listChats());
  });

  socket.ev.on('chats.delete', (jids) => {
    deleteChats(jids);
    whatsappEvents.emit('chats', listChats());
  });

  socket.ev.on('group-participants.update', ({ id, participants, action }) => {
    const myId = me?.id;
    if (!myId || !id || !Array.isArray(participants)) return;
    if (action !== 'remove' && action !== 'leave') return;
    if (participants.some((participant) => jidNormalizedUser(participant) === myId)) {
      deleteChats([id]);
      whatsappEvents.emit('chats', listChats());
    }
  });

  socket.ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts ?? []) {
      const name = contact?.name || contact?.verifiedName || contact?.notify;
      if (contact?.id && name) setContactName(contact.id, name);
    }
    whatsappEvents.emit('chats', listChats());
  });

  socket.ev.on('contacts.update', (contacts) => {
    for (const contact of contacts ?? []) {
      const name = contact?.name || contact?.verifiedName || contact?.notify;
      if (contact?.id && name) setContactName(contact.id, name);
    }
  });

  socket.ev.on('groups.upsert', (groups) => {
    for (const group of groups ?? []) {
      if (group?.id && !isChatHidden(group.id)) {
        upsertChat(group.id, { name: group.subject, isGroup: true });
      }
    }
    whatsappEvents.emit('chats', listChats());
  });

  socket.ev.on('groups.update', (groups) => {
    for (const group of groups ?? []) {
      if (group?.id && group.subject && !isChatHidden(group.id)) {
        upsertChat(group.id, { name: group.subject, isGroup: true });
      }
    }
  });

  socket.ev.on('messaging-history.set', (data) => {
    historySync.active = true;
    if (typeof data?.progress === 'number') historySync.progress = data.progress;
    if (data?.isLatest) historySync.isLatest = true;
    console.log(
      `  [whatsapp] history: ${data?.chats?.length ?? 0} chats, ${data?.messages?.length ?? 0} messages, progress ${data?.progress ?? '-'}${data?.isLatest ? ' (latest)' : ''}`,
    );
    emitStatus();
    void applyHistory(data).finally(() => {
      if (data?.isLatest) {
        historySync = { active: false, progress: 100, isLatest: true };
        if (historyTimer) {
          clearTimeout(historyTimer);
          historyTimer = null;
        }
        emitStatus();
        const pruneTimer = setTimeout(() => {
          void pruneLeftGroups(sock);
        }, 1_500);
        pruneTimer.unref?.();
      }
      whatsappEvents.emit('chats', listChats());
    });
  });
}

async function createSocket() {
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  const socket = makeWASocket({
    ...(version ? { version } : {}),
    auth: authState,
    logger,
    printQRInTerminal: false,
    browser: ['PolySend', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
    generateHighQualityLinkPreview: false,
  });

  sock = socket;
  attachSocketHandlers(socket, { saveCreds, creds: authState.creds });
  return { socket, authState };
}

export async function connect() {
  if (MOCK) {
    state = 'connected';
    me = MOCK_ME;
    qrDataUrl = null;
    lastError = null;
    seedMockChats();
    emitStatus();
    return getStatus();
  }
  if (state === 'connected') return getStatus();
  if (state === 'connecting' || state === 'qr') return getStatus();
  if (connectingPromise) return connectingPromise;

  if (sock) {
    try {
      sock.end(undefined);
    } catch {
      /* noop */
    }
    sock = null;
  }

  userLogout = false;
  clearReconnect();
  resetHistory();

  connectingPromise = (async () => {
    state = 'connecting';
    lastError = null;
    emitStatus();
    try {
      await createSocket();
      return getStatus();
    } catch (error) {
      state = 'disconnected';
      lastError = error?.message || 'Could not start WhatsApp.';
      emitStatus();
      throw new WhatsAppError(502, 'whatsapp_start_failed', lastError);
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export async function logout() {
  userLogout = true;
  clearReconnect();
  const current = sock;
  sock = null;
  try {
    await current?.logout();
  } catch {
    try {
      current?.end(undefined);
    } catch {
      /* noop */
    }
  }
  state = 'logged_out';
  qrDataUrl = null;
  lastQr = null;
  me = null;
  resetHistory();
  mediaMessages.clear();
  clearMediaRaw();
  avatarCache.clear();
  avatarMisses.clear();
  profileCache.clear();
  lastError = null;
  await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
  emitStatus();
  return getStatus();
}

export async function sendText(jid, text) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) {
    throw new WhatsAppError(400, 'whatsapp_empty_message', 'Type a message before sending.');
  }

  if (MOCK) {
    const timestamp = Date.now();
    const message = {
      id: randomUUID(),
      chatId: jid,
      senderId: 'me',
      senderName: MOCK_ME.name,
      text: clean,
      timestamp,
      fromMe: true,
      type: 'text',
    };
    const chat = addMessage(message);
    emitMessage(message, chat);
    if (chat) chat.unread = 0;

    const replyTimer = setTimeout(() => {
      const reply = {
        id: randomUUID(),
        chatId: jid,
        senderId: jid,
        senderName: getChat(jid)?.name || 'Contact',
        text: MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)],
        timestamp: Date.now(),
        fromMe: false,
        type: 'text',
      };
      const replyChat = addMessage(reply);
      emitMessage(reply, replyChat);
    }, 1_600);
    replyTimer.unref?.();
    return message;
  }

  if (!sock || state !== 'connected') {
    throw new WhatsAppError(
      409,
      'whatsapp_not_connected',
      'WhatsApp is not connected. Scan the QR code first.',
    );
  }

  let sent;
  try {
    sent = await sock.sendMessage(jid, { text: clean });
  } catch (error) {
    throw new WhatsAppError(
      502,
      'whatsapp_send_failed',
      `WhatsApp could not send this message: ${error?.message || 'unknown error'}`,
    );
  }

  const message = {
    id: sent?.key?.id || randomUUID(),
    chatId: jid,
    senderId: 'me',
    senderName: me?.name || 'You',
    text: clean,
    timestamp: timestampOf(sent?.messageTimestamp) || Date.now(),
    fromMe: true,
    type: 'text',
  };
  const chat = addMessage(message);
  if (chat) chat.unread = 0;
  emitMessage(message, chat);
  return message;
}

export async function readChat(jid) {
  const chat = markChatRead(jid);
  if (!chat) {
    throw new WhatsAppError(404, 'whatsapp_chat_not_found', 'Chat not found.');
  }
  const key = lastIncomingKey.get(jid);
  if (key && sock && state === 'connected' && !MOCK) {
    lastIncomingKey.delete(jid);
    void sock.readMessages([key]).catch(() => {});
  }
  return chat;
}

async function reconnect() {
  clearReconnect();
  const current = sock;
  sock = null;
  if (current) {
    try {
      current.ev.removeAllListeners('connection.update');
      current.ev.removeAllListeners('creds.update');
    } catch {
      /* noop */
    }
    try {
      current.end(undefined);
    } catch {
      /* noop */
    }
  }
  state = 'disconnected';
  qrDataUrl = null;
  lastQr = null;
  resetHistory();
  emitStatus();
  return connect();
}

export async function clearWhatsAppCache() {
  clearChatCache();
  mediaMessages.clear();
  lastIncomingKey.clear();
  resetHistory();
  whatsappEvents.emit('chats', []);
  if (MOCK) {
    emitStatus();
    return getStatus();
  }
  if (state === 'connected') {
    return reconnect();
  }
  emitStatus();
  return getStatus();
}

function resolveProfileJid(jid) {
  if (jid === 'me') {
    if (!me?.id) {
      throw new WhatsAppError(409, 'whatsapp_not_connected', 'WhatsApp is not connected.');
    }
    return me.id;
  }
  if (
    !jid ||
    shouldSkipJid(jid) ||
    !/^[A-Za-z0-9._:-]+@(s\.whatsapp\.net|g\.us|lid)$/.test(jid)
  ) {
    throw new WhatsAppError(400, 'whatsapp_invalid_chat', 'Invalid WhatsApp contact.');
  }
  return jid;
}

function displayNumber(jid) {
  const user = String(jid).split('@')[0].split(':')[0];
  if (jid.endsWith('@s.whatsapp.net') && /^\d{8,15}$/.test(user)) return `+${user}`;
  return null;
}

export async function getProfile(jid) {
  const resolved = resolveProfileJid(jid);
  const cached = profileCache.get(resolved);
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) {
    return cached.data;
  }

  if (MOCK) {
    const isGroup = resolved.endsWith('@g.us');
    const chat = getChat(resolved);
    const own = me?.id === resolved;
    const data = {
      jid: jid === 'me' ? 'me' : resolved,
      name: own ? me?.name || 'PolySend Demo' : chat?.name || formatPhone(resolved),
      number: isGroup ? null : own ? me?.number || null : displayNumber(resolved),
      isLid: false,
      isGroup,
      about: isGroup ? null : 'Disponível para conversar 😊',
      description: isGroup ? 'Grupo de demonstração do PolySend.' : null,
      participants: isGroup ? 12 : null,
      owner: isGroup ? 'demo@localhost' : null,
      createdAt: null,
      avatarUrl: null,
      hasAvatar: false,
      isSelf: Boolean(own) || jid === 'me',
    };
    profileCache.set(resolved, { at: Date.now(), data });
    return data;
  }

  if (!sock || state !== 'connected') {
    throw new WhatsAppError(409, 'whatsapp_not_connected', 'WhatsApp is not connected.');
  }

  const isGroup = resolved.endsWith('@g.us');
  const own = me?.id === resolved;
  const chat = getChat(resolved);
  let name = own ? me?.name : chat?.name || contactNameFor(resolved) || formatPhone(resolved);
  let about = null;
  let description = null;
  let participants = null;
  let owner = null;
  let createdAt = null;

  if (isGroup) {
    try {
      const metadata = await withTimeout(sock.groupMetadata(resolved), 8_000);
      name = metadata?.subject || name;
      description = metadata?.desc || null;
      participants = Array.isArray(metadata?.participants) ? metadata.participants.length : null;
      owner = metadata?.owner || null;
      const creation = numberValue(metadata?.creation);
      createdAt = creation ? creation * 1000 : null;
    } catch {
      /* keep cached name */
    }
  } else {
    try {
      const statuses = await withTimeout(sock.fetchStatus(resolved), 6_000);
      const entry = (statuses ?? []).find(
        (item) => item?.id && jidNormalizedUser(item.id) === jidNormalizedUser(resolved),
      );
      about = entry?.status ?? null;
    } catch {
      /* status is optional */
    }
  }

  let avatarUrl = null;
  try {
    const url = await withTimeout(
      sock.profilePictureUrl(resolved, 'image', 8_000),
      9_000,
    );
    if (url) avatarUrl = `/api/whatsapp/avatar/${encodeURIComponent(jid === 'me' ? 'me' : resolved)}`;
  } catch {
    avatarUrl = null;
  }

  const data = {
    jid: jid === 'me' ? 'me' : resolved,
    name: name || formatPhone(resolved),
    number: isGroup ? null : own ? me?.number || displayNumber(resolved) : displayNumber(resolved),
    isLid: !isGroup && resolved.endsWith('@lid'),
    isGroup,
    about,
    description,
    participants,
    owner,
    createdAt,
    avatarUrl,
    hasAvatar: Boolean(avatarUrl),
    isSelf: Boolean(own) || jid === 'me',
  };

  profileCache.set(resolved, { at: Date.now(), data });
  return data;
}

export async function getAvatar(jid) {
  const resolved = resolveProfileJid(jid);
  if (!sock || state !== 'connected' || MOCK) {
    throw new WhatsAppError(404, 'whatsapp_avatar_unavailable', 'Avatar unavailable.');
  }

  const cached = avatarCache.get(resolved);
  if (cached && Date.now() - cached.at < AVATAR_TTL_MS) {
    return { buffer: cached.buffer, mimetype: cached.mimetype };
  }

  const missAt = avatarMisses.get(resolved);
  if (missAt && Date.now() - missAt < AVATAR_MISS_TTL_MS) {
    throw new WhatsAppError(404, 'whatsapp_avatar_unavailable', 'Avatar unavailable.');
  }

  let url;
  try {
    url = await withTimeout(sock.profilePictureUrl(resolved, 'image', 8_000), 9_000);
  } catch {
    url = null;
  }
  if (!url) {
    avatarMisses.set(resolved, Date.now());
    throw new WhatsAppError(404, 'whatsapp_avatar_unavailable', 'Avatar unavailable.');
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new WhatsAppError(
      502,
      'whatsapp_avatar_failed',
      `Could not download this avatar: ${error?.message || 'unknown error'}`,
    );
  }
  if (!response.ok) {
    avatarMisses.set(resolved, Date.now());
    throw new WhatsAppError(404, 'whatsapp_avatar_unavailable', 'Avatar unavailable.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimetype = response.headers.get('content-type') || 'image/jpeg';
  avatarCache.set(resolved, { at: Date.now(), buffer, mimetype });
  if (avatarCache.size > MAX_AVATAR_CACHE) {
    const oldest = avatarCache.keys().next().value;
    if (oldest) avatarCache.delete(oldest);
  }
  return { buffer, mimetype };
}

export async function getMedia(id) {
  const raw = mediaMessages.get(id) ?? getMediaRaw(id);
  if (!raw) {
    throw new WhatsAppError(
      404,
      'whatsapp_media_unavailable',
      'This media is no longer available in the session cache.',
    );
  }
  mediaMessages.set(id, raw);

  const content = extractContent(raw.message);
  if (!content?.media) {
    throw new WhatsAppError(404, 'whatsapp_media_unavailable', 'This message has no media.');
  }

  let timer;
  let buffer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Media download timed out.')), 45_000);
      timer.unref?.();
    });
    buffer = await Promise.race([
      downloadMediaMessage(raw, 'buffer', {}, {
        logger,
        reuploadRequest: async (message) => message,
      }),
      timeout,
    ]);
  } catch (error) {
    throw new WhatsAppError(
      502,
      'whatsapp_media_failed',
      `Could not download this media: ${error?.message || 'unknown error'}`,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new WhatsAppError(502, 'whatsapp_media_failed', 'WhatsApp returned empty media.');
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw new WhatsAppError(413, 'whatsapp_media_too_large', 'This media is too large to preview.');
  }

  return {
    buffer,
    ...content.media,
    caption: content.text,
  };
}

export async function bootstrapWhatsApp() {
  initStore(STORE_FILE);
  if (MOCK) {
    me = MOCK_ME;
    state = 'connected';
    seedMockChats();
    return;
  }
  try {
    await fs.access(path.join(AUTH_DIR, 'creds.json'));
  } catch {
    return;
  }
  connect().catch(() => {});
}
