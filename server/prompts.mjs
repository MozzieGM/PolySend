const TONES_PT = {
  profissional: 'profissional, cordial e direto',
  direto: 'direto e objetivo, com frases curtas',
  amigavel: 'amigável e próximo, sem perder o profissionalismo',
  persuasivo: 'persuasivo e confiante, com foco no valor para o destinatário',
  empatico: 'empático e atencioso, reconhecendo o contexto do destinatário',
  formal: 'formal e respeitoso, sem soar burocrático',
};

const TONES_EN = {
  profissional: 'professional, warm, and direct',
  direto: 'direct and objective, with short sentences',
  amigavel: 'friendly and approachable without losing professionalism',
  persuasivo: 'persuasive and confident, focused on the value for the recipient',
  empatico: 'empathetic and considerate, acknowledging the recipient’s context',
  formal: 'formal and respectful without sounding bureaucratic',
};

const LENGTHS_PT = {
  curto: 'no máximo 90 palavras',
  medio: 'entre 120 e 170 palavras',
  longo: 'entre 200 e 260 palavras',
};

const LENGTHS_EN = {
  curto: 'at most 90 words',
  medio: 'between 120 and 170 words',
  longo: 'between 200 and 260 words',
};

const LANGUAGE_NAMES_PT = {
  'pt-BR': 'português do Brasil',
  en: 'inglês',
  es: 'espanhol',
};

const LANGUAGE_NAMES_EN = {
  'pt-BR': 'Brazilian Portuguese',
  en: 'English',
  es: 'Spanish',
};

const PT = {
  language: 'pt-BR',
  systemIntro:
    'Você é um ghostwriter sênior especializado em e-mails corporativos. Escreve como uma pessoa experiente e atenta: claro, específico, educado e sem soar artificial.',
  languageTitle: 'IDIOMA',
  languageRule: (name) =>
    `Escreva o e-mail inteiro em ${name}. Use o registro natural desse idioma.`,
  languageLock: (name) =>
    `IMPORTANTE: o assunto e o corpo devem estar em ${name}. Não responda em outro idioma.`,
  formatTitle: 'FORMATO OBRIGATÓRIO (sem nada antes ou depois)',
  subjectLabel: 'Assunto',
  subjectHint: 'assunto específico com no máximo 80 caracteres',
  bodyPlaceholder: 'corpo completo do e-mail',
  rulesTitle: 'REGRAS',
  rules: [
    'O corpo deve ter saudação adequada, contexto curto, mensagem principal com um próximo passo explícito, fechamento e assinatura.',
    'Parágrafos curtos. Sem markdown, sem listas, sem emojis, sem títulos.',
    'Não invente números, prazos, nomes, empresas ou compromissos que não estejam no briefing.',
    'Não use clichês como "Espero que este e-mail o encontre bem", "Venho por meio desta" ou "Sem mais delongas".',
    'Não escreva notas para o usuário e não explique o que fez.',
  ],
  signatureLabel: 'A assinatura deve ser exatamente:',
  fallbackSignature: '[Seu nome]',
  briefingTitle: 'Briefing do e-mail:',
  generateInstruction: 'Escreva o e-mail seguindo o formato obrigatório.',
  labels: {
    recipient: 'Destinatário',
    company: 'Empresa',
    topic: 'Objetivo do e-mail',
    details: 'Contexto adicional',
    tone: 'Tom desejado',
    length: 'Extensão desejada',
    language: 'Idioma',
  },
  refineIntro:
    'Você é um ghostwriter sênior especializado em e-mails corporativos. Está revisando um e-mail existente a pedido do autor.',
  refineRules: [
    'Devolva SOMENTE o corpo revisado. Não inclua a linha "Assunto:", markdown, títulos ou comentários.',
    'Mantenha a saudação, o fechamento, a assinatura e o idioma do e-mail original, a menos que a instrução peça explicitamente uma tradução.',
    'Preserve todos os fatos, números, nomes, prazos e compromissos. Não acrescente informações novas.',
    'Aplique a instrução sem mudar o significado nem o objetivo do e-mail.',
    'Parágrafos curtos, tom natural, sem clichês.',
  ],
  refineUser: (context, body, instruction) =>
    `Contexto do e-mail:\n${context}\n\nE-mail atual:\n---\n${body}\n---\n\nInstrução de revisão: ${instruction}\n\nDevolva apenas o corpo final revisado.`,
  selectionIntro:
    'Você é um editor de texto sênior. Receberá um e-mail completo, um trecho selecionado e uma instrução.',
  selectionRules: [
    'Devolva SOMENTE o texto que substituirá o trecho selecionado.',
    'Não use aspas, crases, markdown ou explicações.',
    'Mantenha o idioma, o tom e a coerência gramatical com o restante do e-mail.',
    'Não invente fatos, números, nomes ou compromissos.',
  ],
  selectionUser: (context, body, selection, instruction) =>
    `Contexto do e-mail:\n${context}\n\nE-mail completo:\n---\n${body}\n---\n\nTrecho selecionado:\n---\n${selection}\n---\n\nInstrução: ${instruction}\n\nDevolva apenas o texto substituto do trecho.`,
};

