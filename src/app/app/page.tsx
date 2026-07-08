'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { BrandLockup } from '@/components/Brand';

const SuiminiApp = dynamic(() => import('@/components/SuiminiApp'), { ssr: false });

function Loader() {
  const tc = useTranslations('common');
  return (
    <div role="status" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', background: 'var(--bg, #f4f1ea)' }}>
      <BrandLockup size={34} color="var(--ink, #1b1b1b)" accent="var(--accent, #bf4b2c)" surface="var(--bg-card, #ffffff)" fontSize={26} />
      <span className="spinner" aria-hidden="true" style={{ color: 'var(--accent, #bf4b2c)' }} />
      <span className="sr-only">{tc('loading')}</span>
    </div>
  );
}

/**
 * Client-side guard for /app: accessible only with an active Supabase session
 * OR an active demo (localStorage 'suimini_demo' = 'true'). Otherwise → '/'.
 * (The proxy enforces the same rule server-side.)
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
