'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { callRpc } from '@/lib/rpcClient';
import type { UserProfile, AdminNotification, Tenant, UserStatus, UserRole } from '@/types';

export interface NewTenantInput {
  name: string;
  slug: string;
  plan: 'free' | 'family' | 'pro';
}

/**
 * Admin data layer: wraps the SECURITY DEFINER RPCs (admin-only, enforced
 * server-side) plus the tenants table. Subscribes to Supabase Realtime when
 * `enabled` (the admin status of the current user) so `unreadCount` and the
 * notifications list stay fresh for the sidebar badge and the notifications tab
 * without polling. All calls are guarded so a non-admin / pre-migration database
 * never throws. (Requires the tables to be in the `supabase_realtime`
 * publication — see supabase/share-public.sql.)
 */
export function useAdminData({ enabled }: { enabled: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const fetchTenants = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (!error && data) setTenants(data as Tenant[]);
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

  const createTenant = useCallback(async (input: NewTenantInput) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.from('tenants').insert(input);
    if (!error) await fetchTenants();
    return { error: error?.message };
  }, [fetchTenants]);

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
  useEffect(() => {
    if (!enabled || !supabase) return;
    const sb = supabase;
    fetchNotifications();

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
  }, [enabled, fetchNotifications]);

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
    users, notifications, tenants, unreadCount, loading,
    fetchUsers, fetchNotifications, fetchTenants,
    approveUser, rejectUser, setStatus, setRole, createTenant, markAllNotificationsRead,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
