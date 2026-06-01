'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const SuiminiApp = dynamic(() => import('@/components/SuiminiApp'), { ssr: false });
const Landing = dynamic(() => import('@/components/landing/Landing'), { ssr: false });

function Splash() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#0a0805' }}>
      <div className="serif" style={{ fontSize: '2.2rem', color: '#c4935a' }}>🌿 Suimini</div>
      <div style={{ color: '#8a8278', fontSize: '13px' }}>Chargement…</div>
    </div>
  );
}

/**
 * Decides what to show at `/`:
 * - signed-in user (Supabase session) → the app
 * - demo / returning local visitor → the app (with demo banner)
 * - brand-new visitor → the marketing landing page
 */
export default function HomeGate() {
  const [view, setView] = useState<'loading' | 'app' | 'landing'>('loading');

  useEffect(() => {
    let cancelled = false;
    const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
    const hasLocal = !!read('suimini_trees');
    const isDemo = read('suimini_demo') === '1';

    if (hasLocal || isDemo) {
      // Treat any non-authenticated local user as demo so the banner appears.
      try { if (!read('suimini_demo')) localStorage.setItem('suimini_demo', '1'); } catch { /* ignore */ }
      setView('app');
      return;
    }
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => { if (!cancelled) setView(data.session ? 'app' : 'landing'); });
    } else {
      setView('landing');
    }
    return () => { cancelled = true; };
  }, []);

  if (view === 'loading') return <Splash />;
  if (view === 'app') return <SuiminiApp />;
  return <Landing />;
}
