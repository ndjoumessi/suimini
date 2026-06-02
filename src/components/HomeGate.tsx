'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import type { UserStatus } from '@/types';
import PendingApprovalScreen from '@/components/PendingApprovalScreen';
import RejectedScreen from '@/components/RejectedScreen';
import SuspendedScreen from '@/components/SuspendedScreen';

const Landing = dynamic(() => import('@/components/landing/Landing'), { ssr: false });

function Splash() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#0a0805' }}>
      <div className="serif" style={{ fontSize: '2.2rem', color: '#c4935a' }}>🌿 Suimini</div>
      <span className="spinner" style={{ color: '#c4935a' }} />
    </div>
  );
}

interface StatusInfo { status: UserStatus; email?: string | null; reason?: string | null; }

/**
 * Single source of truth for `/`:
 *   approved session → redirect to /app (skip the landing flash)
 *   pending/rejected/suspended session → show the matching status screen
 *   everyone else (incl. demo visitors) → marketing landing
 * Status is read from the profile; when the multitenant migration isn't applied
 * (status undefined) the user is treated as approved, so nothing is locked out.
 */
export default function HomeGate() {
  const router = useRouter();
  const [view, setView] = useState<'checking' | 'landing' | 'status'>('checking');
  const [info, setInfo] = useState<StatusInfo | null>(null);

  async function handleSignOut() {
    try { await supabase?.auth.signOut(); } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.location.href = '/';
  }

  useEffect(() => {
    let cancelled = false;
    if (!supabase) { setView('landing'); return; }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.session) { setView('landing'); return; }
      let status: UserStatus | undefined;
      let reason: string | null | undefined;
      try {
        const { data: profile } = await supabase!.from('profiles')
          .select('status, rejection_reason').eq('id', data.session.user.id).single();
        status = (profile as { status?: UserStatus } | null)?.status;
        reason = (profile as { rejection_reason?: string | null } | null)?.rejection_reason;
      } catch { /* migration not applied → treat as approved */ }
      if (cancelled) return;
      if (!status || status === 'approved') { router.replace('/app'); return; }
      setInfo({ status, email: data.session.user.email, reason });
      setView('status');
    });
    // Don't block on a slow Supabase: fall back to landing after 1.5s.
    const t = setTimeout(() => { if (!cancelled) setView('landing'); }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [router]);

  if (view === 'checking') return <Splash />;
  if (view === 'status' && info) {
    if (info.status === 'rejected') return <RejectedScreen reason={info.reason} onSignOut={handleSignOut} />;
    if (info.status === 'suspended') return <SuspendedScreen onSignOut={handleSignOut} />;
    return <PendingApprovalScreen email={info.email} onSignOut={handleSignOut} />;
  }
  return <Landing />;
}
