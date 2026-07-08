import { Loader2 } from 'lucide-react';

/**
 * Spinner Lucide. Par défaut décoratif (aria-hidden) — à utiliser à côté d'un
 * texte visible. Passer `label` quand le spinner est SEUL (bouton en cours de
 * soumission, zone de chargement sans texte) : il est alors annoncé comme
 * role="status" avec le libellé en sr-only (WCAG 4.1.3).
 */
export function LoadingSpinner({ size = 16, className = '', label }: { size?: number; className?: string; label?: string }) {
  const icon = <Loader2 size={size} className={`animate-spin ${className}`} style={{ color: 'var(--accent)' }} aria-hidden="true" />;
  if (!label) return icon;
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center' }}>
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
