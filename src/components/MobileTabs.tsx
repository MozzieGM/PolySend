import { LayoutGrid, Mail, PenLine } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export type MobileTab = 'briefing' | 'email' | 'models';

interface MobileTabsProps {
  active: MobileTab;
  modelCount: number;
  onChange: (tab: MobileTab) => void;
}

const TABS = [
  { id: 'briefing' as const, label: 'tabs.briefing', icon: PenLine },
  { id: 'email' as const, label: 'tabs.email', icon: Mail },
  { id: 'models' as const, label: 'tabs.models', icon: LayoutGrid },
] as const;

export function MobileTabs({ active, modelCount, onChange }: MobileTabsProps) {
  const { t } = useI18n();

  return (
    <nav className="mobile-tabs" aria-label={t('tabs.navAria')}>
      <div className="mobile-tabs-inner">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`mobile-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-tab-icon">
                <Icon size={17} strokeWidth={2} />
                {tab.id === 'models' && modelCount > 0 && (
                  <span className="mobile-tab-badge">{modelCount}</span>
                )}
              </span>
              <span>{t(tab.label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
