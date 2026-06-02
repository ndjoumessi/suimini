'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile, AdminNotification, Tenant, UserStatus, UserRole } from '@/types';

export interface NewTenantInput {
  name: string;
  slug: string;
  plan: 'free' | 'family' | 'pro';
}

/**
 * Admin data layer: wraps the SECURITY DEFINER RPCs (admin-only, enforced
 * server-side) plus the tenants table. Polls unread notifications every 30s when
 * `enabled` (the admin status of the current user), keeping `unreadCount` fresh
 * for the sidebar badge and the notifications tab. All calls are guarded so a
 * non-admin / pre-migration database never throws.
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
    const { data, error } = await supabase.rpc('list_all_users');
    setLoading(false);
    if (!error && data) setUsers(data as UserProfile[]);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('get_unread_notifications');
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
    const { error } = await supabase.rpc('approve_user', { target_user_id: id });
    if (!error) await Promise.all([fetchUsers(), fetchNotifications()]);
    return { error: error?.message };
  }, [fetchUsers, fetchNotifications]);

  const rejectUser = useCallback(async (id: string, reason?: string) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.rpc('reject_user', { target_user_id: id, reason: reason || null });
    if (!error) await Promise.all([fetchUsers(), fetchNotifications()]);
    return { error: error?.message };
  }, [fetchUsers, fetchNotifications]);

  const setStatus = useCallback(async (id: string, newStatus: UserStatus) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.rpc('set_user_status', { target_user_id: id, new_status: newStatus });
    if (!error) await fetchUsers();
    return { error: error?.message };
  }, [fetchUsers]);

  const setRole = useCallback(async (id: string, newRole: UserRole) => {
    if (!supabase) return { error: 'Supabase non configuré.' };
    const { error } = await supabase.rpc('set_user_role', { target_user_id: id, new_role: newRole });
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
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (!error) await fetchNotifications();
    return { error: error?.message };
  }, [fetchNotifications]);

  // Poll unread notifications while the current user is an admin. When not an
  // admin we simply don't poll; the badge/dashboard are hidden anyway, so stale
  // data is never shown (and we avoid a synchronous setState in the effect body).
  useEffect(() => {
    if (!enabled) return;
    fetchNotifications();
    const t = setInterval(fetchNotifications, 30000);
    return () => clearInterval(t);
  }, [enabled, fetchNotifications]);

  return {
    users, notifications, tenants, unreadCount, loading,
    fetchUsers, fetchNotifications, fetchTenants,
    approveUser, rejectUser, setStatus, setRole, createTenant, markAllNotificationsRead,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
