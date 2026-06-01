'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const Landing = dynamic(() => import('@/components/landing/Landing'), { ssr: false });

function Splash() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#0a0805' }}>
      <div className="serif" style={{ fontSize: '2.2rem', color: '#c4935a' }}>🌿 Suimini</div>
      <span className="spinner" style={{ color: '#c4935a' }} />
    </div>
  );
}

/**
 * Single source of truth for `/`:
 *   active Supabase session → redirect to /app (skip the landing flash)
 *   everyone else (incl. demo visitors) → marketing landing
 * Demo is a "try the app" state, not an identity: it must never hijack the
 * landing, otherwise a visitor who tried the demo once can never reach it again.
 * A splash is shown during the (max 1.5s) session check.
 */
export default function HomeGate() {
  const router = useRouter();
  const [view, setView] = useState<'checking' | 'landing'>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!supabase) { setView('landing'); return; }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) router.replace('/app');
      else setView('landing');
    });
    // Don't block on a slow Supabase: fall back to landing after 1.5s
    // (a later session resolution can still redirect to /app).
    const t = setTimeout(() => { if (!cancelled) setView('landing'); }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [router]);

  if (view === 'checking') return <Splash />;
  return <Landing />;
}