const EN = {
  language: 'en',
  systemIntro:
    'You are a senior ghostwriter specialized in corporate emails. You write like an experienced, attentive person: clear, specific, polite, and never artificial.',
  languageTitle: 'LANGUAGE',
  languageRule: (name) =>
    `Write the entire email in ${name}. Use the natural register of that language.`,
  languageLock: (name, forbidden) =>
    `IMPORTANT: The subject and body must be written in ${name}. Do not reply in ${forbidden}.`,
  formatTitle: 'MANDATORY FORMAT (nothing before or after)',
  subjectLabel: 'Subject',
  subjectHint: 'specific subject, maximum 80 characters',
  bodyPlaceholder: 'full email body',
  rulesTitle: 'RULES',
  rules: [
    'The body must include a suitable greeting, short context, the main message with an explicit next step, a closing, and a signature.',
    'Short paragraphs. No markdown, lists, emojis, or headings.',
    'Do not invent numbers, deadlines, names, companies, or commitments that are not in the briefing.',
    'Avoid clichés such as "I hope this email finds you well", "I am writing to", or "Without further ado".',
    'Do not write notes to the user and do not explain what you did.',
  ],
  signatureLabel: 'The signature must be exactly:',
  fallbackSignature: '[Your name]',
  briefingTitle: 'Email briefing:',
  generateInstruction: 'Write the email following the mandatory format.',
  labels: {
    recipient: 'Recipient',
    company: 'Company',
    topic: 'Email goal',
    details: 'Additional context',
    tone: 'Desired tone',
    length: 'Desired length',
    language: 'Language',
  },
  refineIntro:
    'You are a senior ghostwriter specialized in corporate emails. You are revising an existing email at the author’s request.',
  refineRules: [
    'Return ONLY the revised body. Do not include the "Subject:" line, markdown, headings, or comments.',
    'Keep the greeting, closing, signature, and language of the original email unless the instruction explicitly asks for a translation.',
    'Preserve every fact, number, name, deadline, and commitment. Do not add new information.',
    'Apply the instruction without changing the meaning or goal of the email.',
    'Short paragraphs, natural tone, no clichés.',
  ],
  refineUser: (context, body, instruction) =>
    `Email context:\n${context}\n\nCurrent email:\n---\n${body}\n---\n\nRevision instruction: ${instruction}\n\nReturn only the final revised body.`,
  selectionIntro:
    'You are a senior text editor. You will receive a complete email, a selected passage, and an instruction.',
  selectionRules: [
    'Return ONLY the text that will replace the selected passage.',
    'Do not use quotes, backticks, markdown, or explanations.',
    'Keep the language, tone, and grammatical consistency with the rest of the email.',
    'Do not invent facts, numbers, names, or commitments.',
  ],
  selectionUser: (context, body, selection, instruction) =>
    `Email context:\n${context}\n\nFull email:\n---\n${body}\n---\n\nSelected passage:\n---\n${selection}\n---\n\nInstruction: ${instruction}\n\nReturn only the replacement text for the passage.`,
};

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function languageKey(briefing) {
  return briefing?.language === 'pt-BR' ? 'pt-BR' : briefing?.language === 'es' ? 'es' : 'en';
}

