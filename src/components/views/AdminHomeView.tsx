'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck, Clock, Users, Bell, Activity, ArrowRight, CheckCircle, RadioTower,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminData } from '@/hooks/useAdminData';
import type { UserRole } from '@/types';

type AdminTab = 'pending' | 'users' | 'notifications' | 'system';

interface Props {
  admin: AdminData;
  role?: UserRole;
  displayName?: string | null;
  userEmail?: string | null;
  onOpenAdmin: (tab: AdminTab) => void;
}

function firstNameOf(displayName?: string | null, email?: string | null): string {
  const src = (displayName || '').trim();
  if (src) return src.split(/\s+/)[0];
  const local = (email || '').split('@')[0] || '';
  if (!local) return '';
  const token = local.split(/[._-]+/)[0] || local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function initials(name?: string, email?: string): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
}

/**
 * Dashboard « Accueil » dédié aux comptes admin/superadmin. Un admin pur n'a
 * PAS d'arbre actif de façon permanente (rôle = modération, pas construction
 * d'un arbre personnel — voir CLAUDE.md) : le DashboardView standard (CTA
 * « créer votre arbre », anniversaires vides, IA récit/photo désactivées)
 * n'a donc rien d'utile à montrer. On le remplace par un accueil orienté
 * modération : chiffres-clés, aperçu des files (demandes/notifications) et
 * accès rapides vers les sections Admin.
 */
