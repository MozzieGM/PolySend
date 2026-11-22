import fs from 'node:fs';
import path from 'node:path';

const MAX_MESSAGES_PER_CHAT = 500;
const MAX_CHATS = 300;

const chats = new Map();
const messages = new Map();
const contacts = new Map();
const mediaRaw = new Map();
const hiddenChats = new Set();
const MAX_MEDIA_RAW = 800;

let storePath = null;
let saveTimer = null;

const PALETTE = ['#c8f751', '#58e39a', '#7cc4ff', '#ffb86b', '#d99bff', '#ff8fa3'];

const MOCK_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10150a"/>
      <stop offset="1" stop-color="#07090c"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <circle cx="90" cy="80" r="120" fill="#c8f751" opacity="0.14"/>
  <circle cx="560" cy="330" r="150" fill="#58e39a" opacity="0.12"/>
  <rect x="48" y="48" width="544" height="304" rx="24" fill="none" stroke="#c8f751" stroke-opacity="0.28"/>
  <text x="86" y="190" fill="#f3efe4" font-family="Arial, sans-serif" font-size="44" font-weight="700">PolySend</text>
  <text x="86" y="230" fill="#c8f751" font-family="Arial, sans-serif" font-size="20" letter-spacing="2">WHATSAPP STUDIO</text>
  <text x="86" y="282" fill="#99a1a8" font-family="Arial, sans-serif" font-size="16">Mock media preview</text>
</svg>
`)}`;

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

export function colorForJid(jid) {
  return PALETTE[hash(String(jid)) % PALETTE.length];
}

export function formatPhone(jid) {
  const user = String(jid).split('@')[0].split(':')[0];
  if (/^\d{10,15}$/.test(user)) return `+${user}`;
  return user || 'Unknown';
}

export function contactNameFor(jid) {
  return contacts.get(jid) ?? null;
}

export function displayNameFor(jid, pushName = null) {
  return (
    contacts.get(jid) ??
    (pushName && pushName.trim()) ??
    chats.get(jid)?.name ??
    formatPhone(jid)
  );
}

export function setContactName(jid, name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!jid || !clean) return;
  contacts.set(jid, clean);
  const chat = chats.get(jid);
  if (chat) chat.name = clean;
  saveSoon();
}

export function upsertChat(jid, patch = {}) {
  if (!jid) return null;
  const existing = chats.get(jid);
  const next = {
    id: jid,
    name: patch.name?.trim() || existing?.name || displayNameFor(jid),
    isGroup: Boolean(patch.isGroup ?? existing?.isGroup ?? jid.endsWith('@g.us')),
    lastMessage: patch.lastMessage ?? existing?.lastMessage ?? '',
    lastMessageAt: patch.lastMessageAt ?? existing?.lastMessageAt ?? null,
    lastMessageFromMe: patch.lastMessageFromMe ?? existing?.lastMessageFromMe ?? false,
    unread: patch.unread ?? existing?.unread ?? 0,
    color: existing?.color ?? colorForJid(jid),
  };
  chats.set(jid, next);
  trimChats();
  saveSoon();
  return next;
}

function trimChats() {
  if (chats.size <= MAX_CHATS) return;
  const oldest = [...chats.values()]
    .sort((a, b) => (a.lastMessageAt ?? 0) - (b.lastMessageAt ?? 0))
    .slice(0, chats.size - MAX_CHATS);
  for (const chat of oldest) {
    chats.delete(chat.id);
    messages.delete(chat.id);
  }
}

export function getChat(jid) {
  return chats.get(jid) ?? null;
}

