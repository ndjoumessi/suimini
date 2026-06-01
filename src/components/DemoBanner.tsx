'use client';
import { useState } from 'react';
import { Gamepad2, UserPlus, X } from 'lucide-react';

export default function DemoBanner({ onCreateAccount }: { onCreateAccount: () => void }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div style={{ display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr', transition: 'grid-template-rows var(--t-slow) ease', flexShrink: 0 }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          padding: '8px 16px', fontSize: '13px',
          background: 'rgba(185,119,42,0.14)', borderBottom: '1px solid var(--warning)', color: 'var(--text)',
        }}>
          <Gamepad2 size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ flex: 1, minWidth: '160px' }}>
            <strong>Mode démo</strong> — vos données ne sont pas sauvegardées.
          </span>
          <button onClick={onCreateAccount} className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
            <UserPlus size={14} /> Créer un compte gratuit
          </button>
          <button onClick={() => setHidden(true)} aria-label="Masquer la bannière" className="icon-btn" style={{ width: '30px', height: '30px' }}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
