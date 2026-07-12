'use client';
/**
 * Slim, dismissible banner surfacing an ongoing Supabase incident. Renders
 * nothing when all systems are operational (indicator 'none'). Mounted under the
 * header, above the main content (see SuiminiApp).
 *
 * - minor  → gold tint (var(--accent)),   role="status"
 * - major  → amber tint (var(--warning)),  role="status", larger warning icon
 * - critical → red tint (var(--danger)),   role="alert"
 *
 * Dismissal is per-incident (sessionStorage) so a NEW incident re-shows it.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { useSupabaseStatus, bannerLevel, dismissKey } from '@/hooks/useSupabaseStatus';

export default function StatusBanner() {
  const status = useSupabaseStatus();
  const t = useTranslations('status');
  const [dismissed, setDismissed] = useState(false);
  const key = dismissKey(status);

  // Re-evaluate dismissal whenever the incident key changes (new incident → show again).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(window.sessionStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const level = bannerLevel(status.indicator);
  if (!level || dismissed) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch { /* ignore */ }
    setDismissed(true);
  };

  const Icon = level.level === 'critical' ? AlertOctagon : AlertTriangle;

  return (
    <div
      role={level.role}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        margin: '8px 10px 0',
        background: `color-mix(in srgb, ${level.color} ${level.tintPct}%, var(--bg-card))`,
        border: `1px solid color-mix(in srgb, ${level.color} 40%, var(--border))`,
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--ink)',
        letterSpacing: '0.02em',
      }}
    >
      <Icon size={level.iconSize} aria-hidden="true" style={{ flexShrink: 0, color: level.color }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{t('bannerTitle')}</strong>
        {status.description ? ` · ${status.description}` : ''}
        {' · '}
        <a
          href="https://status.supabase.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: level.color, textDecoration: 'underline', textUnderlineOffset: '2px' }}
        >
          {t('viewStatus')} <span aria-hidden="true">→</span>
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="btn btn-ghost btn-icon btn-sm"
        style={{ flexShrink: 0, minHeight: '24px' }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
