const LENGTH_WORDS = {
  curto: 35,
  medio: 75,
  longo: 130,
};

const TONE_LABEL = {
  profissional: 'professional and polished',
  direto: 'direct and objective',
  amigavel: 'friendly and warm',
  persuasivo: 'persuasive and confident',
  empatico: 'empathetic and considerate',
  formal: 'formal and respectful',
};

const LANGUAGE_LABEL = {
  'pt-BR': 'Brazilian Portuguese',
  en: 'English',
  es: 'Spanish',
};

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function buildWhatsAppPrompt({
  chatName,
  isGroup,
  history,
  instruction,
  tone,
  language,
  length,
}) {
  const wordLimit = LENGTH_WORDS[length] ?? LENGTH_WORDS.medio;
  const toneLabel = TONE_LABEL[tone] ?? TONE_LABEL.amigavel;
  const languageLabel = LANGUAGE_LABEL[language] ?? LANGUAGE_LABEL['pt-BR'];

  const transcript = (Array.isArray(history) ? history : [])
    .slice(-18)
    .map((message) => {
      const who = message.fromMe
        ? 'Me'
        : message.senderName || (isGroup ? 'Participant' : chatName);
      return `${who}: ${clean(message.text, 400)}`;
    })
    .filter((line) => line.length > 4)
    .join('\n');

  const system = [
    "You are PolySend's WhatsApp copilot.",
    `Write one WhatsApp message in ${languageLabel}.`,
    `Tone: ${toneLabel}.`,
    `Keep it under ${wordLimit} words.`,
    'Sound like a real person texting, not an email.',
    'No subject line, no signature, no markdown, no surrounding quotes.',
    'Return only the message text.',
  ].join(' ');

  const context = transcript
    ? `Recent conversation with ${chatName}${isGroup ? ' (group chat)' : ''}:\n${transcript}`
    : `There is no previous conversation with ${chatName}${isGroup ? ' (group chat)' : ''}. Start it naturally.`;

  const task = clean(instruction, 600) || 'Write the next message in this conversation.';

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${context}\n\nTask: ${task}` },
    ],
    maxTokens: length === 'longo' ? 700 : length === 'curto' ? 350 : 500,
  };
}
