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
import { useStore } from '@/lib/store';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
    configured: supabase !== null,
  });

  // Demo flag lives in the shared store so the AuthGate (a different useAuth
  // instance) sees a demo started from the login screen.
  const isDemo = useStore((s) => s.isDemo);
  const startDemoStore = useStore((s) => s.startDemo);
  const exitDemoStore = useStore((s) => s.exitDemo);

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
        // A real session supersedes any demo session.
        if (session) exitDemoStore();
        setState((s) => ({
          ...s,
          session,
          user: session?.user ?? null,
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
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      } catch (e: any) {
        // signInWithPassword can throw on transport failures (network, bad URL).
        return { error: e?.message ?? 'Connexion au serveur impossible.' };
      }
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
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: displayName ? { display_name: displayName } : undefined },
        });
        return error ? { error: error.message } : {};
      } catch (e: any) {
        return { error: e?.message ?? 'Inscription impossible.' };
      }
    },
    [],
  );

  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase non configuré' };
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      return error ? { error: error.message } : {};
    } catch (e: any) {
      return { error: e?.message ?? 'Envoi du lien impossible.' };
    }
  }, []);

  const startDemo = useCallback(() => {
    // Pure local bypass — no Supabase call. Seeds the sample tree + flips the
    // shared demo flag so the AuthGate lets the user through.
    startDemoStore();
    setState((s) => ({ ...s, loading: false }));
  }, [startDemoStore]);

  const signOut = useCallback(async () => {
    exitDemoStore();
    if (supabase) await supabase.auth.signOut();
    setState((s) => ({ ...s, user: null, session: null }));
  }, [exitDemoStore]);

  const isAuthenticated = !!state.user || isDemo;

  return {
    ...state,
    isDemo,
    isAuthenticated,
    signIn,
    signUp,
    sendMagicLink,
    startDemo,
    signOut,
  };
}
