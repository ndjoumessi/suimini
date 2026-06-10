'use client';
import { useEffect } from 'react';
import { BrandLockup } from '@/components/Brand';

/**
 * Web Share Target receiver — /app/share?title=…&text=…&url=…
 *
 * The PWA manifest declares this URL as the share_target action (GET method).
 * When the OS share sheet sends content here, we stash it in sessionStorage
 * then immediately redirect to /app. SuiminiApp picks it up on mount.
 */
export default function SharePage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shared = {
      title: params.get('title') || '',
      text: params.get('text') || '',
      url: params.get('url') || '',
    };
    if (shared.title || shared.text || shared.url) {
      try { sessionStorage.setItem('suimini_shared', JSON.stringify(shared)); } catch { /* ignore */ }
    }
    window.location.replace('/app');
  }, []);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#f4f1ea' }}>
      <BrandLockup size={32} color="#1b1b1b" accent="#bf4b2c" surface="#f4f1ea" fontSize={24} />
      <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', letterSpacing: '0.08em', color: '#4a4742', margin: 0 }}>
        CHARGEMENT…
      </p>
    </div>
  );
}
