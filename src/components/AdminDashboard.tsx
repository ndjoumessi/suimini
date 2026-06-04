'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Users, Building2, Bell, CheckCircle, Check, X, Search,
  MoreVertical, UserPlus, Pause, Play, ArrowUp, ArrowDown, Clock,
} from 'lucide-react';
import type { AdminData } from '@/hooks/useAdminData';
import type { UserProfile, UserStatus, UserRole } from '@/types';

type Tab = 'pending' | 'users' | 'tenants' | 'notifications';
type Toast = (msg: string, type?: 'success' | 'error' | 'info') => void;

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

function relative(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

const STATUS_BADGE: Record<UserStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: 'rgba(199,125,26,0.16)', fg: 'var(--warning)' },
  approved: { label: 'Actif', bg: 'rgba(74,124,89,0.16)', fg: 'var(--success)' },
  rejected: { label: 'Refusé', bg: 'rgba(156,59,59,0.14)', fg: 'var(--danger)' },
  suspended: { label: 'Suspendu', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
};

function StatusBadge({ status }: { status: UserStatus }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  return <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '100px', background: b.bg, color: b.fg }}>{b.label}</span>;
}

function Avatar({ name, email }: { name?: string; email?: string }) {
  return (
    <span style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
      {initials(name, email)}
    </span>
  );
}

