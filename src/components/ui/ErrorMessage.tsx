'use client';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Inline error with optional retry. Uses the danger token (not the brand gold);
 *  the message text stays cream for legibility, retry label is i18n'd. */
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'color-mix(in srgb, var(--danger) 12%, var(--bg-card))',
        border: '1px solid var(--danger)',
        borderRadius: 'var(--radius)',
        color: 'var(--text)',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--danger)' }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}
