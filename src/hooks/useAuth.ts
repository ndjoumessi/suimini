'use client';
import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sampleFamilyTree } from '@/lib/sampleData';
import { offlineStorage } from '@/lib/offlineStorage';
import type { UserProfile } from '@/types';
import { fetchMyMemberships, acceptInvitation, PENDING_INVITE_KEY, type TreeMember } from '@/lib/sharing';

/** If the user arrived via an /invite link before signing in, claim it now. */
async function claimPendingInvite(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  let token: string | null = null;
  try { token = localStorage.getItem(PENDING_INVITE_KEY); } catch { return false; }
  if (!token) return false;
  try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
  const res = await acceptInvitation(token);
  return !!res;
}

const DEMO_KEY = 'suimini_demo';
const DEMO_VALUE = 'true';
const TREES_KEY = 'suimini_trees';
const ACTIVE_KEY = 'suimini_active_tree';

// Module-level (shared by ALL useAuth instances): once a sign-out starts, every
// onAuthStateChange listener must STOP updating state. Otherwise the SIGNED_OUT
// event re-renders /app with a null session for a frame before window.location
// navigates away, crashing children that assume a user → the error boundary. The
// flag is reset on the next full document load (logout does a hard navigation).
let isSigningOut = false;

/** Begin a sign-out: freezes auth-state listeners so the imminent SIGNED_OUT event
 *  can't re-render the app with a null session before navigation. Call this BEFORE
 *  any supabase.auth.signOut() that isn't routed through useAuth().signOut. */
export function markSigningOut() { isSigningOut = true; }

function origin() {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Mirror the demo flag into a cookie so the Next proxy can read it server-side. */
function setDemoCookie(on: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${DEMO_KEY}=${DEMO_VALUE}; path=/; max-age=31536000; samesite=lax`
    : `${DEMO_KEY}=; path=/; max-age=0; samesite=lax`;
}

/** Load the Supabase profile row (status/role/tenant). Returns null on any error
 *  (e.g. the multitenant migration not applied yet) so the app stays usable. */
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [demo, setDemo] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [treeMemberships, setTreeMemberships] = useState<TreeMember[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') setDemo(localStorage.getItem(DEMO_KEY) === DEMO_VALUE);
    if (!supabase) { setIsLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
      if (data.session?.user) {
        setUserProfile(await fetchProfile(data.session.user.id));
        fetchMyMemberships().then(m => { if (active) setTreeMemberships(m); });
      }
    });
    // IMPORTANT: keep this callback synchronous and never `await` a Supabase call
    // inside it. It runs while GoTrue holds its auth lock; calling fetchProfile
    // (another Supabase request) here would try to re-acquire that lock and
    // DEADLOCK — signInWithPassword would never resolve and the UI stays stuck on
    // "Connexion en cours…". We defer the profile fetch with setTimeout(0) so the
    // lock is released first.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Sign-out in progress → do not touch state; the page is navigating away.
      // A re-render with a null session here is exactly what crashed /app.
      if (isSigningOut) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      if (s?.user) {
        try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
        setDemoCookie(false);
        setDemo(false);
        const uid = s.user.id;
        setTimeout(() => {
          fetchProfile(uid).then(p => { if (active) setUserProfile(p); });
          // Claim a pending /invite token first, then refresh memberships so the
          // freshly-joined tree shows up. Redirect to /app on a successful claim.
          claimPendingInvite().then(claimed => {
            fetchMyMemberships().then(m => { if (active) setTreeMemberships(m); });
            if (claimed && typeof window !== 'undefined' && window.location.pathname !== '/app') {
              window.location.href = '/app';
            }
          });
        }, 0);
      } else {
        setUserProfile(null);
        setTreeMemberships([]);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) setUserProfile(await fetchProfile(user.id));
  }, [user]);

  const isDemo = !user && demo;

  // Status/role derived from the profile. When the column is absent (migration not
  // run) `status` is undefined → treated as approved so nothing is locked out.
  const status = userProfile?.status;
  const role = userProfile?.role;
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperAdmin = role === 'superadmin';
  const isApproved = !status || status === 'approved';
  const tenantId = userProfile?.tenant_id ?? null;

  // --- Sign up (email + password + display name) ---
  const signUp = useCallback(async (email: string, password: string, displayName: string, organization?: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), organization: organization?.trim() || null },
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
          : 'Erreur de connexion. Réessayez.';
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

  // --- Sign out (wipes ALL local data so the next guest/demo starts clean) ---
  // Bulletproof: set the module-level isSigningOut flag FIRST so no onAuthStateChange
  // listener (this instance or any other) re-renders /app with a null session during
  // teardown — that frame is what crashed the app into the error boundary. Everything
  // is wrapped, and the hard redirect ALWAYS runs (finally) even on a thrown
  // Supabase/IndexedDB error. We never call setUser/setSession here; the document is
  // replaced instead.
  const signOut = useCallback(async () => {
    isSigningOut = true;
    try {
      await supabase?.auth.signOut();
    } catch (e) {
      console.error('signOut error', e);
    } finally {
      // CRITICAL: clear IndexedDB too, not just localStorage. Cloud mode mirrors the
      // account's trees into IndexedDB; if we only clear localStorage, the next guest/
      // demo load reads those stale rows back and leaks the previous account's data.
      try { await offlineStorage.clear(); } catch { /* ignore */ }
      try {
        localStorage.removeItem(TREES_KEY);
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(DEMO_KEY);
      } catch { /* ignore */ }
      try { setDemoCookie(false); } catch { /* ignore */ }
      // replace() rather than href: no history entry + faster, and a full document
      // load resets the isSigningOut flag for the next session.
      if (typeof window !== 'undefined') window.location.replace('/');
    }
  }, []);

  // --- Demo mode (sample data, no cloud sync) ---
  const startDemo = useCallback(async () => {
    // CRITICAL: wipe IndexedDB *before* seeding. The store's guest/demo branch reads
    // IndexedDB FIRST — so a leftover cloud account's trees there would override the
    // sample and leak real data into the demo. Clear it, then inject the Dupont sample.
    try { await offlineStorage.clear(); } catch { /* ignore */ }
    try {
      // 1. Mark demo mode (localStorage + cookie for the proxy)
      localStorage.setItem(DEMO_KEY, DEMO_VALUE);
      // 2. Always (re)inject the sample data so "Essayer la démo" never lands on an empty/stale tree
      localStorage.setItem(TREES_KEY, JSON.stringify([sampleFamilyTree]));
      localStorage.setItem(ACTIVE_KEY, sampleFamilyTree.id);
    } catch { /* ignore */ }
    setDemoCookie(true);
    setDemo(true);
    // 3. Full reload so the store re-reads the clean local data
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
    userProfile, status, role, isAdmin, isSuperAdmin, isApproved, tenantId, refreshProfile,
    treeMemberships,
    signUp, signIn, signInWithMagicLink, resetPassword, signOut, startDemo, exitDemo,
  };
}
