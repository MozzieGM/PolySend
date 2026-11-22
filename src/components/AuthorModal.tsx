import { Code2, ExternalLink, Github, Linkedin, Sparkles, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface AuthorModalProps {
  open: boolean;
  onClose: () => void;
}

const GITHUB_URL = 'https://github.com/MozzieGM';
const LINKEDIN_URL = 'https://www.linkedin.com/in/gabrielmartinezdesouza/';

export function AuthorModal({ open, onClose }: AuthorModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="author-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          className="icon-btn author-close"
          onClick={onClose}
          aria-label={t('key.close')}
        >
          <X size={16} strokeWidth={2.2} />
        </button>

        <div className="author-hero">
          <span className="author-avatar">GM</span>
          <span className="eyebrow">{t('author.eyebrow')}</span>
          <h2>Gabriel Martinez de Souza</h2>
          <span className="author-handle">@MozzieGM</span>
          <p>{t('author.bio')}</p>
        </div>

        <div className="author-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            <span className="author-link-icon">
              <Github size={17} strokeWidth={1.8} />
            </span>
            <span>
              <strong>{t('author.github')}</strong>
              <small>github.com/MozzieGM</small>
            </span>
            <ExternalLink size={14} strokeWidth={1.9} />
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
            <span className="author-link-icon">
              <Linkedin size={17} strokeWidth={1.8} />
            </span>
            <span>
              <strong>{t('author.linkedin')}</strong>
              <small>linkedin.com/in/gabrielmartinezdesouza</small>
            </span>
            <ExternalLink size={14} strokeWidth={1.9} />
          </a>
        </div>

        <div className="author-foot">
          <span>{t('author.builtWith')}</span>
          <div className="author-chips">
            <span>
              <Sparkles size={10} strokeWidth={2} />
              OpenCode Go
            </span>
            <span>Resend</span>
            <span>
              <Code2 size={10} strokeWidth={2} />
              Baileys
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