export default function AdminHomeView({ admin, role, displayName, userEmail, onOpenAdmin }: Props) {
  const t = useTranslations('adminHome');
  const ta = useTranslations('admin');
  const tp = useTranslations('profile');
  const firstName = firstNameOf(displayName, userEmail);

  const today = useMemo(
    () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  );

  const pending = useMemo(() => admin.users.filter(u => u.status === 'pending'), [admin.users]);
  const activeCount = useMemo(() => admin.users.filter(u => u.status === 'approved').length, [admin.users]);
  const roleLabel = role === 'superadmin' ? tp('roleSuperadmin') : tp('roleAdmin');

  const stats: { tab: AdminTab; label: string; value: number; tone: string; Icon: LucideIcon }[] = [
    { tab: 'users', label: ta('statTotalUsers'), value: admin.users.length, tone: 'var(--accent)', Icon: Users },
    { tab: 'users', label: ta('statActive'), value: activeCount, tone: 'var(--success)', Icon: CheckCircle },
    { tab: 'pending', label: ta('statPending'), value: pending.length, tone: pending.length ? 'var(--warning)' : 'var(--text-muted)', Icon: Clock },
    { tab: 'notifications', label: ta('statUnread'), value: admin.unreadCount, tone: admin.unreadCount ? 'var(--danger)' : 'var(--text-muted)', Icon: Bell },
  ];

  const QUICK: { tab: AdminTab; Icon: LucideIcon; title: string; desc: string; badge?: number }[] = [
    { tab: 'pending', Icon: Clock, title: ta('tabPending'), desc: t('linkPendingDesc'), badge: pending.length },
    { tab: 'users', Icon: Users, title: ta('tabUsers'), desc: t('linkUsersDesc') },
    { tab: 'notifications', Icon: Bell, title: ta('tabNotifications'), desc: t('linkNotificationsDesc'), badge: admin.unreadCount },
    { tab: 'system', Icon: Activity, title: ta('tabSystem'), desc: t('linkSystemDesc') },
  ];

  return (
    <div className="adh-root" style={{ flex: 1, overflowY: 'auto', background: 'radial-gradient(130% 80% at 50% -5%, rgba(201,168,76,0.06), transparent 58%), var(--bg)' }}>
      <div className="adh-wrap">

        {/* ===== HERO ===== */}
        <header className="adh-hero">
          <div className="adh-hero-top">
            <span className="adh-date">{today}</span>
            <span className="adh-role">
              <ShieldCheck size={13} aria-hidden="true" /> {roleLabel}
            </span>
          </div>
          <h1 className="adh-title">{firstName ? t('greeting', { name: firstName }) : t('greetingGeneric')}</h1>
          <span className="adh-rule" aria-hidden="true" />
          <p className="adh-sub">{t('subtitle')}</p>
        </header>

        {/* ===== STATS ===== */}
        <div className="adh-stats">
          {stats.map((s, i) => (
            <button key={i} className="adh-stat" onClick={() => onOpenAdmin(s.tab)}>
              <s.Icon className="adh-stat-icon" size={17} aria-hidden="true" style={{ color: s.tone }} />
              <div className="adh-stat-num" style={{ color: s.tone }}>{s.value}</div>
              <div className="adh-stat-label">{s.label}</div>
            </button>
          ))}
        </div>

        {/* ===== PENDING + NOTIFICATIONS PREVIEW ===== */}
        <div className="adh-two">
          <section className="adh-card adh-card-warm">
            <Head Icon={Clock} eyebrow={t('pendingEyebrow')} title={ta('tabPending')}
              action={pending.length > 0 ? { label: t('viewAll'), onClick: () => onOpenAdmin('pending') } : undefined} />
            {pending.length > 0 ? (
              <ul className="adh-rows">
                {pending.slice(0, 5).map(u => (
                  <li key={u.id}>
                    <button className="adh-row" onClick={() => onOpenAdmin('pending')}>
                      <span className="adh-ava">{initials(u.display_name, u.email)}</span>
                      <span className="adh-row-body">
                        <span className="adh-row-name">{u.display_name || u.email}</span>
                        <span className="adh-row-sub">{u.email}</span>
                      </span>
                      <span className="adh-when">{fmtDate(u.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="adh-empty">
                <CheckCircle size={28} strokeWidth={1.25} aria-hidden="true" style={{ color: 'var(--success)' }} />
                <p>{ta('noPending')}</p>
              </div>
            )}
          </section>

          <section className="adh-card">
            <Head Icon={Bell} eyebrow={t('notificationsEyebrow')} title={ta('tabNotifications')}
              action={admin.notifications.length > 0 ? { label: t('viewAll'), onClick: () => onOpenAdmin('notifications') } : undefined} />
            {admin.notifications.length > 0 ? (
              <ul className="adh-rows">
                {admin.notifications.slice(0, 5).map(n => (
                  <li key={n.id}>
                    <button className="adh-row" onClick={() => onOpenAdmin('notifications')}>
                      <span className="adh-ava"><Bell size={14} aria-hidden="true" /></span>
                      <span className="adh-row-body">
                        <span className="adh-row-name">{ta('newSignup')}</span>
                        <span className="adh-row-sub">{n.payload?.display_name || n.payload?.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="adh-empty">
                <Bell size={28} strokeWidth={1.25} aria-hidden="true" style={{ color: 'var(--text-light)' }} />
                <p>{ta('noNotifications')}</p>
              </div>
            )}
          </section>
        </div>

        {/* ===== QUICK ACCESS ===== */}
        <section className="adh-card">
          <Head eyebrow={t('quickAccessEyebrow')} title={t('quickAccess')} />
          <div className="adh-quick">
            {QUICK.map(q => (
              <button key={q.tab} onClick={() => onOpenAdmin(q.tab)} className="adh-quick-btn">
                <span className="adh-quick-icon">
                  <q.Icon size={18} aria-hidden="true" />
                  {!!q.badge && <span className="adh-quick-badge">{q.badge}</span>}
                </span>
                <span className="adh-quick-body">
                  <span className="adh-quick-t">{q.title}</span>
                  <span className="adh-quick-d">{q.desc}</span>
                </span>
                <ArrowRight size={14} aria-hidden="true" className="adh-quick-go" />
              </button>
            ))}
          </div>
        </section>

        {/* ===== PLATFORM STATUS LINK ===== */}
        <a href="/status" target="_blank" rel="noopener noreferrer" className="adh-status">
          <span className="adh-status-icon"><RadioTower size={16} aria-hidden="true" /></span>
          <span className="adh-status-body">
            <span className="adh-status-t">{t('statusTitle')}</span>
            <span className="adh-status-d">{t('statusDesc')}</span>
          </span>
          <ArrowRight size={14} aria-hidden="true" style={{ color: 'var(--text-light)' }} />
        </a>
      </div>

      <style>{`
        .adh-wrap { padding: 36px 40px 56px; max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 26px; }

        .adh-hero { padding: 4px 0 2px; }
        .adh-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
        .adh-date { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); }
        .adh-role { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-text); background: var(--accent-light); padding: 4px 10px; }
        .adh-title { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.5rem, 6vw, 4rem); line-height: 1; letter-spacing: -0.03em; color: var(--accent); margin: 0; text-wrap: balance; overflow-wrap: break-word; }
        .adh-rule { display: block; width: 60px; height: 2px; background: var(--accent); margin: 18px 0 0; }
        .adh-sub { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); margin: 16px 0 0; max-width: 56ch; line-height: 1.5; }

        .adh-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .adh-stat { position: relative; background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--accent);
          padding: 18px 20px; display: flex; flex-direction: column; align-items: flex-start; cursor: pointer; text-align: left;
          font-family: inherit; transition: box-shadow var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out), background var(--t-base) var(--ease-out); }
        .adh-stat:hover { background: #252535; box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .adh-stat:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .adh-stat-icon { margin-bottom: 11px; }
        .adh-stat-num { font-family: var(--font-display); font-weight: 700; line-height: 0.95; font-size: clamp(2rem, 4vw, 2.6rem); letter-spacing: -0.02em; }
        .adh-stat-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-top: 8px; }

        .adh-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        .adh-card { background: var(--bg-card); border: 1px solid var(--border); padding: 22px 24px; display: flex; flex-direction: column; }
        .adh-card-warm { background: linear-gradient(150% 120% at 0% 0%, rgba(201,168,76,0.07), transparent 55%), var(--bg-card); border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); }
        .adh-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .adh-eyebrow { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 5px; }
        .adh-h { margin: 0; font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; letter-spacing: -0.005em; }
        .adh-head-link { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); background: none; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .adh-head-link:hover { color: var(--accent); }

        .adh-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .adh-row { width: 100%; display: flex; align-items: center; gap: 11px; padding: 8px; border: none; background: transparent; cursor: pointer; text-align: left; transition: background var(--t-fast); font-family: inherit; }
        .adh-row:hover { background: var(--bg-muted); }
        .adh-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .adh-ava { width: 32px; height: 32px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--accent-light); color: var(--accent); font-size: 12px; font-weight: 700; font-family: var(--font-body); }
        .adh-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .adh-row-name { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adh-row-sub { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adh-when { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-text); flex-shrink: 0; }
        .adh-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 28px 12px; text-align: center; }
        .adh-empty p { margin: 0; font-size: 13px; color: var(--text-muted); }

        .adh-quick { display: flex; flex-direction: column; gap: 8px; }
        .adh-quick-btn { position: relative; display: flex; align-items: center; gap: 14px; text-align: left; padding: 14px 16px; cursor: pointer; background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); font-family: inherit; transition: transform var(--t-fast) var(--ease-out), box-shadow var(--t-fast), border-color var(--t-fast), background var(--t-fast); }
        .adh-quick-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-accent); background: var(--bg-card); border-color: var(--accent); }
        .adh-quick-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .adh-quick-icon { position: relative; flex-shrink: 0; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent-light); color: var(--accent); }
        .adh-quick-badge { position: absolute; top: -6px; right: -6px; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; }
        .adh-quick-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .adh-quick-t { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); }
        .adh-quick-d { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
        .adh-quick-go { color: var(--text-light); flex-shrink: 0; transition: color var(--t-fast), transform var(--t-fast) var(--ease-out); }
        .adh-quick-btn:hover .adh-quick-go { color: var(--accent-text); transform: translateX(3px); }

        .adh-status { display: flex; align-items: center; gap: 14px; padding: 16px 20px; background: var(--bg-card); border: 1px solid var(--border); text-decoration: none; transition: border-color var(--t-fast), background var(--t-fast); }
        .adh-status:hover { border-color: var(--accent); background: #252535; }
        .adh-status-icon { flex-shrink: 0; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; background: var(--bg-muted); color: var(--text-muted); }
        .adh-status-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .adh-status-t { font-family: var(--font-body); font-size: 13px; font-weight: 700; color: var(--ink); }
        .adh-status-d { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }

        @media (prefers-reduced-motion: reduce) {
          .adh-stat:hover, .adh-quick-btn:hover { transform: none; }
          .adh-quick-btn:hover .adh-quick-go { transform: none; }
        }
        @media (max-width: 880px) {
          .adh-two { grid-template-columns: 1fr; }
          .adh-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .adh-wrap { padding: 22px 18px 44px; gap: 20px; }
        }
      `}</style>
    </div>
  );
}

function Head({ Icon, eyebrow, title, action }: { Icon?: LucideIcon; eyebrow?: string; title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <header className="adh-head">
      <div>
        {eyebrow && <div className="adh-eyebrow">{Icon && <Icon size={13} aria-hidden="true" />}{eyebrow}</div>}
        <h2 className="adh-h">{title}</h2>
      </div>
      {action && (
        <button className="adh-head-link" onClick={action.onClick}>{action.label}</button>
      )}
    </header>
  );
}
