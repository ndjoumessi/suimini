'use client';
import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ShieldCheck, Users, Bell, CheckCircle, Check, X, Search,
  MoreVertical, UserPlus, Pause, Play, ArrowUp, ArrowDown, Clock,
  Activity, ArrowRight, Filter, ChevronDown, ArrowUpDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminData } from '@/hooks/useAdminData';
import type { UserProfile, UserStatus, UserRole } from '@/types';

type Tab = 'pending' | 'users' | 'notifications' | 'system';
type Toast = (msg: string, type?: 'success' | 'error' | 'info') => void;
type T = ReturnType<typeof useTranslations>;

/** Fire-and-forget: ask the server to email the approved user.
 *  Best-effort — no-ops server-side if RESEND_API_KEY isn't configured. */
function notifyApproval(email?: string, displayName?: string) {
  if (!email) return;
  fetch('/api/send-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, displayName }),
  }).catch(() => { /* email is non-blocking */ });
}

function initials(name?: string, email?: string): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export function relative(d: string, t: T): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('relInstant');
  if (m < 60) return t('relMinutes', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('relHours', { h });
  const j = Math.floor(h / 24);
  return t('relDays', { d: j });
}

const STATUS_BADGE: Record<UserStatus, { labelKey: string; bg: string; fg: string }> = {
  pending: { labelKey: 'statusPending', bg: 'color-mix(in srgb, var(--warning) 16%, transparent)', fg: 'var(--warning)' },
  approved: { labelKey: 'statusApproved', bg: 'color-mix(in srgb, var(--success) 16%, transparent)', fg: 'var(--success)' },
  rejected: { labelKey: 'statusRejected', bg: 'color-mix(in srgb, var(--danger) 14%, transparent)', fg: 'var(--danger)' },
  suspended: { labelKey: 'statusSuspended', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
};

function StatusBadge({ status }: { status: UserStatus }) {
  const t = useTranslations('admin');
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  return <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: b.bg, color: b.fg }}>{t(b.labelKey)}</span>;
}

function Avatar({ name, email }: { name?: string; email?: string }) {
  return (
    <span style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
      {initials(name, email)}
    </span>
  );
}

