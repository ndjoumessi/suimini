'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { countPendingSuggestions } from '@/lib/collaboration';
import { relativeSyncParts } from '@/lib/relativeTime';
import { FamilyTree, ViewMode } from '@/types';
import {
  Home, TreePine, Users, Calendar, Map, Images, BookOpen, Cake, Search, BarChart2, Settings,
  ChevronRight, LogOut, LogIn, Check, CloudOff, Shield, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { BrandMark } from './Brand';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
import type { LucideIcon } from 'lucide-react';

// `navKey` indexes into the `nav` message namespace (see messages/*.json).
interface NavItem { view: ViewMode; Icon: LucideIcon; navKey: string }
const NAV_GROUPS: { labelKey: string; items: NavItem[] }[] = [
  { labelKey: 'sectionMain', items: [
    { view: 'dashboard', Icon: Home, navKey: 'home' },
    { view: 'tree', Icon: TreePine, navKey: 'tree' },
    { view: 'list', Icon: Users, navKey: 'persons' },
  ] },
  { labelKey: 'sectionExplore', items: [
    { view: 'map', Icon: Map, navKey: 'map' },
    { view: 'timeline', Icon: Calendar, navKey: 'timeline' },
    { view: 'journal', Icon: BookOpen, navKey: 'journal' },
    { view: 'birthdays', Icon: Cake, navKey: 'birthdays' },
    { view: 'gallery', Icon: Images, navKey: 'gallery' },
    { view: 'ancestors', Icon: Search, navKey: 'exploration' },
    { view: 'statistics', Icon: BarChart2, navKey: 'statistics' },
  ] },
  { labelKey: 'sectionManage', items: [
    { view: 'settings', Icon: Settings, navKey: 'settings' },
  ] },
];

interface Props {
  activeView: ViewMode;
  onViewChange: (v: ViewMode) => void;
  activeTree: FamilyTree | null;
  trees: FamilyTree[];
  onShowTreeSelector: () => void;
  canEdit?: boolean;
  /** Effective role on the active tree, for the badge under "Arbre actif". */
  userRole?: 'owner' | 'admin' | 'editor' | 'viewer';
  birthdayAlertCount?: number;
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  displayName?: string | null;
  isDemo?: boolean;
  cloud?: boolean;
  syncStatus?: 'idle' | 'saved' | 'syncing' | 'offline' | 'error';
  lastSyncAt?: number | null;
  onResync?: () => void | Promise<void>;
  presenceCount?: number;
  onSignIn?: () => void;
  onSignOut?: () => void;
  isAdmin?: boolean;
  unreadCount?: number;
}

function SyncIndicator({ status }: { status: 'idle' | 'saved' | 'syncing' | 'offline' | 'error' }) {
  const ts = useTranslations('sidebar');
  if (status === 'syncing') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)' }}><span className="spinner" style={{ width: 11, height: 11 }} /> {ts('syncSyncing')}</span>;
  if (status === 'error') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}><CloudOff size={12} /> {ts('syncError')}</span>;
  if (status === 'offline') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}><CloudOff size={12} /> {ts('syncOffline')}</span>;
  if (status === 'saved') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}><Check size={12} /> {ts('syncSaved')}</span>;
  return null;
}

