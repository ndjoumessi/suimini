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

/** Expired magic-link banner (shown after /auth/callback redirects with ?auth_error=expired). */
function ExpiredBanner({ onClose }: { onClose: () => void }) {
  return (
    <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px 16px', background: 'linear-gradient(90deg, #fef3c7, #fde68a)', color: '#92400e', fontFamily: "'Lato', sans-serif", fontSize: '14px', fontWeight: 600, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
      <span>⚠️ Le lien de connexion a expiré. Veuillez en demander un nouveau.</span>
      <button onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: '#92400e', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '2px 6px' }}>×</button>
    </div>
  );
}

interface StatusInfo { status: UserStatus; email?: string | null; reason?: string | null; }

/**
 * Single source of truth for `/`:
 *   approved session → redirect to /app (skip the landing flash)
 *   pending/rejected/suspended session → matching status screen
 *   everyone else (incl. demo visitors) → marketing landing
 * Status gating fails CLOSED: only an explicit 'approved' status reaches /app. The
 * sole exception is "column does not exist" (Postgres 42703) — the multitenant
 * migration not yet applied — which keeps the app usable and self-heals once run.
 */
export default function HomeGate() {
  const router = useRouter();
  const [view, setView] = useState<'checking' | 'landing' | 'status'>('checking');
  const [info, setInfo] = useState<StatusInfo | null>(null);
  const [expired, setExpired] = useState(false);

  // Detect the expired-link flag from the URL (query set by /auth/callback, or a
  // raw error hash if Supabase redirected straight here) and strip it so it doesn't
  // persist across reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const isExpired = params.get('auth_error') === 'expired'
      || hash.get('error_code') === 'otp_expired'
      || hash.get('error') === 'access_denied';
    if (isExpired) {
      setExpired(true);
      params.delete('auth_error');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

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
      const { data: profile, error } = await supabase!.from('profiles')
        .select('status, rejection_reason').eq('id', data.session.user.id).single();
      if (cancelled) return;

      // Migration not applied (column missing) → behave as before (approved → /app).
      if (error && error.code === '42703') { router.replace('/app'); return; }

      // Fail closed: anything other than an explicit 'approved' shows a status screen.
      const status = (profile as { status?: UserStatus } | null)?.status;
      const reason = (profile as { rejection_reason?: string | null } | null)?.rejection_reason;
      if (status === 'approved') { router.replace('/app'); return; }
      setInfo({ status: status ?? 'pending', email: data.session.user.email, reason });
      setView('status');
    });
    // Don't block on a slow Supabase: fall back to landing after 1.5s.
    const t = setTimeout(() => { if (!cancelled) setView('landing'); }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [router]);

  if (view === 'checking') return <Splash />;

  const banner = expired ? <ExpiredBanner onClose={() => setExpired(false)} /> : null;

  if (view === 'status' && info) {
    const screen = info.status === 'rejected'
      ? <RejectedScreen reason={info.reason} onSignOut={handleSignOut} />
      : info.status === 'suspended'
        ? <SuspendedScreen onSignOut={handleSignOut} />
        : <PendingApprovalScreen email={info.email} onSignOut={handleSignOut} />;
    return <>{banner}{screen}</>;
  }
  return <>{banner}<Landing /></>;
}
