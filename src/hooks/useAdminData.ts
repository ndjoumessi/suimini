'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { callRpc } from '@/lib/rpcClient';
import type { UserProfile, AdminNotification, UserStatus, UserRole } from '@/types';

/**
 * Admin data layer: wraps the SECURITY DEFINER RPCs (admin-only, enforced
 * server-side). Subscribes to Supabase Realtime when
 * `enabled` (the admin status of the current user) so `unreadCount` and the
 * notifications list stay fresh for the sidebar badge and the notifications tab
 * without polling. All calls are guarded so a non-admin / pre-migration database
 * never throws. (Requires the tables to be in the `supabase_realtime`
 * publication — see supabase/share-public.sql.)
 */
export function useAdminData({ enabled }: { enabled: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // True only until the FIRST users+notifications fetch settles — unlike `loading`
  // (which flips true/false around every fetchUsers call, including routine
  // approve/reject refreshes), this never turns true again afterwards. Consumers
  // use it to show a loading skeleton instead of a misleading "0" on first paint,
  // without that skeleton flashing back on every subsequent admin action.
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await callRpc('list_all_users');
    setLoading(false);
    if (!error && data) setUsers(data as UserProfile[]);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await callRpc('get_unread_notifications');
    if (!error && data) {
      const list = data as AdminNotification[];
      setNotifications(list);
      setUnreadCount(list.length);
    }
  }, []);

  const approveUser = useCallback(async (id: string) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await callRpc('approve_user', { target_user_id: id });
    if (!error) await Promise.all([fetchUsers(), fetchNotifications()]);
    return { error: error?.message };
  }, [fetchUsers, fetchNotifications]);

  const rejectUser = useCallback(async (id: string, reason?: string) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await callRpc('reject_user', { target_user_id: id, reason: reason || null });
    if (!error) await Promise.all([fetchUsers(), fetchNotifications()]);
    return { error: error?.message };
  }, [fetchUsers, fetchNotifications]);

  const setStatus = useCallback(async (id: string, newStatus: UserStatus) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await callRpc('set_user_status', { target_user_id: id, new_status: newStatus });
    if (!error) await fetchUsers();
    return { error: error?.message };
  }, [fetchUsers]);

  const setRole = useCallback(async (id: string, newRole: UserRole) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await callRpc('set_user_role', { target_user_id: id, new_role: newRole });
    if (!error) await fetchUsers();
    return { error: error?.message };
  }, [fetchUsers]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await callRpc('mark_all_notifications_read');
    if (!error) await fetchNotifications();
    return { error: error?.message };
  }, [fetchNotifications]);

  // Realtime instead of polling. While the current user is an admin we do one
  // initial fetch, then react live to:
  //   • new admin_notifications (INSERT) → bump the badge + prepend the row,
  //   • new pending profiles (INSERT)    → re-fetch (a fresh sign-up awaits review).
  // When not an admin we don't subscribe; the badge/dashboard are hidden anyway.
  //
  // ⚠️ fetchUsers() belongs HERE, not just in AdminDashboard's own mount effect:
  // an admin landing on "Accueil" (AdminHomeView) never mounts AdminDashboard, so
  // `users` stayed [] (Comptes/Actifs/En attente all showing 0) until the admin
  // happened to open the Admin tab — which populated the shared `admin` state and
  // made Accueil look "fixed" only in hindsight. Both consumers read the same
  // lifted useAdminData() instance (see SuiminiApp), so fetching both here once
  // covers every entry point.
  useEffect(() => {
    if (!enabled || !supabase) { setInitialLoading(false); return; }
    const sb = supabase;
    Promise.all([fetchUsers(), fetchNotifications()]).finally(() => setInitialLoading(false));

    const notifChannel = sb
      .channel('admin-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (payload) => {
        setNotifications(n => [payload.new as AdminNotification, ...n]);
        setUnreadCount(c => c + 1);
      })
      .subscribe();

    const pendingChannel = sb
      .channel('pending-users')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles', filter: 'status=eq.pending' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      sb.removeChannel(notifChannel);
      sb.removeChannel(pendingChannel);
    };
  }, [enabled, fetchUsers, fetchNotifications]);

  // Reflect pending-approval count in the PWA app badge.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge(count?: number): Promise<void>;
      clearAppBadge(): Promise<void>;
    };
    if (unreadCount > 0) {
      nav.setAppBadge(unreadCount).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [unreadCount]);

  return {
    users, notifications, unreadCount, loading, initialLoading,
    fetchUsers, fetchNotifications,
    approveUser, rejectUser, setStatus, setRole, markAllNotificationsRead,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