export function listChats(query = '') {
  const term = query.trim().toLowerCase();
  return [...chats.values()]
    .filter((chat) => {
      if (!term) return true;
      return (
        chat.name.toLowerCase().includes(term) ||
        chat.lastMessage.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt - a.lastMessageAt;
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });
}

export function getMessages(jid) {
  return [...(messages.get(jid) ?? [])].sort((a, b) => a.timestamp - b.timestamp);
}

function previewFor(message) {
  if (message.text) return message.text;
  const media = message.media;
  if (!media) return '';
  if (media.kind === 'image') return '📷 Photo';
  if (media.kind === 'video') return '🎥 Video';
  if (media.kind === 'audio') return media.ptt ? '🎤 Voice message' : '🎵 Audio';
  if (media.kind === 'document') return `📎 ${media.fileName || 'Document'}`;
  if (media.kind === 'sticker') return 'Sticker';
  return 'Media';
}

export function addMessage(message) {
  if (!message?.chatId) return null;
  const list = messages.get(message.chatId) ?? [];
  const existingIndex = list.findIndex((item) => item.id === message.id);

  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    const merged = {
      ...existing,
      ...message,
      text: message.text || existing.text,
      media: message.media ?? existing.media ?? null,
    };
    list[existingIndex] = merged;
    messages.set(message.chatId, list);
    const chat = upsertChat(message.chatId, {
      lastMessage: previewFor(merged),
      lastMessageAt: merged.timestamp,
      lastMessageFromMe: Boolean(merged.fromMe),
      isGroup: message.chatId.endsWith('@g.us'),
    });
    saveSoon();
    return chat;
  }

  list.push(message);
  if (list.length > MAX_MESSAGES_PER_CHAT) list.splice(0, list.length - MAX_MESSAGES_PER_CHAT);
  messages.set(message.chatId, list);

  const chat = upsertChat(message.chatId, {
    lastMessage: previewFor(message),
    lastMessageAt: message.timestamp,
    lastMessageFromMe: Boolean(message.fromMe),
    isGroup: message.chatId.endsWith('@g.us'),
  });

  if (!message.fromMe && chat) {
    chat.unread += 1;
  }
  saveSoon();
  return chat;
}

export function markChatRead(jid) {
  const chat = chats.get(jid);
  if (!chat) return null;
  chat.unread = 0;
  saveSoon();
  return chat;
}

export function setMediaRaw(id, raw) {
  if (!id || !raw?.message) return;
  mediaRaw.set(id, raw);
  if (mediaRaw.size > MAX_MEDIA_RAW) {
    const oldest = mediaRaw.keys().next().value;
    if (oldest) mediaRaw.delete(oldest);
  }
  saveSoon();
}

export function getMediaRaw(id) {
  return mediaRaw.get(id) ?? null;
}

export function clearMediaRaw() {
  mediaRaw.clear();
  saveSoon();
}

export function isChatHidden(jid) {
  return hiddenChats.has(jid);
}

export function unhideChat(jid) {
  if (hiddenChats.delete(jid)) saveSoon();
}

export function deleteChats(jids) {
  for (const jid of jids ?? []) {
    if (!jid) continue;
    hiddenChats.add(jid);
    chats.delete(jid);
    messages.delete(jid);
  }
  saveSoon();
}

export function clearChatCache() {
  if (storePath) {
    try {
      fs.copyFileSync(storePath, storePath.replace(/\.json$/, '.backup.json'));
    } catch {
      /* best effort */
    }
  }
  chats.clear();
  messages.clear();
  mediaRaw.clear();
  // Keep deleted-chat tombstones so a later history sync does not resurrect
  // groups the user already left.
  saveNow();
}

export function resetUnreadForOwnMessage(jid) {
  const chat = chats.get(jid);
  if (!chat) return;
  chat.unread = 0;
  saveSoon();
}

export function initStore(file) {
  storePath = file;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw, (_key, value) => {
      if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data);
      }
      return value;
    });
    for (const chat of data.chats ?? []) {
      if (!chat?.id) continue;
      chats.set(chat.id, {
        id: chat.id,
        name: chat.name || formatPhone(chat.id),
        isGroup: Boolean(chat.isGroup),
        lastMessage: chat.lastMessage ?? '',
        lastMessageAt: chat.lastMessageAt ?? null,
        lastMessageFromMe: Boolean(chat.lastMessageFromMe),
        unread: Number(chat.unread) || 0,
        color: chat.color || colorForJid(chat.id),
      });
    }
    for (const [jid, list] of Object.entries(data.messages ?? {})) {
      if (Array.isArray(list)) messages.set(jid, list.slice(-MAX_MESSAGES_PER_CHAT));
    }
    for (const [jid, name] of Object.entries(data.contacts ?? {})) {
      if (typeof name === 'string') contacts.set(jid, name);
    }
    for (const [id, item] of Object.entries(data.mediaRaw ?? {})) {
      if (item?.message) mediaRaw.set(id, item);
    }
    for (const jid of data.hiddenChats ?? []) {
      if (typeof jid === 'string') hiddenChats.add(jid);
    }
  } catch {
    /* first run */
  }
}

