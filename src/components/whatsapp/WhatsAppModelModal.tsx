import { ModelsPanel } from '../ModelsPanel';
import type { KeySource, Model, Plan } from '../../types';

interface WhatsAppModelModalProps {
  models: Model[];
  selectedId: string;
  plan: Plan;
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
  source: KeySource;
  hasKey: boolean;
  onSelect: (id: string) => void;
  onPlanChange: (plan: Plan) => void;
  onRefresh: () => void;
  onOpenKey: () => void;
  onClose: () => void;
}

export function WhatsAppModelModal({
  models,
  selectedId,
  plan,
  loading,
  error,
  fetchedAt,
  source,
  hasKey,
  onSelect,
  onPlanChange,
  onRefresh,
  onOpenKey,
  onClose,
}: WhatsAppModelModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="wa-model-modal" role="dialog" aria-modal="true">
        <ModelsPanel
          models={models}
          selectedId={selectedId}
          plan={plan}
          loading={loading}
          error={error}
          fetchedAt={fetchedAt}
          source={source}
          hasKey={hasKey}
          isDrawer
          sortFreeFirst
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
          onPlanChange={onPlanChange}
          onRefresh={onRefresh}
          onOpenKey={() => {
            onClose();
            onOpenKey();
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
