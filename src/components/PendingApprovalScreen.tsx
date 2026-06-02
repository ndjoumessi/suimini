'use client';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApprovalScreen({ email, onSignOut }: { email?: string | null; onSignOut: () => void }) {
  return (
    <div style={wrap}>
      <div style={card}>
        <Clock size={64} strokeWidth={1.5} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <h1 className="serif" style={title}>Demande en cours d’examen</h1>
        <p style={para}>
          Votre compte a bien été créé. Un administrateur va examiner votre demande
          dans les plus brefs délais.
        </p>
        {email && <span style={badge}>{email}</span>}
        <p style={small}>Vous recevrez un email quand votre compte sera activé.</p>
        <button onClick={onSignOut} className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }}>
          <LogOut size={14} aria-hidden="true" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' };
const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', maxWidth: '440px' };
const title: React.CSSProperties = { fontSize: '2rem', margin: '8px 0 0', color: 'var(--text)' };
const para: React.CSSProperties = { fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0, maxWidth: '380px' };
const badge: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '6px 14px', borderRadius: '100px', marginTop: '4px' };
const small: React.CSSProperties = { fontSize: '12px', color: 'var(--text-light)', margin: '4px 0 0' };
