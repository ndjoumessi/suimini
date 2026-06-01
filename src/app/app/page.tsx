'use client';
import dynamic from 'next/dynamic';

const SuiminiApp = dynamic(() => import('@/components/SuiminiApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      background: 'var(--bg, #faf8f5)'
    }}>
      <div className="serif" style={{ fontSize: '2rem', color: 'var(--accent, #8b6f47)' }}>🌿 Suimini</div>
      <div style={{ color: 'var(--text-muted, #6b6560)', fontSize: '14px' }}>Chargement de votre arbre…</div>
    </div>
  ),
});

export default function AppPage() {
  return <SuiminiApp />;
}