export default function Sidebar({ activeView, onViewChange, activeTree, trees, onShowTreeSelector, userRole, birthdayAlertCount = 0, isOpen, onClose, userEmail, displayName, isDemo, cloud, syncStatus = 'idle', lastSyncAt, onResync, presenceCount = 0, onSignIn, onSignOut, isAdmin = false, unreadCount = 0 }: Props) {
  const t = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const tr = useTranslations('roles');
  const tSync = useTranslations('sync');
  // Re-render every 60s so the "last sync X min ago" label stays current.
  const [, setSyncTick] = useState(0);
  useEffect(() => {
    if (!cloud || lastSyncAt == null) return;
    const id = setInterval(() => setSyncTick(n => n + 1), 60000);
    return () => clearInterval(id);
  }, [cloud, lastSyncAt]);

  // Pending edit-suggestions on the active tree (owner alert). Polls every 60s.
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const activeTreeId = activeTree?.id;
  useEffect(() => {
    if (!cloud || !userEmail || !activeTreeId) { setPendingSuggestions(0); return; }
    let alive = true;
    const refresh = () => { countPendingSuggestions(activeTreeId).then(n => { if (alive) setPendingSuggestions(n); }); };
    refresh();
    const iv = setInterval(refresh, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, [cloud, userEmail, activeTreeId]);

  const navItem = (item: NavItem, opts?: { badge?: number; Icon?: LucideIcon; navKey?: string; view?: ViewMode }) => {
    const view = opts?.view ?? item.view;
    const Icon = opts?.Icon ?? item.Icon;
    const navKey = opts?.navKey ?? item.navKey;
    const active = activeView === view;
    const badge = opts?.badge ?? (view === 'birthdays' ? birthdayAlertCount : 0);
    return (
      <button key={view}
        onClick={() => { onViewChange(view); onClose(); }}
        aria-current={active ? 'page' : undefined}
        aria-label={t(navKey)}
        className={`sb-item ${active ? 'sb-item-active' : ''}`}
      >
        {active && <span aria-hidden="true" className="sb-active-bar" />}
        <span className="sb-icon">
          <Icon size={18} aria-hidden="true" />
          {badge > 0 && <span className="birthday-pulse-dot" />}
        </span>
        <span className="sb-label">{t(navKey)}</span>
        {badge > 0 && <span className="sb-label birthday-badge sb-count">{badge}</span>}
      </button>
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label={ts('navAria')}>
      <div className="sidebar-panel">
        {/* Logo */}
        <div className="sb-head">
          <Link href="/" aria-label={ts('backToSiteAria')} title={ts('backToSiteTitle')} className="sb-brand">
            <BrandMark size={30} color="var(--ink)" accent="var(--accent)" surface="var(--bg)" />
            <span className="sb-label sb-wordmark serif">Suimini</span>
          </Link>
          <div className="sb-label sb-head-meta">
            {isDemo
              ? <span className="badge badge-accent" style={{ fontSize: '9px' }}>{ts('demoBadge')}</span>
              : <span className="label" style={{ fontSize: '9px', letterSpacing: '1px' }}>{ts('tagline')}</span>}
            <LanguageSwitcher tone="app" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="sb-nav">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'sb-group' : undefined}>
              <div className="sb-label sb-section">{ts(group.labelKey)}</div>
              {group.items.map(item => navItem(item))}
            </div>
          ))}
          {isAdmin && (
            <div className="sb-group">
              <div className="sb-label sb-section">&nbsp;</div>
              {navItem({ view: 'admin', Icon: Shield, navKey: 'admin' }, { badge: unreadCount })}
            </div>
          )}
        </nav>

        {/* Active tree — compact badge */}
        <button onClick={onShowTreeSelector} aria-label={ts('changeTreeAria')} className="sb-tree">
          <span className="sb-tree-mark" aria-hidden="true">{(activeTree?.name || '·').charAt(0).toUpperCase()}</span>
          <span className="sb-label sb-tree-body">
            <span className="sb-tree-row">
              <span className="sb-tree-name">{activeTree?.name || ts('noTree')}</span>
              {pendingSuggestions > 0 && <span className="sb-pending" title={ts('pendingSuggestions', { count: pendingSuggestions })}>{pendingSuggestions}</span>}
              <ChevronRight size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
            </span>
            {activeTree && (
              <span className="sb-tree-meta">{ts('treeMeta', { persons: activeTree.persons.length, links: activeTree.relationships.length })}</span>
            )}
            {activeTree && userRole && (
              <span className="sb-role" style={{ color: userRole === 'viewer' ? 'var(--text-muted)' : userRole === 'editor' ? 'var(--success)' : 'var(--accent-text)' }}>{tr(userRole)}</span>
            )}
          </span>
        </button>

        {/* Account */}
        <div className="sb-account">
          {userEmail ? (
            <>
              <div className="sb-account-row">
                <button onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profil'; }}
                  aria-label={ts('myProfile')} title={ts('myProfile')} className="sb-account-btn">
                  <span className="sb-avatar mono">{initials(displayName, userEmail)}</span>
                  <span className="sb-label sb-account-id">
                    <span className="sb-account-name">{truncate(displayName || userEmail.split('@')[0], 16)}</span>
                    <span className="sb-account-email">{truncate(userEmail, 22)}</span>
                  </span>
                </button>
                <button onClick={onSignOut} aria-label={ts('signOut')} title={ts('signOut')} className="sb-logout sb-label"><LogOut size={16} /></button>
              </div>
              {cloud && syncStatus !== 'idle' && (
                <div className="sb-label" style={{ fontSize: '10px', marginTop: '5px', textAlign: 'center' }}><SyncIndicator status={syncStatus} /></div>
              )}
              {cloud && onResync && lastSyncAt != null && (() => {
                const { key, count } = relativeSyncParts(lastSyncAt);
                const time = count != null ? tSync(key, { count }) : tSync(key);
                return (
                  <button onClick={() => onResync()} disabled={syncStatus === 'syncing'} title={tSync('resync')} className="sb-label sb-resync">
                    <RefreshCw size={10} aria-hidden="true" style={{ animation: syncStatus === 'syncing' ? 'spin 0.8s linear infinite' : undefined }} />
                    {tSync('lastSync', { time })}
                  </button>
                );
              })()}
              {presenceCount > 1 && (
                <div className="sb-label" style={{ fontSize: '10px', color: 'var(--accent-text)', textAlign: 'center', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Users size={11} /> {ts('presence', { count: presenceCount })}
                </div>
              )}
            </>
          ) : (
            <button onClick={onSignIn} className="sb-item" aria-label={ts('signIn')} title={ts('signIn')}>
              <span className="sb-icon"><LogIn size={18} /></span>
              <span className="sb-label">{ts('signIn')}</span>
            </button>
          )}
          <Link href="/" className="sb-item sb-foot-link" onClick={onClose} aria-label={ts('backToSite')} title={ts('backToSite')}>
            <span className="sb-icon"><ArrowLeft size={16} /></span>
            <span className="sb-label">{ts('backToSite')}</span>
          </Link>
        </div>
      </div>

      <style>{`
        .sidebar { width: 64px; flex-shrink: 0; position: relative; z-index: var(--z-sticky); }
        .sidebar-panel {
          position: absolute; inset: 0 auto 0 0; width: 64px;
          background: var(--bg-card); border-right: var(--bw) solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
          transition: width var(--t-base) var(--ease-out), box-shadow var(--t-base) var(--ease-out);
        }
        .sidebar:hover .sidebar-panel, .sidebar:focus-within .sidebar-panel {
          width: 240px; box-shadow: var(--shadow-lg);
        }
        /* labels + expand-only blocks fade in on expand; clipped while collapsed */
        .sb-label { opacity: 0; white-space: nowrap; transition: opacity var(--t-fast) ease; }
        .sidebar:hover .sb-label, .sidebar:focus-within .sb-label { opacity: 1; }

        .sb-head { display: flex; flex-direction: column; gap: 8px; padding: 16px 0 12px 17px; border-bottom: 1px solid var(--border); }
        .sb-brand { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; color: inherit; }
        .sb-wordmark { font-size: 24px; font-weight: 600; font-style: italic; letter-spacing: 0.01em; color: var(--accent-text); }
        .sb-head-meta { display: flex; align-items: center; gap: 10px; padding-right: 14px; height: 18px; }

        .sb-nav { flex: 1; padding: 8px 0; overflow-y: auto; overflow-x: hidden; }
        .sb-nav::-webkit-scrollbar { width: 0; }
        .sb-group { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
        .sb-section { font-size: 9px; letter-spacing: 0.12em; color: var(--text-light); padding: 0 17px; margin-bottom: 5px; min-height: 11px; }

        .sb-item {
          position: relative; width: 100%; display: flex; align-items: center; gap: 14px;
          padding: 10px 17px 10px 23px; border: none; background: transparent; cursor: pointer;
          color: var(--text-muted); font-family: var(--font-body); font-size: 13px; font-weight: 500;
          text-align: left; text-decoration: none; transition: background var(--t-fast), color var(--t-fast);
        }
        .sb-item:hover { background: var(--accent); color: #0d0d0d; }
        .sb-item:hover .sb-icon { color: #0d0d0d; }
        .sb-item-active { color: var(--accent-text); font-weight: 700; background: var(--accent-light); }
        .sb-active-bar { position: absolute; left: 0; top: 7px; bottom: 7px; width: 3px; background: var(--accent); }
        .sb-icon { width: 18px; display: inline-flex; justify-content: center; position: relative; flex-shrink: 0; }
        .sb-count { margin-left: auto; background: var(--danger); color: #fff; border-radius: 100px; padding: 1px 6px; font-size: 10px; font-weight: 700; }

        .sb-tree {
          display: flex; align-items: center; gap: 13px; margin: 0; padding: 12px 14px 12px 14px;
          background: transparent; border: none; border-top: 1px solid var(--border);
          cursor: pointer; text-align: left; transition: background var(--t-fast);
        }
        .sb-tree:hover { background: var(--bg-muted); }
        .sb-tree-mark {
          width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          background: var(--accent); color: #0d0d0d; font-family: var(--font-display); font-weight: 600; font-size: 20px;
          border: 1px solid var(--accent);
        }
        .sb-tree-body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .sb-tree-row { display: flex; align-items: center; gap: 6px; }
        .sb-tree-name { font-size: 13px; font-weight: 700; color: var(--accent-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .sb-tree-meta { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-top: 2px; }
        .sb-role { margin-top: 5px; font-family: var(--font-mono); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; align-self: flex-start; border: 1.5px solid currentColor; padding: 1px 6px; }
        .sb-pending { min-width: 18px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--danger); color: #fff; font-family: var(--font-mono); font-size: 10px; font-weight: 700; border-radius: 100px; flex-shrink: 0; }

        .sb-account { padding: 8px 10px 10px; border-top: 1px solid var(--border); }
        .sb-account-row { display: flex; align-items: center; gap: 8px; }
        .sb-account-btn { flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px; background: none; border: none; padding: 4px; cursor: pointer; text-align: left; }
        .sb-account-btn:hover { background: var(--bg-muted); }
        .sb-avatar { width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--accent); color: #0d0d0d; font-size: 13px; font-weight: 700; border: var(--bw) solid var(--border); }
        .sb-account-id { display: flex; flex-direction: column; min-width: 0; }
        .sb-account-name { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-account-email { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-logout { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
        .sb-logout:hover { background: var(--bg-muted); color: var(--danger); }
        .sb-resync { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin-top: 5px; padding: 4px; background: none; border: none; cursor: pointer; color: var(--text-light); font-family: var(--font-mono); font-size: 10px; }
        .sb-foot-link { padding-top: 8px; padding-bottom: 8px; font-size: 12px; }
        .sb-foot-link:hover { background: var(--bg-muted); color: var(--accent-text); }

        @media (max-width: 768px) {
          .sidebar { width: 0; }
          .sidebar-panel { position: fixed; width: 248px; transform: translateX(-100%); transition: transform 0.3s ease; }
          .sidebar.sidebar-open .sidebar-panel { transform: translateX(0); box-shadow: var(--shadow-lg); }
          /* drawer is always "expanded": reveal labels */
          .sidebar .sb-label { opacity: 1; }
        }
      `}</style>
    </aside>
  );
}
