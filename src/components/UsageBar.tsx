import {
  ArrowUpRight,
  KeyRound,
  RefreshCw,
  Timer,
  Zap,
} from 'lucide-react';
import type { GoUsage, Model, Plan, SessionStats, UsageWindow } from '../types';
import {
  formatCost,
  formatDuration,
  formatPercent,
  formatRate,
  formatRelative,
  formatReset,
  formatTokens,
  formatUSD,
} from '../lib/format';
import { PLAN_LABELS, PLAN_PRICES, monthlyLimit } from '../lib/models';

interface UsageBarProps {
  usage: GoUsage | null;
  usageLoading: boolean;
  usageError: string | null;
  stats: SessionStats;
  plan: Plan;
  model: Model | null;
  hasKey: boolean;
  onRefresh: () => void;
  onOpenKey: () => void;
}

function meterTone(percent: number | null): string {
  if (percent == null) return 'unknown';
  if (percent >= 85) return 'danger';
  if (percent >= 60) return 'warn';
  return 'ok';
}

function MiniMeter({ label, window }: { label: string; window: UsageWindow | null }) {
  const percent = window?.percent ?? null;
  const tone = meterTone(percent);
  const width = Math.min(100, Math.max(percent ?? 0, percent && percent > 0 ? 1.5 : 0));

  return (
    <div className={`usage-mini tone-${tone}`}>
      <div className="usage-mini-top">
        <span>{label}</span>
        <strong>{formatPercent(percent)}</strong>
      </div>
      <div className="usage-mini-track">
        <i style={{ width: `${width}%` }} />
      </div>
      <div className="usage-mini-reset" title={`Renova ${formatReset(window?.resetsAt)}`}>
        renova {formatReset(window?.resetsAt)}
      </div>
    </div>
  );
}

export function UsageBar({
  usage,
  usageLoading,
  usageError,
  stats,
  plan,
  model,
  hasKey,
  onRefresh,
  onOpenKey,
}: UsageBarProps) {
  const limit = monthlyLimit(model, plan);
  const sessionPercent = limit && limit > 0 ? (stats.allowance / limit) * 100 : null;
  const sessionLabel =
    sessionPercent == null
      ? null
      : sessionPercent === 0
        ? '0%'
        : sessionPercent < 0.01
          ? '<0.01%'
          : formatPercent(sessionPercent);

  return (
    <section className="panel usage-bar" id="plan-usage" aria-label="Consumo do plano">
      <div className="usage-bar-head">
        <div className="usage-bar-title">
          <span className="usage-pulse" aria-hidden="true" />
          <span className="eyebrow">consumo do plano</span>
          <span className="usage-plan-name">
            {PLAN_LABELS[plan]} · {PLAN_PRICES[plan]}
          </span>
        </div>
        <div className="usage-bar-actions">
          <span className="usage-updated">
            {usageLoading ? 'sincronizando' : usage ? formatRelative(usage.fetchedAt) : '—'}
          </span>
          <button
            type="button"
            className="icon-btn usage-refresh"
            onClick={onRefresh}
            disabled={usageLoading || !hasKey}
            title="Atualizar consumo do plano"
            aria-label="Atualizar consumo do plano"
          >
            <RefreshCw size={13} className={usageLoading ? 'is-spinning' : ''} />
          </button>
          <a
            className="usage-console"
            href="https://opencode.ai/console/go"
            target="_blank"
            rel="noreferrer"
            title="Abrir o OpenCode Console"
          >
            <span>Console</span>
            <ArrowUpRight size={11} strokeWidth={2.2} />
          </a>
        </div>
      </div>

      {!hasKey ? (
        <div className="usage-bar-note">
          <KeyRound size={13} strokeWidth={2} />
          <span>Conecte sua chave para acompanhar as janelas reais do Go.</span>
          <button type="button" className="text-btn" onClick={onOpenKey}>
            Conectar API
          </button>
        </div>
      ) : usage?.available ? (
        <>
          <div className="usage-meter-row">
            <MiniMeter label="5 horas" window={usage.rolling} />
            <MiniMeter label="Semana" window={usage.weekly} />
            <MiniMeter label="Mês" window={usage.monthly} />
          </div>
          <div className="usage-bar-foot">
            <div className="usage-foot-main">
              <span className="usage-foot-item">
                <strong>{stats.runs}</strong> req.
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                {formatTokens(stats.inputTokens)} in · {formatTokens(stats.outputTokens)} out
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                tabela <strong>{formatCost(stats.listCost)}</strong>
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                plano <strong className="accent">{formatCost(stats.allowance)}</strong>
              </span>
              {sessionLabel && (
                <span
                  className="usage-foot-limit"
                  title={`${formatUSD(limit ?? 0, 0)} de limite mensal para ${model?.name ?? 'este modelo'} no ${PLAN_LABELS[plan]}`}
                >
                  sessão {sessionLabel} do limite
                </span>
              )}
            </div>
            <div className="usage-foot-side">
              <span title="Time to first token">
                <Timer size={11} strokeWidth={2} />
                {formatDuration(stats.lastTtftMs)}
              </span>
              <span title="Tokens por segundo">
                <Zap size={11} strokeWidth={2} />
                {formatRate(stats.lastTps)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="usage-bar-note">
          <span>
            {usageError ??
              usage?.message ??
              (usageLoading
                ? 'Buscando o consumo do plano…'
                : 'Consumo do plano indisponível para esta chave.')}
          </span>
          <button type="button" className="text-btn" onClick={onRefresh} disabled={usageLoading}>
            <RefreshCw size={11} className={usageLoading ? 'is-spinning' : ''} />
            Atualizar
          </button>
        </div>
      )}
    </section>
  );
}
