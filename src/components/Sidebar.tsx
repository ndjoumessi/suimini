'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { countPendingSuggestions } from '@/lib/collaboration';
import { relativeSyncParts } from '@/lib/relativeTime';
import { FamilyTree, ViewMode } from '@/types';
import {
  Home, TreePine, Users, Calendar, Map as MapIcon, Images, BookOpen, Cake, Search, BarChart2, Settings,
  ChevronRight, LogOut, LogIn, Check, CloudOff, Shield, ArrowLeft, RefreshCw,
  Plus, Share2, Download, Printer,
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

/** Generation count for the active tree (depth of the parent DAG + 1). Cheap O(n)
 *  pass over `parent` relationships; cycle-guarded so malformed data can't loop. */
function countGenerations(tree: FamilyTree): number {
  if (!tree.persons.length) return 0;
  const childToParents = new Map<string, string[]>();
  for (const r of tree.relationships) {
    if (r.type !== 'parent') continue;
    const arr = childToParents.get(r.person2Id) || [];
    arr.push(r.person1Id);
    childToParents.set(r.person2Id, arr);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const parents = childToParents.get(id) || [];
    const d = parents.length ? Math.max(...parents.map(depthOf)) + 1 : 0;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  let max = 0;
  for (const p of tree.persons) max = Math.max(max, depthOf(p.id));
  return max + 1;
}

import type { LucideIcon } from 'lucide-react';

// `navKey` indexes into the `nav` message namespace (see messages/*.json).
interface NavItem { view: ViewMode; Icon: LucideIcon; navKey: string }
const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', Icon: Home, navKey: 'home' },
  { view: 'tree', Icon: TreePine, navKey: 'tree' },
  { view: 'list', Icon: Users, navKey: 'persons' },
  { view: 'map', Icon: MapIcon, navKey: 'map' },
  { view: 'timeline', Icon: Calendar, navKey: 'timeline' },
  { view: 'journal', Icon: BookOpen, navKey: 'journal' },
  { view: 'birthdays', Icon: Cake, navKey: 'birthdays' },
  { view: 'gallery', Icon: Images, navKey: 'gallery' },
  { view: 'ancestors', Icon: Search, navKey: 'exploration' },
  { view: 'statistics', Icon: BarChart2, navKey: 'statistics' },
  { view: 'settings', Icon: Settings, navKey: 'settings' },
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
  // Optional quick-actions (rendered when provided + canEdit). No-op if absent,
  // so the sidebar degrades gracefully on read-only / public surfaces.
  onAddPerson?: () => void;
  onShare?: () => void;
  onImport?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
}

function SyncIndicator({ status }: { status: 'idle' | 'saved' | 'syncing' | 'offline' | 'error' }) {
  const ts = useTranslations('sidebar');
  if (status === 'syncing') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)' }}><span className="spinner" style={{ width: 11, height: 11 }} /> {ts('syncSyncing')}</span>;
  if (status === 'error') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}><CloudOff size={12} /> {ts('syncError')}</span>;
  if (status === 'offline') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}><CloudOff size={12} /> {ts('syncOffline')}</span>;
  if (status === 'saved') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}><Check size={12} /> {ts('syncSaved')}</span>;
  return null;
}

