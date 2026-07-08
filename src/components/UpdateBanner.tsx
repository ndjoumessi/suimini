'use client';
import { Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Controlled PWA-update prompt. Fixed to the bottom, amber "Atelier" tint, sharp
 * corners. Rendered above app content but below modals (`--z-modal`). Inline styles
 * only — no globals.css (owned by another surface).
 */
export default function UpdateBanner({
  onRefresh,
  onDismiss,
}: {
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations('pwa');
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: 'calc(var(--z-modal) - 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '480px',
        width: 'calc(100% - 32px)',
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
        border: 'var(--bw) solid var(--accent)',
        boxShadow: 'var(--shadow)',
        borderRadius: 0,
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        color: 'var(--ink)',
      }}
    >
      <Sparkles size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--accent)' }} />
      <span style={{ flex: 1, minWidth: 0 }}>{t('updateAvailable')}</span>
      <button
        type="button"
        onClick={onRefresh}
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0, minHeight: '30px', padding: '5px 12px' }}
      >
        {t('refresh')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="btn btn-ghost btn-icon btn-sm"
        style={{ flexShrink: 0 }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
