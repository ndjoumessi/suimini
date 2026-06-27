'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowLeft, ArrowRight, X } from 'lucide-react';

export default function DemoBanner({ onCreateAccount, onExit }: { onCreateAccount: () => void; onExit: () => void }) {
  const [hidden, setHidden] = useState(false);
  const t = useTranslations('demo');
  return (
    <div style={{ display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr', transition: 'grid-template-rows var(--t-slow) ease', flexShrink: 0 }}>
      <div style={{ overflow: 'hidden' }}>
        <div className="demo-banner">
          <Sparkles size={14} className="demo-banner-ico" aria-hidden="true" />
          <span className="demo-banner-text">
            <strong>{t('bannerTitle')}</strong>
            <span className="demo-banner-note"> · {t('bannerNote')}</span>
          </span>
          <button onClick={onExit} className="demo-banner-exit">
            <ArrowLeft size={12} aria-hidden="true" /> <span className="demo-banner-exit-label">{t('quit')}</span>
          </button>
          <button onClick={onCreateAccount} className="demo-banner-cta">
            {t('createAccount')} <ArrowRight size={13} aria-hidden="true" />
          </button>
          <button onClick={() => setHidden(true)} aria-label={t('dismiss')} title={t('dismiss')} className="demo-banner-x"><X size={14} /></button>
        </div>
      </div>
      <style>{`
        .demo-banner { display: flex; align-items: center; gap: 9px; height: 40px; padding: 0 14px; background: #1A1A10; border-bottom: 1px solid var(--accent); }
        .demo-banner-ico { color: var(--accent); flex-shrink: 0; }
        .demo-banner-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .demo-banner-text strong { font-family: var(--font-body); font-size: 12px; font-weight: 700; color: var(--ink); }
        .demo-banner-note { font-family: var(--font-mono); font-size: 11px; color: #a98f4e; }

        /* Quit — ghost tiny */
        .demo-banner-exit { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; background: transparent; color: var(--text-muted); border: none; font-family: var(--font-body); font-size: 12px; cursor: pointer; transition: color var(--t-fast); white-space: nowrap; }
        .demo-banner-exit:hover { color: var(--ink); }

        /* Create account — solid gold */
        .demo-banner-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 16px; background: var(--accent); color: #0D0D0D; border: none; font-family: var(--font-body); font-size: 12px; font-weight: 700; cursor: pointer; transition: background var(--t-fast); white-space: nowrap; }
        .demo-banner-cta:hover { background: var(--accent-hover, #d4b257); }

        /* Dismiss */
        .demo-banner-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: color var(--t-fast); }
        .demo-banner-x:hover { color: var(--ink); }

        /* Mobile: keep both buttons, trim the quit label + note to save room */
        @media (max-width: 560px) {
          .demo-banner { gap: 7px; padding: 0 10px; }
          .demo-banner-exit-label { display: none; }
          .demo-banner-cta { padding: 0 12px; }
        }
      `}</style>
    </div>
  );
}
