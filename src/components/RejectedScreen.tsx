'use client';
import { XCircle, LogOut, LifeBuoy } from 'lucide-react';

export default function RejectedScreen({ reason, onSignOut }: { reason?: string | null; onSignOut: () => void }) {
  return (
    <div style={wrap}>
      <div style={card}>
        <XCircle size={64} strokeWidth={1.5} style={{ color: 'var(--danger)' }} aria-hidden="true" />
        <h1 className="serif" style={title}>Accès refusé</h1>
        <p style={para}>
          Votre demande d’inscription n’a pas été acceptée.
        </p>
        {reason && (
          <div style={reasonBox}>
            <span className="label" style={{ display: 'block', marginBottom: '4px' }}>Motif</span>
            {reason}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          <a href="mailto:support@suimini.app" className="btn btn-primary btn-sm">
            <LifeBuoy size={14} aria-hidden="true" /> Contacter le support
          </a>
          <button onClick={onSignOut} className="btn btn-ghost btn-sm">
            <LogOut size={14} aria-hidden="true" /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' };
const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', maxWidth: '440px' };
const title: React.CSSProperties = { fontSize: '2rem', margin: '8px 0 0', color: 'var(--text)' };
const para: React.CSSProperties = { fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0, maxWidth: '380px' };
const reasonBox: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', maxWidth: '380px', textAlign: 'left' };
