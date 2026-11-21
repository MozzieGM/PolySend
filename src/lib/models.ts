import type { Locale, Model, Plan } from '../types';

export function monthlyLimit(model: Model | null | undefined, plan: Plan): number | null {
  if (!model?.go.monthlyUsage) return null;
  const usage = model.go.monthlyUsage;
  if (plan === 'go-plus') return usage.goPlus;
  if (plan === 'go-teams') return usage.goTeams;
  return usage.go;
}

export function pickReasoningEffort(model: Model | null | undefined): string | null {
  if (!model?.reasoning.supported) return null;
  for (const effort of ['low', 'minimal', 'none', 'medium', 'high']) {
    if (model.reasoning.efforts.includes(effort)) return effort;
  }
  return null;
}

export const PLAN_LABELS: Record<Plan, string> = {
  go: 'Go',
  'go-plus': 'Go Plus',
  'go-teams': 'Go Teams',
};

export const PLAN_PRICES: Record<Plan, Record<Locale, string>> = {
  go: { en: '$10/mo', 'pt-BR': '$10/mês' },
  'go-plus': { en: '$40/mo', 'pt-BR': '$40/mês' },
  'go-teams': { en: '$20/member/mo', 'pt-BR': '$20/membro/mês' },
};
