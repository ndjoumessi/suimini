'use client';
import { useTranslations } from 'next-intl';
import { ShieldOff, LogOut, LifeBuoy } from 'lucide-react';

export default function SuspendedScreen({ onSignOut }: { onSignOut: () => void }) {
  const t = useTranslations('accountStatus');
  return (
    <div style={wrap}>
      <div style={card}>
        <ShieldOff size={64} strokeWidth={1.5} style={{ color: 'var(--warning)' }} aria-hidden="true" />
        <h1 className="serif" style={title}>{t('suspendedTitle')}</h1>
        <p style={para}>{t('suspendedBody')}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          <a href="mailto:support@suimini.app" className="btn btn-primary btn-sm">
            <LifeBuoy size={14} aria-hidden="true" /> {t('contactSupport')}
          </a>
          <button onClick={onSignOut} className="btn btn-ghost btn-sm">
            <LogOut size={14} aria-hidden="true" /> {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' };
const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', maxWidth: '460px', background: 'var(--bg-card)', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '44px 36px', boxShadow: 'var(--shadow-lg)' };
const title: React.CSSProperties = { fontSize: '2rem', margin: '8px 0 0', color: 'var(--text)' };
const para: React.CSSProperties = { fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0, maxWidth: '380px' };
