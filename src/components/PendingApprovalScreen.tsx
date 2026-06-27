'use client';
import { useTranslations } from 'next-intl';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApprovalScreen({ email, onSignOut }: { email?: string | null; onSignOut: () => void }) {
  const t = useTranslations('accountStatus');
  return (
    <div style={wrap}>
      <div style={card}>
        <Clock size={64} strokeWidth={1.5} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <h1 className="serif" style={title}>{t('pendingTitle')}</h1>
        <p style={para}>{t('pendingBody')}</p>
        {email && <span style={badge}>{email}</span>}
        <p style={small}>{t('pendingSmall')}</p>
        <button onClick={onSignOut} className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }}>
          <LogOut size={14} aria-hidden="true" /> {t('signOut')}
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' };
const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', maxWidth: '460px', background: 'var(--bg-card)', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '44px 36px', boxShadow: 'var(--shadow-lg)' };
const title: React.CSSProperties = { fontSize: '2rem', margin: '8px 0 0', color: 'var(--text)' };
const para: React.CSSProperties = { fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0, maxWidth: '380px' };
const badge: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', border: '1.5px solid var(--border-strong)', padding: '5px 12px', borderRadius: 'var(--radius)', marginTop: '4px' };
const small: React.CSSProperties = { fontSize: '12px', color: 'var(--text-light)', margin: '4px 0 0' };
