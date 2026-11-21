import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';

interface ConnectResult {
  ok: boolean;
  error?: string;
  count?: number;
}

interface KeyModalProps {
  open: boolean;
  serverKeyConfigured: boolean;
  userKeyActive: boolean;
  onClose: () => void;
  onConnect: (key: string) => Promise<ConnectResult>;
  onUseServer: () => Promise<ConnectResult>;
  onDisconnect: () => void;
}

export function KeyModal({
  open,
  serverKeyConfigured,
  userKeyActive,
  onClose,
  onConnect,
  onUseServer,
  onDisconnect,
}: KeyModalProps) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setShow(false);
    setError(null);
    setSuccess(null);
    setBusy(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, busy, onClose]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!open) return null;

  const finishSuccess = (message: string) => {
    setSuccess(message);
    setBusy(false);
    closeTimer.current = window.setTimeout(() => {
      onClose();
    }, 850);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!key || busy) return;

    setBusy(true);
    setError(null);
    const result = await onConnect(key);
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível validar a chave.');
      setBusy(false);
      return;
    }
    finishSuccess(
      `${result.count ?? 0} modelos disponíveis. Chave validada com sucesso.`,
    );
  };

  const handleServer = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onUseServer();
    if (!result.ok) {
      setError(result.error ?? 'A chave do servidor não respondeu.');
      setBusy(false);
      return;
    }
    finishSuccess('Usando a chave do servidor (.env).');
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-modal-title"
      >
        <div className="modal-head">
          <span className="modal-icon">
            <KeyRound size={19} strokeWidth={2} />
          </span>
          <div className="modal-heading">
            <span className="eyebrow">acesso · opencode go</span>
            <h2 id="key-modal-title">Conectar sua API</h2>
          </div>
          <button
            type="button"
            className="icon-btn modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <p className="modal-intro">
          Cole a API key do seu workspace no OpenCode Console. A validação acontece agora, ao
          vivo, contra o catálogo Go.
        </p>

        {success ? (
          <div className="modal-success" role="status">
            <span className="success-check">
              <Check size={16} strokeWidth={3} />
            </span>
            <div>
              <strong>Conectado</strong>
              <p>{success}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="key-form">
            <label className="key-label" htmlFor="api-key">
              <span>API key</span>
              {userKeyActive && <em>já existe uma chave nesta aba</em>}
            </label>
            <div className={`key-input-wrap ${error ? 'has-error' : ''}`}>
              <LockKeyhole size={15} strokeWidth={2} />
              <input
                id="api-key"
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                placeholder="oc_sk_..."
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
              <button
                type="button"
                className="icon-btn key-eye"
                onClick={() => setShow((current) => !current)}
                aria-label={show ? 'Ocultar chave' : 'Mostrar chave'}
                tabIndex={-1}
              >
                {show ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
              </button>
            </div>

            {error && (
              <div className="modal-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary modal-submit"
              disabled={!value.trim() || busy}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="is-spinning" />
                  Validando chave…
                </>
              ) : (
                <>
                  Validar e conectar
                  <ArrowRight size={15} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>
        )}

        {serverKeyConfigured && !success && (
          <>
            <div className="modal-divider">
              <span>ou</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost modal-server"
              onClick={handleServer}
              disabled={busy}
            >
              <Server size={14} strokeWidth={2} />
              Usar a chave do servidor (.env)
            </button>
          </>
        )}

        {userKeyActive && !success && (
          <button type="button" className="modal-disconnect" onClick={onDisconnect} disabled={busy}>
            Remover a chave do painel desta aba
          </button>
        )}

        <div className="modal-help">
          <span className="modal-help-title">Como pegar sua chave</span>
          <ol>
            <li>
              Abra o <a href="https://opencode.ai/console" target="_blank" rel="noreferrer">OpenCode Console <ArrowRight size={10} /></a> e entre no workspace com Go ativo.
            </li>
            <li>Acesse <strong>Account › Personal API keys</strong> e crie uma chave.</li>
            <li>Copie a chave (ela aparece só uma vez) e cole aqui.</li>
          </ol>
        </div>

        <div className="modal-security">
          <ShieldCheck size={15} strokeWidth={2} />
          <p>
            A chave do painel fica apenas no <strong>sessionStorage</strong> desta aba e vai
            direto para o seu backend local. O servidor não grava sua chave em disco. Para
            produção, mantenha a chave somente no servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
