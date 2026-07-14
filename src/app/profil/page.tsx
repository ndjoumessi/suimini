'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { BrandLockup } from '@/components/Brand';

const ProfilPage = dynamic(() => import('@/components/ProfilPage'), { ssr: false });

function Loader() {
  const tc = useTranslations('common');
  return (
    <div role="status" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', background: 'var(--bg, #0f1a24)' }}>
      <BrandLockup size={34} color="var(--ink, #f3ecdf)" accent="var(--accent, #c9a84c)" surface="var(--bg-card, #1e3040)" fontSize={26} />
      <span className="spinner" aria-hidden="true" style={{ color: 'var(--accent, #c9a84c)' }} />
      <span className="sr-only">{tc('loading')}</span>
    </div>
  );
}

/**
 * Client-side guard for /profil: accessible only with an active Supabase session.
 * Demo users have no session → redirected to '/'. Otherwise → '/'.
 */
export default function ProfilPageRoute() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!supabase) { router.replace('/'); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setState('allowed');
      else router.replace('/');
    });
    return () => { cancelled = true; };
  }, [router]);

  if (state === 'checking') return <Loader />;
  return <ProfilPage />;
}