export default function AdminDashboard({ admin, role, onToast }: { admin: AdminData; role?: UserRole; onToast: Toast }) {
  const [tab, setTab] = useState<Tab>('pending');
  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    admin.fetchUsers();
    admin.fetchTenants();
    admin.fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => admin.users.filter(u => u.status === 'pending'), [admin.users]);

  const TABS: { id: Tab; label: string; Icon: typeof Users; badge?: number }[] = [
    { id: 'pending', label: 'Demandes en attente', Icon: Clock, badge: pending.length },
    { id: 'users', label: 'Utilisateurs', Icon: Users },
    { id: 'tenants', label: 'Organisations', Icon: Building2 },
    { id: 'notifications', label: 'Notifications', Icon: Bell, badge: admin.unreadCount },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={22} style={{ color: 'var(--accent)' }} aria-hidden="true" /> Administration
        </h1>
        {/* Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: '4px', marginTop: '14px', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: active ? 700 : 400, color: active ? 'var(--accent)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
                <t.Icon size={15} aria-hidden="true" /> {t.label}
                {t.badge ? <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '100px', padding: '1px 7px' }}>{t.badge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg)' }}>
        {tab === 'pending' && <PendingTab admin={admin} pending={pending} onToast={onToast} />}
        {tab === 'users' && <UsersTab admin={admin} isSuperAdmin={isSuperAdmin} onToast={onToast} />}
        {tab === 'tenants' && <TenantsTab admin={admin} onToast={onToast} />}
        {tab === 'notifications' && <NotificationsTab admin={admin} onToast={onToast} />}
      </div>
    </div>
  );
}

/* ===================== TAB 1 — Pending requests ===================== */
function PendingTab({ admin, pending, onToast }: { admin: AdminData; pending: UserProfile[]; onToast: Toast }) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(u: UserProfile) {
    setBusy(u.id);
    const { error } = await admin.approveUser(u.id);
    setBusy(null);
    onToast(error ? `Erreur : ${error}` : 'Compte approuvé', error ? 'error' : 'success');
  }
  async function confirmReject(u: UserProfile) {
    setBusy(u.id);
    const { error } = await admin.rejectUser(u.id, reason.trim() || undefined);
    setBusy(null);
    setRejectingId(null);
    setReason('');
    onToast(error ? `Erreur : ${error}` : 'Compte refusé', error ? 'error' : 'info');
  }

  if (pending.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <CheckCircle size={48} strokeWidth={1.25} style={{ color: 'var(--success)' }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: '15px' }}>Aucune demande en attente</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
      {pending.map(u => (
        <div key={u.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar name={u.display_name} email={u.email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{u.display_name || u.email}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                {u.organization ? `${u.organization} · ` : ''}{fmtDate(u.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => approve(u)} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', gap: '5px' }} aria-label="Approuver">
                <Check size={14} aria-hidden="true" /> Approuver
              </button>
              <button onClick={() => { setRejectingId(rejectingId === u.id ? null : u.id); setReason(''); }} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--bg-muted)', color: 'var(--danger)', border: '1px solid var(--border)', gap: '5px' }} aria-label="Refuser">
                <X size={14} aria-hidden="true" /> Refuser
              </button>
            </div>
          </div>
          {rejectingId === u.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Raison du refus (optionnel)"
                className="input" style={{ width: '100%', resize: 'vertical', fontFamily: 'Inter, sans-serif' }} autoFocus />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => { setRejectingId(null); setReason(''); }} className="btn btn-ghost btn-sm">Annuler</button>
                <button onClick={() => confirmReject(u)} disabled={busy === u.id} className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }}>Confirmer le refus</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ===================== TAB 2 — All users ===================== */
function UsersTab({ admin, isSuperAdmin, onToast }: { admin: AdminData; isSuperAdmin: boolean; onToast: Toast }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<UserStatus | 'all'>('all');
  const [menuId, setMenuId] = useState<string | null>(null);

  const rows = useMemo(() => admin.users.filter(u => {
    if (filter !== 'all' && u.status !== filter) return false;
    if (q && !(`${u.display_name || ''} ${u.email}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [admin.users, q, filter]);

  async function act(fn: Promise<{ error?: string }>, okMsg: string) {
    setMenuId(null);
    const { error } = await fn;
    onToast(error ? `Erreur : ${error}` : okMsg, error ? 'error' : 'success');
  }

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} aria-hidden="true" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher nom ou email…" className="input" style={{ width: '100%', paddingLeft: '32px' }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as UserStatus | 'all')} className="input" style={{ width: 'auto' }}>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Actif</option>
          <option value="rejected">Refusé</option>
          <option value="suspended">Suspendu</option>
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'visible' }}>
        {rows.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Aucun utilisateur</div>}
        {rows.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <Avatar name={u.display_name} email={u.email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                {u.display_name || u.email}
                {u.role !== 'user' && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 7px', borderRadius: '100px' }}>{u.role}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            <div style={{ width: '90px', flexShrink: 0 }}><StatusBadge status={u.status} /></div>
            <div style={{ width: '96px', flexShrink: 0, fontSize: '12px', color: 'var(--text-light)' }} className="hide-sm">{fmtDate(u.created_at)}</div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setMenuId(menuId === u.id ? null : u.id)} className="btn btn-ghost btn-icon btn-sm" aria-label="Actions"><MoreVertical size={16} aria-hidden="true" /></button>
              {menuId === u.id && (
                <>
                  <div onClick={() => setMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                  <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, marginTop: '4px', minWidth: '190px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                    {(u.status === 'pending' || u.status === 'rejected') && (
                      <MenuItem Icon={Check} label="Approuver" onClick={() => act(admin.approveUser(u.id), 'Compte approuvé')} />
                    )}
                    {u.status === 'approved' && (
                      <MenuItem Icon={Pause} label="Suspendre" onClick={() => act(admin.setStatus(u.id, 'suspended'), 'Compte suspendu')} />
                    )}
                    {u.status === 'suspended' && (
                      <MenuItem Icon={Play} label="Réactiver" onClick={() => act(admin.setStatus(u.id, 'approved'), 'Compte réactivé')} />
                    )}
                    {isSuperAdmin && u.role === 'user' && (
                      <MenuItem Icon={ArrowUp} label="Promouvoir admin" onClick={() => act(admin.setRole(u.id, 'admin'), 'Promu admin')} />
                    )}
                    {isSuperAdmin && u.role === 'admin' && (
                      <MenuItem Icon={ArrowDown} label="Rétrograder user" onClick={() => act(admin.setRole(u.id, 'user'), 'Rétrogradé user')} />
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
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', color: 'var(--text)', borderRadius: 'var(--radius-sm)', fontFamily: 'Inter, sans-serif' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      <Icon size={14} aria-hidden="true" /> {label}
    </button>
  );
}

/* ===================== TAB 3 — Tenants ===================== */
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function TenantsTab({ admin, onToast }: { admin: AdminData; onToast: Toast }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [plan, setPlan] = useState<'free' | 'family' | 'pro'>('free');
  const [busy, setBusy] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  async function create() {
    if (!name.trim() || !effectiveSlug) { onToast('Nom et slug requis', 'error'); return; }
    setBusy(true);
    const { error } = await admin.createTenant({ name: name.trim(), slug: effectiveSlug, plan });
    setBusy(false);
    if (error) { onToast(`Erreur : ${error}`, 'error'); return; }
    onToast('Organisation créée', 'success');
    setName(''); setSlug(''); setSlugEdited(false); setPlan('free');
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      {/* Create form */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px' }}>
        <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>Nouvelle organisation</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom (ex: Famille Dupont)" className="input" style={{ flex: 1, minWidth: '160px' }} />
          <input value={effectiveSlug} onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }} placeholder="slug" className="input" style={{ flex: 1, minWidth: '120px' }} />
          <select value={plan} onChange={e => setPlan(e.target.value as 'free' | 'family' | 'pro')} className="input" style={{ width: 'auto' }}>
            <option value="free">Free</option>
            <option value="family">Family</option>
            <option value="pro">Pro</option>
          </select>
          <button onClick={create} disabled={busy} className="btn btn-primary btn-sm" style={{ gap: '5px' }}><UserPlus size={14} aria-hidden="true" /> Créer</button>
        </div>
      </div>

      {/* List */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        {admin.tenants.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Aucune organisation</div>}
        {admin.tenants.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <Building2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/{t.slug} · {t.max_members} membres max</div>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '100px', flexShrink: 0 }}>{t.plan}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: t.is_active ? 'var(--success)' : 'var(--text-light)', flexShrink: 0 }}>{t.is_active ? 'Actif' : 'Inactif'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== TAB 4 — Notifications ===================== */
function NotificationsTab({ admin, onToast }: { admin: AdminData; onToast: Toast }) {
  async function markAll() {
    const { error } = await admin.markAllNotificationsRead();
    onToast(error ? `Erreur : ${error}` : 'Notifications marquées comme lues', error ? 'error' : 'success');
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span className="label">{admin.notifications.length} non lue{admin.notifications.length > 1 ? 's' : ''}</span>
        {admin.notifications.length > 0 && (
          <button onClick={markAll} className="btn btn-secondary btn-sm">Tout marquer comme lu</button>
        )}
      </div>
      {admin.notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={44} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: '15px' }}>Aucune notification</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {admin.notifications.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <span style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={16} aria-hidden="true" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                  Nouvelle inscription — <strong>{n.payload?.display_name || n.payload?.email}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{n.payload?.email}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', flexShrink: 0 }}>{relative(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
