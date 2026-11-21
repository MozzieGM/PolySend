import type { Briefing } from '../types';

export interface Preset {
  id: string;
  label: string;
  description: string;
  briefing: Briefing;
}

export const DEFAULT_BRIEFING: Briefing = {
  recipient: 'Mariana Costa · mariana@northwind.com',
  company: 'Northwind Tecnologia',
  topic:
    'Pedir um orçamento para o desenvolvimento de um aplicativo de logística, com previsão de lançamento em oito semanas.',
  details:
    'Precisamos de escopo, prazo e faixa de investimento. Temos preferência por reuniões online na parte da tarde.',
  signature: 'Ana Souza\nHead de Produto · Acme',
  tone: 'profissional',
  length: 'medio',
  language: 'pt-BR',
};

export const PRESETS: Preset[] = [
  {
    id: 'orcamento',
    label: 'Pedir orçamento',
    description: 'Proposta para um app de logística',
    briefing: DEFAULT_BRIEFING,
  },
  {
    id: 'followup',
    label: 'Fazer follow-up',
    description: 'Retomar uma proposta parada',
    briefing: {
      recipient: 'Rafael Lima · rafael@lumen.com.br',
      company: 'Lumina Studio',
      topic:
        'Retomar a conversa sobre a proposta comercial enviada há uma semana e entender se há dúvidas antes da decisão.',
      details:
        'A proposta vence na sexta-feira. Ser breve e sem pressão. Oferecer uma call rápida se fizer sentido.',
      signature: 'Ana Souza\nHead de Produto · Acme',
      tone: 'amigavel',
      length: 'curto',
      language: 'pt-BR',
    },
  },
  {
    id: 'reuniao',
    label: 'Marcar reunião',
    description: 'Apresentar a plataforma em 30 min',
    briefing: {
      recipient: 'Camila Torres · camila@vertex.io',
      company: 'Vertex Labs',
      topic:
        'Propor uma reunião de 30 minutos para apresentar a plataforma e entender as prioridades do time de operações.',
      details:
        'Sugerir terça ou quinta, em período da tarde. Enviar link do calendário e uma pauta curta.',
      signature: 'Ana Souza\nHead de Produto · Acme',
      tone: 'profissional',
      length: 'curto',
      language: 'pt-BR',
    },
  },
  {
    id: 'cobranca',
    label: 'Cobrar com jeito',
    description: 'Fatura vencida, sem atrito',
    briefing: {
      recipient: 'Bruno Alves · financeiro@magma.com',
      company: 'Magma Studio',
      topic: 'Cobrar de forma cordial o pagamento da fatura #1042, vencida há cinco dias.',
      details:
        'Valor de R$ 4.800. O boleto foi reenviado por e-mail. Oferecer ajuda caso exista algum impedimento.',
      signature: 'Ana Souza\nFinanceiro · Acme',
      tone: 'empatico',
      length: 'curto',
      language: 'pt-BR',
    },
  },
];

export const TONE_OPTIONS = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'direto', label: 'Direto' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'persuasivo', label: 'Persuasivo' },
  { value: 'empatico', label: 'Empático' },
  { value: 'formal', label: 'Formal' },
] as const;

export const LENGTH_OPTIONS = [
  { value: 'curto', label: 'Curto', hint: 'até 90 palavras' },
  { value: 'medio', label: 'Médio', hint: '120–170 palavras' },
  { value: 'longo', label: 'Longo', hint: '200–260 palavras' },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const;

export const REFINEMENTS = [
  {
    id: 'curto',
    label: 'Mais curto',
    instruction:
      'Deixe o corpo mais curto e direto, preservando o pedido principal, os fatos e a assinatura.',
  },
  {
    id: 'formal',
    label: 'Mais formal',
    instruction: 'Deixe o tom mais formal e polido, sem ficar rígido ou burocrático.',
  },
  {
    id: 'persuasivo',
    label: 'Mais persuasivo',
    instruction:
      'Torne o texto mais persuasivo, destacando o valor para o destinatário sem exageros.',
  },
  {
    id: 'cordial',
    label: 'Mais cordial',
    instruction: 'Deixe o tom mais cordial e empático, mantendo a clareza e o profissionalismo.',
  },
  {
    id: 'cta',
    label: 'CTA mais claro',
    instruction:
      'Deixe o próximo passo (chamada para ação) mais claro, específico e fácil de responder.',
  },
];

export const TRANSLATE_INSTRUCTION = {
  toEnglish:
    'Traduza o corpo do e-mail para inglês natural e profissional, mantendo nomes, números, formatação e a assinatura.',
  toPortuguese:
    'Traduza o corpo do e-mail para português do Brasil natural e profissional, mantendo nomes, números, formatação e a assinatura.',
} as const;