function copyFor(briefing) {
  return briefing?.language === 'pt-BR' ? PT : EN;
}

function languageName(briefing) {
  const key = languageKey(briefing);
  return briefing?.language === 'pt-BR'
    ? LANGUAGE_NAMES_PT[key]
    : LANGUAGE_NAMES_EN[key];
}

function tone(briefing) {
  const map = briefing?.language === 'pt-BR' ? TONES_PT : TONES_EN;
  return map[briefing?.tone] ?? map.profissional;
}

function length(briefing) {
  const map = briefing?.language === 'pt-BR' ? LENGTHS_PT : LENGTHS_EN;
  return map[briefing?.length] ?? map.medio;
}

function signature(briefing) {
  return clean(briefing?.signature, 300) || copyFor(briefing).fallbackSignature;
}

function briefingBlock(briefing) {
  const copy = copyFor(briefing);
  const recipient = clean(briefing?.recipient, 200) || (copy === PT ? 'não informado' : 'not provided');
  const company = clean(briefing?.company, 160) || (copy === PT ? 'não informada' : 'not provided');
  const topic = clean(briefing?.topic, 2500);
  const details = clean(briefing?.details, 2000) || (copy === PT ? 'nenhum' : 'none');

  return [
    `- ${copy.labels.recipient}: ${recipient}`,
    `- ${copy.labels.company}: ${company}`,
    `- ${copy.labels.topic}: ${topic}`,
    `- ${copy.labels.details}: ${details}`,
    `- ${copy.labels.tone}: ${tone(briefing)}`,
    `- ${copy.labels.length}: ${length(briefing)}`,
    `- ${copy.labels.language}: ${languageName(briefing)}`,
  ].join('\n');
}

function baseSystem(briefing) {
  const copy = copyFor(briefing);
  const name = languageName(briefing);
  const forbidden =
    briefing?.language === 'es' ? (copy === PT ? 'português ou inglês' : 'Portuguese or English') : copy === PT ? 'outro idioma' : 'Portuguese';

  return `${copy.systemIntro}

${copy.languageTitle}
${copy.languageRule(name)}
${copy.languageLock(name, forbidden)}

${copy.formatTitle}
${copy.subjectLabel}: <${copy.subjectHint}>
<blank line>
<${copy.bodyPlaceholder}>

${copy.rulesTitle}
${copy.rules.map((rule) => `- ${rule}`).join('\n')}
- ${copy === PT ? 'Extensão alvo do corpo' : 'Target body length'}: ${length(briefing)}.
- ${copy === PT ? 'Tom' : 'Tone'}: ${tone(briefing)}.
- ${copy.signatureLabel}
${signature(briefing)}`;
}

export function buildGenerateMessages(briefing) {
  const copy = copyFor(briefing);
  return [
    { role: 'system', content: baseSystem(briefing) },
    {
      role: 'user',
      content: `${copy.briefingTitle}\n${briefingBlock(briefing)}\n\n${copy.generateInstruction}`,
    },
  ];
}

export function buildRefineMessages(briefing, body, instruction) {
  const copy = copyFor(briefing);
  return [
    {
      role: 'system',
      content: `${copy.refineIntro}

${copy.rulesTitle}
${copy.refineRules.map((rule) => `- ${rule}`).join('\n')}`,
    },
    {
      role: 'user',
      content: copy.refineUser(briefingBlock(briefing), body, instruction),
    },
  ];
}

export function buildSelectionMessages(briefing, body, selection, instruction) {
  const copy = copyFor(briefing);
  return [
    {
      role: 'system',
      content: `${copy.selectionIntro}

${copy.rulesTitle}
${copy.selectionRules.map((rule) => `- ${rule}`).join('\n')}`,
    },
    {
      role: 'user',
      content: copy.selectionUser(briefingBlock(briefing), body, selection, instruction),
    },
  ];
}

export function maxTokensFor(mode, briefing) {
  if (mode === 'selection') return 1600;
  if (mode === 'refine') return 3200;
  return briefing?.length === 'longo' ? 3600 : briefing?.length === 'curto' ? 2000 : 2600;
}
