/**
 * Auth hook for mobile. Wraps Supabase GoTrue with a demo fallback so the app
 * is usable without a backend.
 *
 * ⚠️ Like the web app, the onAuthStateChange callback stays synchronous — never
 * await a Supabase call inside it (GoTrue deadlocks). Defer with setTimeout(0).
 */
import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemo: boolean;
  configured: boolean;
}

export interface AuthResult {
  error?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isDemo: false,
    configured: supabase !== null,
  });

  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState((s) => ({
        ...s,
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      }));
    });

    // Keep this callback synchronous — defer any async work.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (!active) return;
        setState((s) => ({
          ...s,
          session,
          user: session?.user ?? null,
          isDemo: false,
          loading: false,
        }));
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { error: 'Supabase non configuré' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
    ): Promise<AuthResult> => {
      if (!supabase) return { error: 'Supabase non configuré' };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      });
      return error ? { error: error.message } : {};
    },
    [],
  );

  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase non configuré' };
    const { error } = await supabase.auth.signInWithOtp({ email });
    return error ? { error: error.message } : {};
  }, []);

  const startDemo = useCallback(() => {
    setState((s) => ({ ...s, isDemo: true, loading: false }));
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setState((s) => ({ ...s, user: null, session: null, isDemo: false }));
  }, []);

  const isAuthenticated = !!state.user || state.isDemo;

  return {
    ...state,
    isAuthenticated,
    signIn,
    signUp,
    sendMagicLink,
    startDemo,
    signOut,
  };
}
