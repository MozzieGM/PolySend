const TONES = {
  profissional: 'profissional, cordial e direto',
  direto: 'direto e objetivo, com frases curtas',
  amigavel: 'amigável e próximo, sem perder o profissionalismo',
  persuasivo: 'persuasivo e confiante, com foco no valor para o destinatário',
  empatico: 'empático e atencioso, reconhecendo o contexto do destinatário',
  formal: 'formal e respeitoso, sem soar burocrático',
};

const LENGTHS = {
  curto: 'no máximo 90 palavras',
  medio: 'entre 120 e 170 palavras',
  longo: 'entre 200 e 260 palavras',
};

const LANGUAGES = {
  'pt-BR': 'português do Brasil',
  en: 'inglês',
  es: 'espanhol',
};

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function tone(briefing) {
  return TONES[briefing?.tone] ?? TONES.profissional;
}

function length(briefing) {
  return LENGTHS[briefing?.length] ?? LENGTHS.medio;
}

function language(briefing) {
  return LANGUAGES[briefing?.language] ?? LANGUAGES['pt-BR'];
}

function signature(briefing) {
  return clean(briefing?.signature, 300) || '[Seu nome]';
}

function briefingBlock(briefing) {
  const recipient = clean(briefing?.recipient, 200) || 'não informado';
  const company = clean(briefing?.company, 160) || 'não informada';
  const topic = clean(briefing?.topic, 2500);
  const details = clean(briefing?.details, 2000) || 'nenhum';

  return [
    `- Destinatário: ${recipient}`,
    `- Empresa: ${company}`,
    `- Objetivo do e-mail: ${topic}`,
    `- Contexto adicional: ${details}`,
    `- Tom desejado: ${tone(briefing)}`,
    `- Extensão desejada: ${length(briefing)}`,
    `- Idioma: ${language(briefing)}`,
  ].join('\n');
}

function baseSystem(briefing) {
  return `Você é um ghostwriter sênior especializado em e-mails corporativos. Escreve como uma pessoa experiente e atenta: claro, específico, educado e sem soar artificial.

IDIOMA
Escreva o e-mail inteiro em ${language(briefing)}. Use o registro natural desse idioma.

FORMATO OBRIGATÓRIO (sem nada antes ou depois)
Assunto: <assunto específico com no máximo 80 caracteres>
<linha em branco>
<corpo completo do e-mail>

REGRAS
- O corpo deve ter saudação adequada, contexto curto, mensagem principal com um próximo passo explícito, fechamento e assinatura.
- Extensão alvo do corpo: ${length(briefing)}.
- Tom: ${tone(briefing)}.
- Parágrafos curtos. Sem markdown, sem listas, sem emojis, sem títulos.
- Não invente números, prazos, nomes, empresas ou compromissos que não estejam no briefing.
- Não use clichês como "Espero que este e-mail o encontre bem", "Venho por meio desta" ou "Sem mais delongas".
- Não escreva notas para o usuário e não explique o que fez.
- A assinatura deve ser exatamente:
${signature(briefing)}`;
}

export function buildGenerateMessages(briefing) {
  return [
    { role: 'system', content: baseSystem(briefing) },
    {
      role: 'user',
      content: `Briefing do e-mail:\n${briefingBlock(briefing)}\n\nEscreva o e-mail seguindo o formato obrigatório.`,
    },
  ];
}

export function buildRefineMessages(briefing, body, instruction) {
  return [
    {
      role: 'system',
      content: `Você é um ghostwriter sênior especializado em e-mails corporativos. Está revisando um e-mail existente a pedido do autor.

REGRAS
- Devolva SOMENTE o corpo revisado. Não inclua a linha "Assunto:", markdown, títulos ou comentários.
- Mantenha a saudação, o fechamento, a assinatura e o idioma do e-mail original.
- Preserve todos os fatos, números, nomes, prazos e compromissos. Não acrescente informações novas.
- Aplique a instrução sem mudar o significado nem o objetivo do e-mail.
- Parágrafos curtos, tom natural, sem clichês.`,
    },
    {
      role: 'user',
      content: `Contexto do e-mail:\n${briefingBlock(briefing)}\n\nE-mail atual:\n---\n${body}\n---\n\nInstrução de revisão: ${instruction}\n\nDevolva apenas o corpo final revisado.`,
    },
  ];
}

export function buildSelectionMessages(briefing, body, selection, instruction) {
  return [
    {
      role: 'system',
      content: `Você é um editor de texto sênior. Receberá um e-mail completo, um trecho selecionado e uma instrução.

REGRAS
- Devolva SOMENTE o texto que substituirá o trecho selecionado.
- Não use aspas, crases, markdown ou explicações.
- Mantenha o idioma, o tom e a coerência gramatical com o restante do e-mail.
- Não invente fatos, números, nomes ou compromissos.`,
    },
    {
      role: 'user',
      content: `Contexto do e-mail:\n${briefingBlock(briefing)}\n\nE-mail completo:\n---\n${body}\n---\n\nTrecho selecionado:\n---\n${selection}\n---\n\nInstrução: ${instruction}\n\nDevolva apenas o texto substituto do trecho.`,
    },
  ];
}

export function maxTokensFor(mode, briefing) {
  if (mode === 'selection') return 1600;
  if (mode === 'refine') return 3200;
  return briefing?.length === 'longo' ? 3600 : briefing?.length === 'curto' ? 2000 : 2600;
}
