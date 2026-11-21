import type { Briefing, EmailLength, Language, Locale, Tone } from '../types';

export interface Preset {
  id: string;
  label: string;
  description: string;
  briefing: Briefing;
}

const PRESETS_PT: Preset[] = [
  {
    id: 'orcamento',
    label: 'Pedir orçamento',
    description: 'Proposta para um app de logística',
    briefing: {
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
    },
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

const PRESETS_EN: Preset[] = [
  {
    id: 'orcamento',
    label: 'Ask for a quote',
    description: 'Proposal for a logistics app',
    briefing: {
      recipient: 'Jordan Lee · jordan@northwind.com',
      company: 'Northwind Technologies',
      topic:
        'Request a quote for building a logistics app, with an eight-week launch target.',
      details:
        'We need scope, timeline, and a budget range. We prefer online meetings in the afternoon.',
      signature: 'Alex Morgan\nHead of Product · Acme',
      tone: 'profissional',
      length: 'medio',
      language: 'en',
    },
  },
  {
    id: 'followup',
    label: 'Follow up',
    description: 'Reconnect on a stalled proposal',
    briefing: {
      recipient: 'Riley Chen · riley@lumen.studio',
      company: 'Lumen Studio',
      topic:
        'Follow up on the proposal sent a week ago and see if there are any questions before the decision.',
      details:
        'The proposal expires on Friday. Keep it brief and low-pressure. Offer a quick call if useful.',
      signature: 'Alex Morgan\nHead of Product · Acme',
      tone: 'amigavel',
      length: 'curto',
      language: 'en',
    },
  },
  {
    id: 'reuniao',
    label: 'Book a meeting',
    description: 'Present the platform in 30 min',
    briefing: {
      recipient: 'Taylor Brooks · taylor@vertex.io',
      company: 'Vertex Labs',
      topic:
        "Propose a 30-minute meeting to present the platform and understand the operations team's priorities.",
      details:
        'Suggest Tuesday or Thursday afternoon. Include a short agenda and a calendar link.',
      signature: 'Alex Morgan\nHead of Product · Acme',
      tone: 'profissional',
      length: 'curto',
      language: 'en',
    },
  },
  {
    id: 'cobranca',
    label: 'Polite reminder',
    description: 'Overdue invoice, no friction',
    briefing: {
      recipient: 'Morgan Reed · finance@magma.com',
      company: 'Magma Studio',
      topic: 'Politely follow up on invoice #1042, five days overdue.',
      details:
        'Amount: $4,800. The invoice was resent by email. Offer help if there is any issue.',
      signature: 'Alex Morgan\nFinance · Acme',
      tone: 'empatico',
      length: 'curto',
      language: 'en',
    },
  },
];

export function getPresets(locale: Locale): Preset[] {
  return locale === 'pt-BR' ? PRESETS_PT : PRESETS_EN;
}

export function getDefaultBriefing(locale: Locale): Briefing {
  return getPresets(locale)[0].briefing;
}

export const TONE_VALUES: Tone[] = [
  'profissional',
  'direto',
  'amigavel',
  'persuasivo',
  'empatico',
  'formal',
];

export const LENGTH_VALUES: EmailLength[] = ['curto', 'medio', 'longo'];

export const LANGUAGE_VALUES: Language[] = ['pt-BR', 'en', 'es'];
