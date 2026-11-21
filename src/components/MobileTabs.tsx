import { LayoutGrid, Mail, PenLine } from 'lucide-react';

export type MobileTab = 'briefing' | 'email' | 'models';

interface MobileTabsProps {
  active: MobileTab;
  modelCount: number;
  onChange: (tab: MobileTab) => void;
}

const TABS = [
  { id: 'briefing' as const, label: 'Briefing', icon: PenLine },
  { id: 'email' as const, label: 'E-mail', icon: Mail },
  { id: 'models' as const, label: 'Modelos', icon: LayoutGrid },
];

export function MobileTabs({ active, modelCount, onChange }: MobileTabsProps) {
  return (
    <nav className="mobile-tabs" aria-label="Navegação do estúdio">
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
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
