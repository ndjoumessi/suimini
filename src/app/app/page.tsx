'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const SuiminiApp = dynamic(() => import('@/components/SuiminiApp'), { ssr: false });

function Loader() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: 'var(--bg, #faf8f5)' }}>
      <div className="serif" style={{ fontSize: '2rem', color: 'var(--accent, #8b6f47)' }}>🌿 Suimini</div>
      <span className="spinner" style={{ color: 'var(--accent, #8b6f47)' }} />
    </div>
  );
}

/**
 * Client-side guard for /app: accessible only with an active Supabase session
 * OR an active demo (localStorage 'suimini_demo' = 'true'). Otherwise → '/'.
 * (The middleware enforces the same rule server-side.)
 */
export default function AppPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    let cancelled = false;
    const isDemo = (() => { try { return localStorage.getItem('suimini_demo') === 'true'; } catch { return false; } })();
    if (isDemo) { setState('allowed'); return; }
    if (!supabase) { router.replace('/'); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setState('allowed');
      else router.replace('/');
    });
    return () => { cancelled = true; };
  }, [router]);

  if (state === 'checking') return <Loader />;
  return <SuiminiApp />;
}
