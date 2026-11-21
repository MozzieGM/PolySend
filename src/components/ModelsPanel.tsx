import { useMemo, useState } from 'react';
import {
  Check,
  KeyRound,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import type { KeySource, Model, Plan } from '../types';
import { formatRelative, formatTokens, formatUSD } from '../lib/format';
import { PLAN_LABELS, PLAN_PRICES, monthlyLimit } from '../lib/models';

type Filter = 'todos' | 'destaques' | 'gratis' | 'zdr';

interface ModelsPanelProps {
  models: Model[];
  selectedId: string;
  plan: Plan;
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
  source: KeySource;
  hasKey: boolean;
  isDrawer?: boolean;
  onSelect: (id: string) => void;
  onPlanChange: (plan: Plan) => void;
  onRefresh: () => void;
  onOpenKey: () => void;
  onClose?: () => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'destaques', label: 'Destaques' },
  { id: 'gratis', label: 'Grátis' },
  { id: 'zdr', label: 'ZDR' },
];

export function ModelsPanel({
  models,
  selectedId,
  plan,
  loading,
  error,
  fetchedAt,
  source,
  hasKey,
  isDrawer = false,
  onSelect,
  onPlanChange,
  onRefresh,
  onOpenKey,
  onClose,
}: ModelsPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return models.filter((model) => {
      if (filter === 'destaques' && !model.go.featured) return false;
      if (filter === 'gratis' && !model.free) return false;
      if (filter === 'zdr' && !model.go.zdr) return false;
      if (!term) return true;
      return (
        model.name.toLowerCase().includes(term) ||
        model.id.toLowerCase().includes(term) ||
        (model.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [models, filter, query]);

  const planLabel = PLAN_LABELS[plan];

  return (
    <aside className={`panel models-panel ${isDrawer ? 'is-drawer' : ''}`}>
      <div className="models-head">
        <div>
          <span className="eyebrow">03 · catálogo ao vivo</span>
          <h2>Modelos Go</h2>
        </div>
        <div className="models-head-actions">
          <span className={`live-tag ${loading ? 'is-loading' : ''}`}>
            <span className="live-tag-dot" />
            {loading ? 'sync' : `${models.length}`}
          </span>
          <button
            type="button"
            className={`icon-btn ${loading ? 'is-spinning' : ''}`}
            onClick={onRefresh}
            disabled={loading || !hasKey}
            title="Atualizar catálogo em tempo real"
            aria-label="Atualizar catálogo de modelos"
          >
            <RefreshCw size={15} strokeWidth={2} />
          </button>
          {isDrawer && onClose && (
            <button
              type="button"
              className="icon-btn drawer-close"
              onClick={onClose}
              title="Fechar catálogo"
              aria-label="Fechar catálogo"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      <div className="plan-switcher">
        <div className="plan-switcher-head">
          <span>
            <SlidersHorizontal size={12} strokeWidth={2.2} />
            Limite mensal por modelo
          </span>
          <span className="plan-name">
            {planLabel} · {PLAN_PRICES[plan]}
          </span>
        </div>
        <div className="segmented plan-segmented" role="group" aria-label="Plano Go">
          {(['go', 'go-plus', 'go-teams'] as Plan[]).map((option) => (
            <button
              key={option}
              type="button"
              className={plan === option ? 'is-selected' : ''}
              aria-pressed={plan === option}
              onClick={() => onPlanChange(option)}
            >
              {PLAN_LABELS[option].replace('Go ', '')}
            </button>
          ))}
        </div>
        <p className="plan-caption">
          Preços base por 1M de tokens. O limite mensal vale se você usar só este modelo — o
          consumo é compartilhado.
        </p>
      </div>

      {!hasKey ? (
        <div className="models-empty">
          <span className="models-empty-icon">
            <KeyRound size={20} strokeWidth={1.9} />
          </span>
          <h3>Conecte a API</h3>
          <p>Cole sua chave do OpenCode Go para carregar os modelos e os preços ao vivo.</p>
          <button type="button" className="btn btn-primary btn-small" onClick={onOpenKey}>
            <KeyRound size={13} strokeWidth={2.2} />
            Configurar API
          </button>
        </div>
      ) : error ? (
        <div className="models-error">
          <p>{error}</p>
          <div className="models-error-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={onRefresh}>
              <RefreshCw size={13} strokeWidth={2.2} />
              Tentar de novo
            </button>
            <button type="button" className="text-btn" onClick={onOpenKey}>
              Trocar chave
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="models-tools">
            <label className="search-field">
              <Search size={14} strokeWidth={2} />
              <input
                id="model-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar modelo…"
                aria-label="Buscar modelo"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                >
                  <X size={12} strokeWidth={2.4} />
                </button>
              )}
            </label>
            <div className="filter-row" role="group" aria-label="Filtrar modelos">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`filter-chip ${filter === option.id ? 'is-selected' : ''}`}
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="model-list" role="listbox" aria-label="Modelos do OpenCode Go">
            {loading && models.length === 0
              ? Array.from({ length: 6 }, (_, index) => (
                  <div className="model-skeleton" key={index} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                ))
              : filtered.map((model) => {
                  const selected = model.id === selectedId;
                  const limit = monthlyLimit(model, plan);
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`model-item ${selected ? 'is-selected' : ''}`}
                      onClick={() => onSelect(model.id)}
                      title={model.description ?? model.name}
                    >
                      <span className="model-item-top">
                        <span className="model-item-name">
                          {model.go.featured && (
                            <Star
                              className="model-star"
                              size={11}
                              strokeWidth={2.4}
                              aria-label="Modelo em destaque"
                            />
                          )}
                          {model.name}
                        </span>
                        <span className="model-item-badges">
                          {model.free && <span className="mini-badge free">grátis</span>}
                          {model.go.zdr && <span className="mini-badge zdr">zdr</span>}
                        </span>
                        <span className={`model-radio ${selected ? 'is-selected' : ''}`}>
                          {selected && <Check size={10} strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="model-item-pricing">
                        <span>
                          {formatUSD(model.price.input, 2)} <i>in</i>
                        </span>
                        <span className="price-arrow">→</span>
                        <span>
                          {formatUSD(model.price.output, 2)} <i>out</i>
                        </span>
                        <span className="price-unit">/1M</span>
                        <span className="model-context">
                          {formatTokens(model.context)} ctx
                        </span>
                      </span>
                      <span className="model-item-limit">
                        {model.free
                          ? 'não consome o plano'
                          : limit != null
                            ? `${formatUSD(limit, 0)}/mês no ${planLabel}`
                            : 'limite não informado'}
                      </span>
                    </button>
                  );
                })}
            {!loading && filtered.length === 0 && (
              <div className="models-no-results">
                <p>Nenhum modelo encontrado com esse filtro.</p>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setQuery('');
                    setFilter('todos');
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          <div className="models-foot">
            <span>
              {filtered.length} de {models.length} · {formatRelative(fetchedAt)}
              {source !== 'none' && (
                <em>{source === 'server' ? 'via .env' : 'via painel'}</em>
              )}
            </span>
            <span className="models-foot-api">go/v1/models</span>
          </div>
        </>
      )}
    </aside>
  );
}
