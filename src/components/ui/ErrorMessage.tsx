import { AlertCircle } from 'lucide-react';

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'rgba(191, 75, 44, 0.08)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)',
        color: 'var(--accent)',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