export default function AdminDashboard({ admin, role, initialTab, onToast }: { admin: AdminData; role?: UserRole; initialTab?: Tab; onToast: Toast }) {
  const t = useTranslations('admin');
  const [tab, setTab] = useState<Tab>(initialTab ?? 'pending');
  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    admin.fetchUsers();
    admin.fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => admin.users.filter(u => u.status === 'pending'), [admin.users]);
  const activeCount = useMemo(() => admin.users.filter(u => u.status === 'approved').length, [admin.users]);

  // At-a-glance summary — surfaces the total-users count that the tab badges
  // don't show, so it's complementary rather than redundant with them.
  const stats: { key: Tab | 'active'; label: string; value: number; tone: string; Icon: LucideIcon }[] = [
    { key: 'users', label: t('statTotalUsers'), value: admin.users.length, tone: 'var(--accent)', Icon: Users },
    { key: 'active', label: t('statActive'), value: activeCount, tone: 'var(--success)', Icon: CheckCircle },
    { key: 'pending', label: t('statPending'), value: pending.length, tone: pending.length ? 'var(--warning)' : 'var(--text-muted)', Icon: Clock },
    { key: 'notifications', label: t('statUnread'), value: admin.unreadCount, tone: admin.unreadCount ? 'var(--danger)' : 'var(--text-muted)', Icon: Bell },
  ];

  const TABS: { id: Tab; label: string; Icon: typeof Users; badge?: number }[] = [
    { id: 'pending', label: t('tabPending'), Icon: Clock, badge: pending.length },
    { id: 'users', label: t('tabUsers'), Icon: Users },
    { id: 'notifications', label: t('tabNotifications'), Icon: Bell, badge: admin.unreadCount },
    { id: 'system', label: t('tabSystem'), Icon: Activity },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 0', borderBottom: 'var(--bw) solid var(--border-strong)', background: 'var(--bg-card)' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={22} style={{ color: 'var(--accent)' }} aria-hidden="true" /> {t('title')}
        </h1>
        <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.5 }}>{t('subtitle')}</p>

        {/* At-a-glance summary strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginTop: '16px', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg)', maxWidth: '640px' }}>
          {stats.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 130px', minWidth: '104px', padding: '10px 14px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <s.Icon size={16} aria-hidden="true" style={{ color: s.tone, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                {admin.initialLoading ? (
                  <span className="skeleton" aria-hidden="true" style={{ display: 'block', width: '1.8rem', height: '1.5rem' }} />
                ) : (
                  <div className="serif" style={{ fontSize: '1.5rem', lineHeight: 1.05, fontWeight: 600, color: s.tone }}>{s.value}</div>
                )}
                <div className="label" style={{ fontSize: '9px', letterSpacing: '0.12em', marginTop: '3px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: '4px', marginTop: '16px', overflowX: 'auto' }}>
          {TABS.map(tabDef => {
            const active = tab === tabDef.id;
            return (
              <button key={tabDef.id} role="tab" aria-selected={active} onClick={() => setTab(tabDef.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', padding: '9px 14px', minHeight: '44px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: active ? 700 : 400, color: active ? 'var(--accent)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
                <tabDef.Icon size={15} aria-hidden="true" /> {tabDef.label}
                {tabDef.badge ? <span style={{ background: 'var(--danger)', color: '#1c0c07', fontSize: '10px', fontWeight: 700, borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>{tabDef.badge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg)' }}>
        {tab === 'pending' && <PendingTab admin={admin} pending={pending} onToast={onToast} />}
        {tab === 'users' && <UsersTab admin={admin} isSuperAdmin={isSuperAdmin} onToast={onToast} />}
        {tab === 'notifications' && <NotificationsTab admin={admin} onToast={onToast} />}
        {tab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

/* Small tab-intro subtitle — clarifies each section's purpose (queue vs directory). */
function TabIntro({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '620px' }}>{children}</p>;
}

