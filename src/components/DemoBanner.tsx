'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gamepad2, X, LogOut } from 'lucide-react';

export default function DemoBanner({ onCreateAccount, onExit }: { onCreateAccount: () => void; onExit: () => void }) {
  const [hidden, setHidden] = useState(false);
  const t = useTranslations('demo');
  return (
    <div style={{ display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr', transition: 'grid-template-rows var(--t-slow) ease', flexShrink: 0 }}>
      <div style={{ overflow: 'hidden' }}>
        <div className="demo-banner">
          <Gamepad2 size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-hidden="true" />
          <span className="demo-banner-text">{t('banner')}</span>
          <button onClick={onExit} className="demo-banner-exit"><LogOut size={13} aria-hidden="true" /> {t('quit')}</button>
          <button onClick={onCreateAccount} className="demo-banner-cta">{t('createAccount')}</button>
          <button onClick={() => setHidden(true)} aria-label="Masquer la bannière" className="demo-banner-x"><X size={14} /></button>
        </div>
      </div>
      <style>{`
        .demo-banner { display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 16px; background: var(--bg-muted); border-bottom: var(--bw) solid var(--border-strong); }
        .demo-banner-text { font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .demo-banner-text strong { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.6px; font-size: 11px; color: var(--warning); }
        .demo-banner-exit { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border-strong); border-radius: var(--radius); font-size: 12px; font-weight: 700; font-family: var(--font-body); cursor: pointer; transition: transform var(--t-fast), box-shadow var(--t-fast); white-space: nowrap; }
        .demo-banner-exit:hover { transform: translate(-2px,-2px); box-shadow: var(--shadow-sm); }
        .demo-banner-cta { flex-shrink: 0; height: 32px; padding: 0 14px; background: var(--accent); color: #fff; border: 1.5px solid var(--border-strong); border-radius: var(--radius); font-size: 12px; font-weight: 700; font-family: var(--font-body); cursor: pointer; transition: transform var(--t-fast), box-shadow var(--t-fast); }
        .demo-banner-cta:hover { transform: translate(-2px,-2px); box-shadow: var(--shadow); }
        .demo-banner-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 6px; border: none; background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; transition: background var(--t-fast); }
        .demo-banner-x:hover { background: var(--interactive); color: var(--text); }
      `}</style>
    </div>
  );
}
