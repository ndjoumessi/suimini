import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} style={{ color: 'var(--accent)' }} aria-hidden="true" />;
}