/* ===================== TAB 1 — Pending requests ===================== */
function PendingTab({ admin, pending, onToast }: { admin: AdminData; pending: UserProfile[]; onToast: Toast }) {
  const t = useTranslations('admin');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // Sélection multiple — pas d'action groupée avant : chaque demande se traitait
  // une par une même quand la file en contenait plusieurs.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(s => s.size === pending.length ? new Set() : new Set(pending.map(u => u.id)));
  }

  async function approve(u: UserProfile) {
    setBusy(u.id);
    const { error } = await admin.approveUser(u.id);
    setBusy(null);
    if (!error) notifyApproval(u.email, u.display_name);
    onToast(error ? t('toastError', { error }) : t('toastApproved'), error ? 'error' : 'success');
  }
  async function confirmReject(u: UserProfile) {
    setBusy(u.id);
    const { error } = await admin.rejectUser(u.id, reason.trim() || undefined);
    setBusy(null);
    setRejectingId(null);
    setReason('');
    onToast(error ? t('toastError', { error }) : t('toastRejected'), error ? 'error' : 'info');
  }

  async function bulkApprove() {
    const targets = pending.filter(u => selected.has(u.id));
    setBulkBusy(true);
    const results = await Promise.all(targets.map(u => admin.approveUser(u.id)));
    setBulkBusy(false);
    setSelected(new Set());
    targets.forEach((u, i) => { if (!results[i].error) notifyApproval(u.email, u.display_name); });
    const okCount = results.filter(r => !r.error).length;
    const firstError = results.find(r => r.error)?.error ?? '';
    onToast(okCount === targets.length ? t('toastBulkApproved', { count: okCount }) : t('toastError', { error: firstError }), okCount === targets.length ? 'success' : 'error');
  }
  async function bulkReject() {
    const targets = pending.filter(u => selected.has(u.id));
    setBulkBusy(true);
    const results = await Promise.all(targets.map(u => admin.rejectUser(u.id)));
    setBulkBusy(false);
    setSelected(new Set());
    const okCount = results.filter(r => !r.error).length;
    const firstError = results.find(r => r.error)?.error ?? '';
    onToast(okCount === targets.length ? t('toastBulkRejected', { count: okCount }) : t('toastError', { error: firstError }), okCount === targets.length ? 'info' : 'error');
  }

  if (pending.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <CheckCircle size={48} strokeWidth={1.25} style={{ color: 'var(--success)' }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: '15px' }}>{t('noPending')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
      <TabIntro>{t('pendingHint')}</TabIntro>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px' }}>
        <input type="checkbox" checked={selected.size === pending.length} onChange={toggleAll} />
        {t('selectAll')}
      </label>

      {selected.size > 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--accent-light)', borderColor: 'var(--accent-muted)' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--accent-text)', fontWeight: 600 }}>
            {selected.size > 1 ? t('selectedCountPlural', { count: selected.size }) : t('selectedCount', { count: selected.size })}
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={bulkApprove} disabled={bulkBusy} className="btn btn-sm" style={{ background: 'var(--success)', color: 'var(--ink-on-accent)', gap: '5px' }}>
            <Check size={14} aria-hidden="true" /> {t('bulkApprove')}
          </button>
          <button onClick={bulkReject} disabled={bulkBusy} className="btn btn-sm" style={{ background: 'var(--bg)', color: 'var(--danger)', border: '1px solid var(--border-strong)' }}>
            {t('bulkReject')}
          </button>
        </div>
      )}

      {pending.map(u => (
        <div key={u.id} className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={u.display_name || u.email} />
            <Avatar name={u.display_name} email={u.email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{u.display_name || u.email}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                {u.organization ? `${u.organization} · ` : ''}{fmtDate(u.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => approve(u)} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--success)', color: 'var(--ink-on-accent)', gap: '5px' }} aria-label={t('approve')}>
                <Check size={14} aria-hidden="true" /> {t('approve')}
              </button>
              <button onClick={() => { setRejectingId(rejectingId === u.id ? null : u.id); setReason(''); }} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--bg-muted)', color: 'var(--danger)', border: '1px solid var(--border)', gap: '5px' }} aria-label={t('reject')}>
                <X size={14} aria-hidden="true" /> {t('reject')}
              </button>
            </div>
          </div>
          {rejectingId === u.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder={t('rejectReasonPlaceholder')}
                className="input" style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-body)' }} autoFocus />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => { setRejectingId(null); setReason(''); }} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                <button onClick={() => confirmReject(u)} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--danger)', color: 'var(--ink-on-accent)' }}>{t('confirmReject')}</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ===================== TAB 2 — All users ===================== */
type SortKey = 'date' | 'name' | 'status';

function UsersTab({ admin, isSuperAdmin, onToast }: { admin: AdminData; isSuperAdmin: boolean; onToast: Toast }) {
  const t = useTranslations('admin');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<UserStatus | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('date');
  const [sortOpen, setSortOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement | null>(null);

  const FILTERS: { id: UserStatus | 'all'; label: string }[] = [
    { id: 'all', label: t('allStatuses') },
    { id: 'pending', label: t('statusPending') },
    { id: 'approved', label: t('statusApproved') },
    { id: 'rejected', label: t('statusRejected') },
    { id: 'suspended', label: t('statusSuspended') },
  ];
  const filterLabel = FILTERS.find(f => f.id === filter)?.label ?? FILTERS[0].label;

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'date', label: t('sortDate') },
    { id: 'name', label: t('sortName') },
    { id: 'status', label: t('sortStatus') },
  ];
  const sortLabel = SORTS.find(s => s.id === sort)?.label ?? SORTS[0].label;

  const rows = useMemo(() => {
    const filtered = admin.users.filter(u => {
      if (filter !== 'all' && u.status !== filter) return false;
      if (q && !(`${u.display_name || ''} ${u.email}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === 'name') {
      sorted.sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email));
    } else if (sort === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    } else {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [admin.users, q, filter, sort]);

  function closeMenu(returnFocusTo?: string) {
    setMenuId(null);
    if (returnFocusTo) menuBtnRefs.current[returnFocusTo]?.focus();
  }

  async function act(fn: Promise<{ error?: string }>, okMsg: string, onOk?: () => void) {
    setMenuId(null);
    const { error } = await fn;
    if (!error) onOk?.();
    onToast(error ? t('toastError', { error }) : okMsg, error ? 'error' : 'success');
  }

  return (
    <div style={{ maxWidth: '960px' }}>
      <TabIntro>{t('usersHint')}</TabIntro>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} aria-hidden="true" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} className="input" style={{ width: '100%', paddingLeft: '32px' }} />
        </div>
        {/* Custom dropdown instead of a native <select>: the OS-rendered popup
            (see screenshot feedback) breaks from the app's own theming —
            wrong font, no accent hover, plain surface. Reuses the exact
            popover pattern already used for the row actions menu below. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={filterBtnRef}
            onClick={() => setFilterOpen(o => !o)}
            onKeyDown={e => { if (e.key === 'Escape' && filterOpen) { e.preventDefault(); setFilterOpen(false); } }}
            className="btn btn-secondary btn-sm"
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            style={{ gap: '8px', minWidth: '176px', justifyContent: 'space-between' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Filter size={13} aria-hidden="true" style={{ flexShrink: 0 }} /> {filterLabel}
            </span>
            <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0, transition: 'transform var(--t-fast)', transform: filterOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {filterOpen && (
            <>
              <div onClick={() => setFilterOpen(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-dropdown) - 1)' }} />
              <div role="listbox" aria-label={t('allStatuses')}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setFilterOpen(false); filterBtnRef.current?.focus(); } }}
                style={{ position: 'absolute', left: 0, top: '100%', zIndex: 'var(--z-dropdown)', marginTop: '4px', minWidth: '190px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                {FILTERS.map(f => {
                  const on = f.id === filter;
                  return (
                    <button key={f.id} role="option" aria-selected={on}
                      onClick={() => { setFilter(f.id); setFilterOpen(false); filterBtnRef.current?.focus(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', minHeight: '40px', border: 'none', background: on ? 'var(--bg-muted)' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontFamily: 'var(--font-body)', color: on ? 'var(--accent-text)' : 'var(--text)', fontWeight: on ? 700 : 400, borderRadius: 'var(--radius-sm)' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-muted)'; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ width: '14px', display: 'inline-flex', flexShrink: 0 }}>{on && <Check size={14} aria-hidden="true" />}</span>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {/* Tri — même patron de popover que le filtre juste au-dessus. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={sortBtnRef}
            onClick={() => setSortOpen(o => !o)}
            onKeyDown={e => { if (e.key === 'Escape' && sortOpen) { e.preventDefault(); setSortOpen(false); } }}
            className="btn btn-secondary btn-sm"
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            style={{ gap: '8px', minWidth: '176px', justifyContent: 'space-between' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <ArrowUpDown size={13} aria-hidden="true" style={{ flexShrink: 0 }} /> {sortLabel}
            </span>
            <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0, transition: 'transform var(--t-fast)', transform: sortOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {sortOpen && (
            <>
              <div onClick={() => setSortOpen(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-dropdown) - 1)' }} />
              <div role="listbox" aria-label={t('sortBy')}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setSortOpen(false); sortBtnRef.current?.focus(); } }}
                style={{ position: 'absolute', left: 0, top: '100%', zIndex: 'var(--z-dropdown)', marginTop: '4px', minWidth: '190px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                {SORTS.map(s => {
                  const on = s.id === sort;
                  return (
                    <button key={s.id} role="option" aria-selected={on}
                      onClick={() => { setSort(s.id); setSortOpen(false); sortBtnRef.current?.focus(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', minHeight: '40px', border: 'none', background: on ? 'var(--bg-muted)' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontFamily: 'var(--font-body)', color: on ? 'var(--accent-text)' : 'var(--text)', fontWeight: on ? 700 : 400, borderRadius: 'var(--radius-sm)' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-muted)'; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ width: '14px', display: 'inline-flex', flexShrink: 0 }}>{on && <Check size={14} aria-hidden="true" />}</span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mono" style={{ fontSize: '11px', color: 'var(--text-light)', margin: '0 0 10px' }}>
        {rows.length === admin.users.length ? t('resultCount', { count: rows.length }) : t('resultCountFiltered', { count: rows.length, total: admin.users.length })}
      </p>

      <div className="card" style={{ overflow: 'visible' }}>
        {rows.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{t('noUsers')}</div>}
        {rows.map((u, i) => (
          <div key={u.id}
            onMouseEnter={() => setHoverId(u.id)}
            onMouseLeave={() => setHoverId(id => id === u.id ? null : id)}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: hoverId === u.id || menuId === u.id ? 'var(--bg-muted)' : 'transparent', transition: 'background var(--t-fast)' }}>
            <Avatar name={u.display_name} email={u.email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name || u.email}</span>
                {u.role !== 'user' && <span style={{ flexShrink: 0, fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{u.role}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            {/* Right meta cluster: status + join date stacked, right-aligned, then the actions menu. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, minWidth: '84px' }}>
              <StatusBadge status={u.status} />
              <span className="hide-sm" style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>{fmtDate(u.created_at)}</span>
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                ref={el => { menuBtnRefs.current[u.id] = el; }}
                onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                onKeyDown={e => { if (e.key === 'Escape' && menuId === u.id) { e.preventDefault(); closeMenu(u.id); } }}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={t('actions')}
                aria-haspopup="menu"
                aria-expanded={menuId === u.id}
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>
              {menuId === u.id && (
                <>
                  <div onClick={() => closeMenu()} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-dropdown) - 1)' }} />
                  <div role="menu" aria-label={t('actions')} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(u.id); } }}
                    style={{ position: 'absolute', right: 0, top: '100%', zIndex: 'var(--z-dropdown)', marginTop: '4px', minWidth: '190px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                    {(u.status === 'pending' || u.status === 'rejected') && (
                      <MenuItem Icon={Check} label={t('approve')} onClick={() => act(admin.approveUser(u.id), t('toastApproved'), () => notifyApproval(u.email, u.display_name))} />
                    )}
                    {u.status === 'approved' && (
                      <MenuItem Icon={Pause} label={t('suspend')} onClick={() => act(admin.setStatus(u.id, 'suspended'), t('toastSuspended'))} />
                    )}
                    {u.status === 'suspended' && (
                      <MenuItem Icon={Play} label={t('reactivate')} onClick={() => act(admin.setStatus(u.id, 'approved'), t('toastReactivated'))} />
                    )}
                    {isSuperAdmin && u.role === 'user' && (
                      <MenuItem Icon={ArrowUp} label={t('promoteAdmin')} onClick={() => act(admin.setRole(u.id, 'admin'), t('toastPromoted'))} />
                    )}
                    {isSuperAdmin && u.role === 'admin' && (
                      <MenuItem Icon={ArrowDown} label={t('demoteUser')} onClick={() => act(admin.setRole(u.id, 'user'), t('toastDemoted'))} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <style>{`@media (max-width: 640px) { .hide-sm { display: none; } }`}</style>
    </div>
  );
}

function MenuItem({ Icon, label, onClick }: { Icon: typeof Check; label: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', minHeight: '44px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', color: 'var(--text)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      <Icon size={14} aria-hidden="true" /> {label}
    </button>
  );
}

/* ===================== TAB 3 — Notifications ===================== */
function NotificationsTab({ admin, onToast }: { admin: AdminData; onToast: Toast }) {
  const t = useTranslations('admin');
  async function markAll() {
    const { error } = await admin.markAllNotificationsRead();
    onToast(error ? t('toastError', { error }) : t('toastNotifsRead'), error ? 'error' : 'success');
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <TabIntro>{t('notificationsHint')}</TabIntro>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span className="label">{admin.notifications.length > 1 ? t('notifUnreadPlural', { count: admin.notifications.length }) : t('notifUnread', { count: admin.notifications.length })}</span>
        {admin.notifications.length > 0 && (
          <button onClick={markAll} className="btn btn-secondary btn-sm">{t('markAllRead')}</button>
        )}
      </div>
      {admin.notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={44} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: '15px' }}>{t('noNotifications')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {admin.notifications.map(n => (
            <div key={n.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
              <span style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={16} aria-hidden="true" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                  {t('newSignup')} — <strong>{n.payload?.display_name || n.payload?.email}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{n.payload?.email}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', flexShrink: 0 }}>{relative(n.created_at, t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== TAB 4 — Système / diagnostic ===================== */
/* Surface la page /admin/health (existante) : c'est le « suivi du logiciel » —
   secrets, transport des données, migrations. On ne ré-implémente pas la page
   complète ici, mais on affiche désormais 3 chiffres en direct (rollout API,
   migrations appliquées, secrets) au lieu d'une liste statique de 3 libellés
   génériques qui ne disait pas si tout allait bien SANS cliquer vers /admin/health. */
export function SystemStatChips() {
  const t = useTranslations('admin');
  const [health, setHealth] = useState<{ ok: boolean; migrations: string[]; dataLayer?: { apiPercent: number } } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health').then(r => r.ok ? r.json() : null).then(d => { if (active) setHealth(d); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <div className="card" style={{ flex: '1 1 120px', padding: '10px 14px' }}>
        <div className="serif" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>
          {health?.dataLayer ? `${health.dataLayer.apiPercent}%` : '—'}
        </div>
        <div className="label" style={{ fontSize: '9.5px', marginTop: '2px' }}>{t('systemRollout')}</div>
      </div>
      <div className="card" style={{ flex: '1 1 120px', padding: '10px 14px' }}>
        <div className="serif" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>
          {health ? health.migrations.length : '—'}
        </div>
        <div className="label" style={{ fontSize: '9.5px', marginTop: '2px' }}>{t('systemMigrationsOk')}</div>
      </div>
      <div className="card" style={{ flex: '1 1 120px', padding: '10px 14px' }}>
        <div className="serif" style={{ fontSize: '1.2rem', fontWeight: 700, color: health ? (health.ok ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>
          {health ? (health.ok ? '✓' : '!') : '—'}
        </div>
        <div className="label" style={{ fontSize: '9.5px', marginTop: '2px' }}>{health?.ok === false ? t('systemSecretsMissing') : t('systemSecretsOk')}</div>
      </div>
    </div>
  );
}

function SystemTab() {
  const t = useTranslations('admin');
  return (
    <div style={{ maxWidth: '760px' }}>
      <TabIntro>{t('systemHint')}</TabIntro>
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '40px', height: '40px', flexShrink: 0, borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} aria-hidden="true" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{t('systemHealthTitle')}</h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('systemHealthDesc')}</p>
          </div>
        </div>
        <div style={{ marginTop: '14px' }}>
          <SystemStatChips />
        </div>
        <Link href="/admin/health" className="btn btn-primary btn-sm" style={{ marginTop: '18px', gap: '7px' }}>
          {t('systemHealthCta')} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
