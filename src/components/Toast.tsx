'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastItem { id: number; msg: string; type: ToastType }

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const DURATION = 3000;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const tc = useTranslations('common');
  const Icon = ICONS[toast.type];
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), DURATION);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="status"
      aria-live="polite"
      onClick={() => onDismiss(toast.id)}
      title={tc('clickToClose')}
    >
      <span className="toast-icon"><Icon size={18} aria-hidden="true" /></span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <span className="toast-progress" style={{ animationDuration: `${DURATION}ms` }} />
    </div>
  );
}

/** Stack of up to 3 toasts, newest at the bottom-right. */
export default function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-label="Notifications">
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}