function saveNow() {
  if (!storePath) return;
  const payload = {
    chats: [...chats.values()],
    messages: Object.fromEntries(messages),
    contacts: Object.fromEntries(contacts),
    mediaRaw: Object.fromEntries(mediaRaw),
    hiddenChats: [...hiddenChats],
  };
  const temp = path.join(path.dirname(storePath), `.${path.basename(storePath)}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(payload), 'utf8');
    fs.renameSync(temp, storePath);
  } catch {
    /* storage is best effort */
  }
}

function saveSoon() {
  if (!storePath || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 500);
  saveTimer.unref?.();
}

export function seedMockChats() {
  if (chats.size > 0) return;
  const now = Date.now();
  const seed = [
    {
      id: 'mock-julia@s.whatsapp.net',
      name: 'Julia Martins',
      messages: [
        { fromMe: true, text: 'Oi Julia! Tudo bem? Separei o escopo do projeto de logística.', offset: -3_600_000 },
        { fromMe: false, text: 'Oi! Tudo ótimo 😊 Pode mandar que eu reviso hoje.', offset: -3_420_000 },
        {
          fromMe: false,
          text: 'Segue o mock da tela 👇',
          offset: -3_380_000,
          media: {
            kind: 'image',
            mimetype: 'image/svg+xml',
            fileName: 'preview.svg',
            fileLength: null,
            seconds: null,
            ptt: false,
            width: 640,
            height: 400,
            url: MOCK_IMAGE,
          },
        },
        { fromMe: true, text: 'Perfeito. O prazo de oito semanas inclui discovery, build e testes.', offset: -3_300_000 },
        { fromMe: false, text: 'Gostei. Consegue incluir uma estimativa de custo por fase?', offset: -1_800_000 },
      ],
      unread: 1,
    },
    {
      id: 'mock-northwind@g.us',
      name: 'Lançamento Northwind',
      isGroup: true,
      messages: [
        { fromMe: false, senderName: 'Bruno Costa', text: 'Subi a nova versão do protótipo no Figma.', offset: -7_200_000 },
        { fromMe: false, senderName: 'Sofia Almeida', text: 'Ficou muito melhor no mobile 👏', offset: -7_000_000 },
        { fromMe: true, text: 'Boa! Vou revisar ainda hoje e deixo os comentários lá.', offset: -6_900_000 },
      ],
      unread: 2,
    },
    {
      id: 'mock-bruno@s.whatsapp.net',
      name: 'Bruno Costa',
      messages: [
        { fromMe: false, text: 'Fechamos com o fornecedor. Podemos começar segunda?', offset: -86_400_000 },
        { fromMe: true, text: 'Fechado. Te mando o cronograma amanhã cedo.', offset: -82_800_000 },
      ],
      unread: 0,
    },
    {
      id: 'mock-sofia@s.whatsapp.net',
      name: 'Sofia Almeida',
      messages: [
        { fromMe: false, text: 'Oi! Recebi a nota, obrigada. Já encaminhei para o financeiro.', offset: -172_800_000 },
      ],
      unread: 0,
    },
  ];

  for (const chat of seed) {
    upsertChat(chat.id, {
      name: chat.name,
      isGroup: Boolean(chat.isGroup),
      unread: 0,
    });
    chat.messages.forEach((message, index) => {
      addMessage({
        id: `mock-${chat.id}-${index}`,
        chatId: chat.id,
        senderId: message.fromMe ? 'me' : chat.id,
        senderName: message.fromMe ? 'PolySend Demo' : message.senderName || chat.name,
        text: message.text,
        timestamp: now + message.offset,
        fromMe: message.fromMe,
        type: message.media ? 'media' : 'text',
        media: message.media ?? null,
      });
    });
    const entry = chats.get(chat.id);
    if (entry) entry.unread = chat.unread;
  }
  saveNow();
}
