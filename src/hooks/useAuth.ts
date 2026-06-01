'use client';
import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sampleFamilyTree } from '@/lib/sampleData';

const DEMO_KEY = 'suimini_demo';
const DEMO_VALUE = 'true';
const TREES_KEY = 'suimini_trees';
const ACTIVE_KEY = 'suimini_active_tree';

function origin() {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Mirror the demo flag into a cookie so the Next middleware can read it server-side. */
function setDemoCookie(on: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${DEMO_KEY}=${DEMO_VALUE}; path=/; max-age=31536000; samesite=lax`
    : `${DEMO_KEY}=; path=/; max-age=0; samesite=lax`;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setDemo(localStorage.getItem(DEMO_KEY) === DEMO_VALUE);
    if (!supabase) { setIsLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      if (s?.user) {
        try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
        setDemoCookie(false);
        setDemo(false);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const isDemo = !user && demo;

  // --- Sign up (email + password + display name) ---
  const signUp = useCallback(async (email: string, password: string, displayName: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${origin()}/auth/callback`,
      },
    });
    return { error: error?.message };
  }, []);

  // --- Sign in (email + password) ---
  const signIn = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'Email ou mot de passe incorrect.'
        : /email not confirmed/i.test(error.message)
          ? 'Veuillez confirmer votre email avant de vous connecter.'
          : error.message;
      return { error: msg };
    }
    return {};
  }, []);

  // --- Magic link (passwordless) ---
  const signInWithMagicLink = useCallback(async (email: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${origin()}/auth/callback` },
    });
    return { error: error?.message };
  }, []);

  // --- Forgot password (sends reset email) ---
  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin()}/auth/callback?next=/auth/reset-password`,
    });
    return { error: error?.message };
  }, []);

  // --- Sign out (clears local tree cache + demo, back to landing) ---
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    try {
      localStorage.removeItem(TREES_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(DEMO_KEY);
    } catch { /* ignore */ }
    setDemoCookie(false);
    setUser(null);
    setSession(null);
    setDemo(false);
    if (typeof window !== 'undefined') window.location.href = '/';
  }, []);

  // --- Demo mode (sample data, no cloud sync) ---
  const startDemo = useCallback(() => {
    try {
      localStorage.setItem(DEMO_KEY, DEMO_VALUE);
      if (!localStorage.getItem(TREES_KEY)) {
        localStorage.setItem(TREES_KEY, JSON.stringify([sampleFamilyTree]));
        localStorage.setItem(ACTIVE_KEY, sampleFamilyTree.id);
      }
    } catch { /* ignore */ }
    setDemoCookie(true);
    setDemo(true);
    if (typeof window !== 'undefined') window.location.href = '/app';
  }, []);

  // --- Exit demo (keeps no account, back to landing) ---
  const exitDemo = useCallback(() => {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    setDemoCookie(false);
    setDemo(false);
    if (typeof window !== 'undefined') window.location.href = '/';
  }, []);

  return {
    user, session, isDemo, isLoading, loading: isLoading,
    configured: isSupabaseConfigured,
    signUp, signIn, signInWithMagicLink, resetPassword, signOut, startDemo, exitDemo,
  };
}
