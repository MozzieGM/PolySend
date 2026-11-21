import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastProps {
  toast: ToastData | null;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;
  const Icon = ICONS[toast.tone];

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      <Icon size={16} strokeWidth={2.2} />
      <span>{toast.message}</span>
    </div>
  );
}