export default function Sidebar({ activeView, onViewChange, activeTree, trees, onShowTreeSelector, canEdit = true, userRole, birthdayAlertCount = 0, isOpen, onClose, userEmail, displayName, isDemo, cloud, syncStatus = 'idle', lastSyncAt, onResync, presenceCount = 0, onSignIn, onSignOut, isAdmin = false, unreadCount = 0, onAddPerson, onShare, onImport, onPrint, onExportPdf }: Props) {
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

  const generations = activeTree ? countGenerations(activeTree) : 0;
  // Ownership label: "Propriétaire" when owner/admin, else "Invité".
  const ownershipKey = userRole === 'owner' || userRole === 'admin' ? 'owner' : 'guest';

  const navItem = (item: NavItem) => {
    const active = activeView === item.view;
    const badge = item.view === 'birthdays' ? birthdayAlertCount : 0;
    const Icon = item.Icon;
    return (
      <button key={item.view}
        onClick={() => { onViewChange(item.view); onClose(); }}
        aria-current={active ? 'page' : undefined}
        aria-label={t(item.navKey)}
        className={`sb-item ${active ? 'sb-item-active' : ''}`}
      >
        {active && <span aria-hidden="true" className="sb-active-bar" />}
        <span className="sb-icon">
          <Icon size={16} aria-hidden="true" />
          {badge > 0 && <span className="birthday-pulse-dot" />}
        </span>
        <span className="sb-label">{t(item.navKey)}</span>
        {badge > 0 && <span className="birthday-badge sb-count">{badge}</span>}
      </button>
    );
  };

  const showActions = canEdit && (onAddPerson || onShare || onImport || onPrint || onExportPdf);

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label={ts('navAria')}>
      <div className="sidebar-panel">
        {/* Header — logo + wordmark + tagline */}
        <div className="sb-head">
          <Link href="/" aria-label={ts('backToSiteAria')} title={ts('backToSiteTitle')} className="sb-brand">
            <span className="sb-logo" aria-hidden="true">
              <BrandMark size={32} color="#0d0d0d" accent="#0d0d0d" surface="var(--accent)" />
            </span>
            <span className="sb-brand-text">
              <span className="sb-wordmark serif">Suimini</span>
              <span className="sb-tagline">{ts('tagline')}</span>
            </span>
          </Link>
          <LanguageSwitcher tone="app" />
        </div>

        {/* Active tree */}
        <button onClick={onShowTreeSelector} aria-label={ts('changeTreeAria')} className="sb-tree">
          <span className="sb-tree-head">
            <span className="sb-tree-eyebrow">{ts('activeTreeLabel')}</span>
            {pendingSuggestions > 0 && <span className="sb-pending" title={ts('pendingSuggestions', { count: pendingSuggestions })}>{pendingSuggestions}</span>}
            <ChevronRight size={14} className="sb-tree-chev" aria-hidden="true" />
          </span>
          <span className="sb-tree-name">{activeTree?.name || ts('noTree')}</span>
          {activeTree && (
            <span className="sb-tree-meta">
              {ts('treeStats', { persons: activeTree.persons.length, generations })}
            </span>
          )}
          {activeTree && (
            <span className={`sb-tree-badge ${ownershipKey === 'owner' ? 'sb-badge-owner' : 'sb-badge-guest'}`}>
              {ts(ownershipKey === 'owner' ? 'badgeOwner' : 'badgeGuest')}
            </span>
          )}
        </button>

        {/* Navigation */}
        <nav className="sb-nav" aria-label={ts('navAria')}>
          {NAV_ITEMS.map(navItem)}
          {isAdmin && (
            <button
              onClick={() => { onViewChange('admin'); onClose(); }}
              aria-current={activeView === 'admin' ? 'page' : undefined}
              aria-label={t('admin')}
              className={`sb-item ${activeView === 'admin' ? 'sb-item-active' : ''}`}
            >
              {activeView === 'admin' && <span aria-hidden="true" className="sb-active-bar" />}
              <span className="sb-icon"><Shield size={16} aria-hidden="true" /></span>
              <span className="sb-label">{t('admin')}</span>
              {unreadCount > 0 && <span className="sb-count">{unreadCount}</span>}
            </button>
          )}
        </nav>

        {/* Quick actions */}
        {showActions && (
          <div className="sb-actions">
            {onAddPerson && (
              <button className="sb-add" onClick={() => { onAddPerson(); onClose(); }}>
                <Plus size={15} aria-hidden="true" /> {ts('addPerson')}
              </button>
            )}
            <div className="sb-action-grid">
              {onShare && <button className="sb-chip" onClick={() => { onShare(); onClose(); }}><Share2 size={13} aria-hidden="true" /> {ts('share')}</button>}
              {onImport && <button className="sb-chip" onClick={() => { onImport(); onClose(); }}><Download size={13} aria-hidden="true" /> {ts('import')}</button>}
              {onPrint && <button className="sb-chip" onClick={() => { onPrint(); onClose(); }}><Printer size={13} aria-hidden="true" /> {ts('print')}</button>}
              {onExportPdf && <button className="sb-chip" onClick={() => { onExportPdf(); onClose(); }}><BookOpen size={13} aria-hidden="true" /> {ts('export')}</button>}
            </div>
          </div>
        )}

        {/* Account footer */}
        <div className="sb-account">
          {userEmail ? (
            <>
              <div className="sb-account-row">
                <button onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profil'; }}
                  aria-label={ts('myProfile')} title={ts('myProfile')} className="sb-account-btn">
                  <span className="sb-avatar mono">{initials(displayName, userEmail)}</span>
                  <span className="sb-account-id">
                    <span className="sb-account-name">{truncate(displayName || userEmail.split('@')[0], 18)}</span>
                    <span className="sb-account-email">{truncate(userEmail, 24)}</span>
                  </span>
                </button>
                <button onClick={onSignOut} aria-label={ts('signOut')} title={ts('signOut')} className="sb-logout"><LogOut size={16} /></button>
              </div>
              {cloud && syncStatus !== 'idle' && (
                <div style={{ fontSize: '10px', marginTop: '5px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}><SyncIndicator status={syncStatus} /></div>
              )}
              {cloud && onResync && lastSyncAt != null && (() => {
                const { key, count } = relativeSyncParts(lastSyncAt);
                const time = count != null ? tSync(key, { count }) : tSync(key);
                return (
                  <button onClick={() => onResync()} disabled={syncStatus === 'syncing'} title={tSync('resync')} className="sb-resync">
                    <RefreshCw size={10} aria-hidden="true" style={{ animation: syncStatus === 'syncing' ? 'spin 0.8s linear infinite' : undefined }} />
                    {tSync('lastSync', { time })}
                  </button>
                );
              })()}
              {presenceCount > 1 && (
                <div style={{ fontSize: '10px', color: 'var(--accent-text)', textAlign: 'center', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                  <Users size={11} /> {ts('presence', { count: presenceCount })}
                </div>
              )}
              {isDemo && (
                <div style={{ marginTop: '7px', textAlign: 'center' }}>
                  <span className="badge badge-accent" style={{ fontSize: '9px' }}>{ts('demoBadge')}</span>
                </div>
              )}
            </>
          ) : (
            <button onClick={onSignIn} className="sb-item" aria-label={ts('signIn')} title={ts('signIn')}>
              <span className="sb-icon"><LogIn size={16} /></span>
              <span className="sb-label">{ts('signIn')}</span>
            </button>
          )}
          <Link href="/" className="sb-foot-link" onClick={onClose} aria-label={ts('backToSite')} title={ts('backToSite')}>
            <ArrowLeft size={14} aria-hidden="true" /> {ts('backToSite')}
          </Link>
        </div>
      </div>

      <style>{`
        .sidebar { width: 240px; flex-shrink: 0; position: relative; z-index: var(--z-sticky); }
        .sidebar-panel {
          position: absolute; inset: 0; width: 240px;
          background: var(--bg); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }

        /* Header */
        .sb-head { display: flex; align-items: center; gap: 10px; padding: 16px 14px 14px; border-bottom: 1px solid var(--accent-light); }
        .sb-brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: inherit; flex: 1; min-width: 0; }
        .sb-logo { width: 32px; height: 32px; flex-shrink: 0; display: inline-flex; }
        .sb-brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.05; }
        .sb-wordmark { font-size: 22px; font-weight: 600; font-style: italic; letter-spacing: 0.01em; color: var(--accent-text); }
        .sb-tagline { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-light); margin-top: 1px; }

        /* Active tree block */
        .sb-tree {
          display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 13px 14px;
          background: var(--bg-card); border: none; border-bottom: 1px solid var(--border);
          cursor: pointer; text-align: left; transition: background var(--t-fast);
        }
        .sb-tree:hover { background: var(--bg-muted); }
        .sb-tree-head { display: flex; align-items: center; gap: 6px; }
        .sb-tree-eyebrow { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-light); flex: 1; }
        .sb-tree-chev { color: var(--text-light); flex-shrink: 0; }
        .sb-tree-name { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-tree-meta { font-family: var(--font-mono); font-size: 10px; color: var(--accent-text); opacity: 0.85; }
        .sb-tree-badge { align-self: flex-start; margin-top: 5px; font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 7px; border: 1px solid currentColor; }
        .sb-badge-owner { color: var(--accent-text); }
        .sb-badge-guest { color: var(--text-muted); }
        .sb-pending { min-width: 18px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--danger); color: #fff; font-family: var(--font-mono); font-size: 10px; font-weight: 700; flex-shrink: 0; }

        /* Navigation */
        .sb-nav { flex: 1; padding: 8px 0; overflow-y: auto; overflow-x: hidden; }
        .sb-nav::-webkit-scrollbar { width: 0; }
        .sb-item {
          position: relative; width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 9px 16px; border: none; background: transparent; cursor: pointer;
          color: var(--text-muted); font-family: var(--font-display); font-size: 14px; font-weight: 500;
          text-align: left; text-decoration: none; transition: background var(--t-fast), color var(--t-fast);
        }
        .sb-item:hover { background: #161616; color: var(--ink); }
        .sb-item:hover .sb-icon { color: var(--accent-text); }
        .sb-item-active { color: var(--accent-text); font-weight: 700; background: var(--bg-card); }
        .sb-item-active .sb-icon { color: var(--accent); }
        .sb-active-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--accent); }
        .sb-icon { width: 16px; display: inline-flex; justify-content: center; position: relative; flex-shrink: 0; color: var(--accent-text); transition: color var(--t-fast); }
        .sb-count { margin-left: auto; background: var(--danger); color: #fff; padding: 1px 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 700; }

        /* Quick actions */
        .sb-actions { padding: 12px 12px 10px; border-top: 1px solid var(--border); }
        .sb-add {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: var(--accent); color: #0d0d0d; border: 1px solid var(--accent); cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700; padding: 9px 12px;
          transition: background var(--t-fast), box-shadow var(--t-fast);
        }
        .sb-add:hover { background: var(--accent-hover); box-shadow: var(--shadow-accent); }
        .sb-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
        .sb-chip {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          background: transparent; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; padding: 7px 4px;
          transition: border-color var(--t-fast), color var(--t-fast), background var(--t-fast);
        }
        .sb-chip:hover { border-color: var(--accent); color: var(--accent-text); background: var(--accent-light); }

        /* Account footer */
        .sb-account { padding: 10px 12px 12px; border-top: 1px solid var(--border); }
        .sb-account-row { display: flex; align-items: center; gap: 8px; }
        .sb-account-btn { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 4px; cursor: pointer; text-align: left; transition: background var(--t-fast); }
        .sb-account-btn:hover { background: var(--bg-card); }
        .sb-avatar { width: 32px; height: 32px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--accent); color: #0d0d0d; font-family: var(--font-display); font-size: 12px; font-weight: 700; }
        .sb-account-id { display: flex; flex-direction: column; min-width: 0; }
        .sb-account-name { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-account-email { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-logout { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
        .sb-logout:hover { background: var(--bg-card); color: var(--danger); }
        .sb-resync { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin-top: 5px; padding: 4px; background: none; border: none; cursor: pointer; color: var(--text-light); font-family: var(--font-mono); font-size: 10px; }
        .sb-foot-link { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; padding: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light); text-decoration: none; transition: color var(--t-fast), background var(--t-fast); }
        .sb-foot-link:hover { background: var(--bg-card); color: var(--accent-text); }

        @media (max-width: 768px) {
          .sidebar { width: 0; }
          .sidebar-panel { position: fixed; width: 248px; transform: translateX(-100%); transition: transform 0.3s ease; }
          .sidebar.sidebar-open .sidebar-panel { transform: translateX(0); box-shadow: var(--shadow-lg); }
        }
      `}</style>
    </aside>
  );
}
