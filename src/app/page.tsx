'use client';
import dynamic from 'next/dynamic';

const SuiminiApp = dynamic(() => import('@/components/SuiminiApp'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      background: '#faf8f5'
    }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#8b6f47' }}>Suimini</div>
      <div style={{ color: '#6b6560', fontSize: '14px' }}>Chargement de votre arbre...</div>
    </div>
  )
});

export default function Home() {
  return <SuiminiApp />;
}
