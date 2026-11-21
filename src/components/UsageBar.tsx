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
import { useI18n } from '../lib/i18n';

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
  const { locale } = useI18n();
  const percent = window?.percent ?? null;
  const tone = meterTone(percent);
  const width = Math.min(100, Math.max(percent ?? 0, percent && percent > 0 ? 1.5 : 0));
  const resetsAt = formatReset(window?.resetsAt, locale);

  return (
    <div className={`usage-mini tone-${tone}`}>
      <div className="usage-mini-top">
        <span>{label}</span>
        <strong>{formatPercent(percent)}</strong>
      </div>
      <div className="usage-mini-track">
        <i style={{ width: `${width}%` }} />
      </div>
      <div className="usage-mini-reset" title={resetsAt}>
        {resetsAt}
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
  const { locale, t } = useI18n();
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
    <section className="panel usage-bar" id="plan-usage" aria-label={t('usage.title')}>
      <div className="usage-bar-head">
        <div className="usage-bar-title">
          <span className="usage-pulse" aria-hidden="true" />
          <span className="eyebrow">{t('usage.title')}</span>
          <span className="usage-plan-name">
            {PLAN_LABELS[plan]} · {PLAN_PRICES[plan][locale]}
          </span>
        </div>
        <div className="usage-bar-actions">
          <span className="usage-updated">
            {usageLoading
              ? t('usage.syncing')
              : usage
                ? formatRelative(usage.fetchedAt, locale)
                : '—'}
          </span>
          <button
            type="button"
            className="icon-btn usage-refresh"
            onClick={onRefresh}
            disabled={usageLoading || !hasKey}
            title={t('usage.refreshTitle')}
            aria-label={t('usage.refreshAria')}
          >
            <RefreshCw size={13} className={usageLoading ? 'is-spinning' : ''} />
          </button>
          <a
            className="usage-console"
            href="https://opencode.ai/console/go"
            target="_blank"
            rel="noreferrer"
            title={t('usage.consoleTitle')}
          >
            <span>{t('usage.console')}</span>
            <ArrowUpRight size={11} strokeWidth={2.2} />
          </a>
        </div>
      </div>

      {!hasKey ? (
        <div className="usage-bar-note">
          <KeyRound size={13} strokeWidth={2} />
          <span>{t('usage.noKey')}</span>
          <button type="button" className="text-btn" onClick={onOpenKey}>
            {t('usage.connect')}
          </button>
        </div>
      ) : usage?.available ? (
        <>
          <div className="usage-meter-row">
            <MiniMeter label={t('usage.window5h')} window={usage.rolling} />
            <MiniMeter label={t('usage.week')} window={usage.weekly} />
            <MiniMeter label={t('usage.month')} window={usage.monthly} />
          </div>
          <div className="usage-bar-foot">
            <div className="usage-foot-main">
              <span className="usage-foot-item">
                {t('usage.footRequests', { count: stats.runs })}
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                {t('usage.footTokens', {
                  input: formatTokens(stats.inputTokens),
                  output: formatTokens(stats.outputTokens),
                })}
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                {t('usage.footTable', { cost: formatCost(stats.listCost) })}
              </span>
              <span className="usage-foot-sep" aria-hidden="true" />
              <span className="usage-foot-item">
                {t('usage.footPlan', { cost: formatCost(stats.allowance) })}
              </span>
              {sessionLabel && (
                <span
                  className="usage-foot-limit"
                  title={t('models.limitTitle', {
                    price: formatUSD(limit ?? 0, 0),
                    model: model?.name ?? t('email.noModel'),
                    plan: PLAN_LABELS[plan],
                  })}
                >
                  {t('usage.footSession', { percent: sessionLabel })}
                </span>
              )}
            </div>
            <div className="usage-foot-side">
              <span title={t('usage.ttftTitle')}>
                <Timer size={11} strokeWidth={2} />
                {formatDuration(stats.lastTtftMs)}
              </span>
              <span title={t('usage.tpsTitle')}>
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
              (usageLoading ? t('usage.fetching') : t('usage.unavailable'))}
          </span>
          <button type="button" className="text-btn" onClick={onRefresh} disabled={usageLoading}>
            <RefreshCw size={11} className={usageLoading ? 'is-spinning' : ''} />
            {t('usage.update')}
          </button>
        </div>
      )}
    </section>
  );
}
