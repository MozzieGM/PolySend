import {
  BookOpen,
  Gauge,
  KeyRound,
  LayoutGrid,
  Radio,
  Send,
} from 'lucide-react';
import type { ConnectionState, KeySource, Plan } from '../types';
import { formatPercent } from '../lib/format';
import { PLAN_LABELS } from '../lib/models';

interface HeaderProps {
  connection: ConnectionState;
  keySource: KeySource;
  modelCount: number;
  monthlyPercent: number | null;
  plan: Plan;
  onOpenKey: () => void;
  onOpenModels: () => void;
}

const STATUS_LABEL: Record<ConnectionState, string> = {
  loading: 'Conectando',
  ready: 'Go conectado',
  error: 'Falha na conexão',
  nokey: 'API não configurada',
};

const SOURCE_LABEL: Record<KeySource, string> = {
  server: '.env do servidor',
  client: 'chave do painel',
  none: 'configurar',
};

export function Header({
  connection,
  keySource,
  modelCount,
  monthlyPercent,
  plan,
  onOpenKey,
  onOpenModels,
}: HeaderProps) {
  const percent = monthlyPercent ?? 0;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Send size={17} strokeWidth={2.2} />
          </div>
          <div className="brand-copy">
            <div className="brand-line">
              <span className="brand-name">PolySend</span>
              <span className="brand-live">
                <Radio size={10} strokeWidth={2.8} />
                live
              </span>
            </div>
            <span className="brand-sub">email studio · go api</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={`status-pill status-${connection}`}
            onClick={onOpenKey}
            title="Configurar a chave da API"
            aria-label={`Status da API: ${STATUS_LABEL[connection]}. Configurar chave.`}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="status-label">{STATUS_LABEL[connection]}</span>
            <span className="status-divider" aria-hidden="true" />
            <span className="status-source">{SOURCE_LABEL[keySource]}</span>
          </button>

          <div className="plan-pill" title="Consumo mensal do plano Go">
            <Gauge size={14} strokeWidth={2.2} />
            <span className="plan-pill-label">{PLAN_LABELS[plan]}</span>
            <span className="plan-pill-percent">{formatPercent(monthlyPercent)}</span>
            <span className="plan-pill-caption">do mês</span>
            <span className="plan-pill-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
            </span>
          </div>

          <button type="button" className="btn btn-ghost models-toggle" onClick={onOpenModels}>
            <LayoutGrid size={15} strokeWidth={2} />
            <span>Modelos</span>
            <span className="btn-count">{modelCount}</span>
          </button>

          <button
            type="button"
            className="btn btn-key"
            onClick={onOpenKey}
            aria-label="Configurar API"
          >
            <KeyRound size={15} strokeWidth={2} />
            <span className="key-btn-label">Configurar API</span>
          </button>

          <a
            className="icon-btn"
            href="https://opencode.ai/docs/console/go"
            target="_blank"
            rel="noreferrer"
            title="Documentação do OpenCode Go"
            aria-label="Abrir documentação do OpenCode Go"
          >
            <BookOpen size={16} strokeWidth={2} />
          </a>
        </div>
      </div>
    </header>
  );
}
