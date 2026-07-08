'use client';
import { useEffect, useState } from 'react';
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
  // WCAG 2.2.1 : le survol OU le focus clavier met l'auto-fermeture en pause
  // (elle repart de zéro quand l'utilisateur relâche).
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onDismiss(toast.id), DURATION);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss, paused]);

  // Un vrai <button> : fermable au clavier (Enter/Espace), focusable, nommé par
  // son contenu (le message). L'ancien <div onClick> était inatteignable au clavier.
  return (
    <button
      type="button"
      className={`toast toast-${toast.type}`}
      onClick={() => onDismiss(toast.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      title={tc('clickToClose')}
    >
      <span className="toast-icon"><Icon size={18} aria-hidden="true" /></span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      {!paused && <span className="toast-progress" aria-hidden="true" style={{ animationDuration: `${DURATION}ms` }} />}
    </button>
  );
}

/**
 * Stack of up to 3 toasts, newest at the bottom-right.
 * Le conteneur est une live region MONTÉE EN PERMANENCE (même vide) : une région
 * aria-live injectée en même temps que son contenu n'est pas annoncée de façon
 * fiable par les lecteurs d'écran. Les toasts d'erreur sont enveloppés dans un
 * role="alert" (annonce assertive), les autres restent en "polite".
 */
export default function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const tc = useTranslations('common');
  return (
    // role="status" (aria-live polite implicite) : autorise aria-label sur le div
    // (axe aria-prohibited-attr) tout en gardant la région live permanente.
    <div className="toast-stack" role="status" aria-label={tc('notifications')}>
      {toasts.map(t => (
        <div key={t.id} role={t.type === 'error' ? 'alert' : undefined}>
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
