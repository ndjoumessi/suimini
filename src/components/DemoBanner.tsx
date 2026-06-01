'use client';
import { useState } from 'react';
import { Gamepad2, X, LogOut } from 'lucide-react';

export default function DemoBanner({ onCreateAccount, onExit }: { onCreateAccount: () => void; onExit: () => void }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div style={{ display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr', transition: 'grid-template-rows var(--t-slow) ease', flexShrink: 0 }}>
      <div style={{ overflow: 'hidden' }}>
        <div className="demo-banner">
          <Gamepad2 size={16} style={{ color: '#d97706', flexShrink: 0 }} aria-hidden="true" />
          <span className="demo-banner-text">Mode démo — données non sauvegardées</span>
          <button onClick={onExit} className="demo-banner-exit"><LogOut size={13} aria-hidden="true" /> Quitter la démo</button>
          <button onClick={onCreateAccount} className="demo-banner-cta">Créer un compte</button>
          <button onClick={() => setHidden(true)} aria-label="Masquer la bannière" className="demo-banner-x"><X size={14} /></button>
        </div>
      </div>
      <style>{`
        .demo-banner { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 16px; background: linear-gradient(90deg, #fef3c7, #fde68a); }
        [data-theme="dark"] .demo-banner { background: #2a1f00; }
        .demo-banner-text { font-size: 13px; font-weight: 500; color: #92400e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        [data-theme="dark"] .demo-banner-text { color: #fbbf24; }
        .demo-banner-exit { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; background: transparent; color: #92400e; border: 1px solid rgba(146,64,14,0.35); border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'Lato', sans-serif; cursor: pointer; transition: background 200ms ease, border-color 200ms ease; white-space: nowrap; }
        .demo-banner-exit:hover { background: rgba(146,64,14,0.08); border-color: rgba(146,64,14,0.6); }
        [data-theme="dark"] .demo-banner-exit { color: #fbbf24; border-color: rgba(251,191,36,0.35); }
        [data-theme="dark"] .demo-banner-exit:hover { background: rgba(251,191,36,0.12); }
        .demo-banner-cta { flex-shrink: 0; height: 30px; padding: 0 14px; background: #c4935a; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'Lato', sans-serif; cursor: pointer; transition: background 200ms ease; }
        .demo-banner-cta:hover { background: #a87340; }
        .demo-banner-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 6px; border: none; background: transparent; color: #92400e; border-radius: 6px; cursor: pointer; transition: background 200ms ease; }
        [data-theme="dark"] .demo-banner-x { color: #fbbf24; }
        .demo-banner-x:hover { background: rgba(0,0,0,0.1); }
        [data-theme="dark"] .demo-banner-x:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
