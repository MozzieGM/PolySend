import type { Model, Plan } from '../types';

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

export const PLAN_PRICES: Record<Plan, string> = {
  go: '$10/mês',
  'go-plus': '$40/mês',
  'go-teams': '$20/membro/mês',
};
