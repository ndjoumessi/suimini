'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '../LanguageSwitcher';
import { countPendingSuggestions } from '@/lib/collaboration';
import { relativeSyncParts } from '@/lib/relativeTime';
import { FamilyTree, ViewMode } from '@/types';
import {
  Home, TreePine, Users, Calendar, Map as MapIcon, Images, BookOpen, Cake, Search, BarChart2, Settings,
  ChevronRight, LogOut, LogIn, Shield, ArrowLeft, RefreshCw,
  Plus, Share2, Download, Printer,
} from 'lucide-react';
import { BrandMark } from '../Brand';

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
// Two clear sub-groups: VUE (the core surfaces) and EXPLORER (the secondary
// lenses). Settings + Admin live in their own quiet "Gérer" group below.
const NAV_GROUPS: { labelKey: string; items: NavItem[] }[] = [
  { labelKey: 'sectionView', items: [
    { view: 'dashboard', Icon: Home, navKey: 'home' },
    { view: 'tree', Icon: TreePine, navKey: 'tree' },
    { view: 'list', Icon: Users, navKey: 'persons' },
    { view: 'map', Icon: MapIcon, navKey: 'map' },
  ] },
  { labelKey: 'sectionExplore', items: [
    { view: 'timeline', Icon: Calendar, navKey: 'timeline' },
    { view: 'journal', Icon: BookOpen, navKey: 'journal' },
    { view: 'birthdays', Icon: Cake, navKey: 'birthdays' },
    { view: 'gallery', Icon: Images, navKey: 'gallery' },
    { view: 'ancestors', Icon: Search, navKey: 'exploration' },
    { view: 'statistics', Icon: BarChart2, navKey: 'statistics' },
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
  // Optional quick-actions (rendered when provided + canEdit). No-op if absent,
  // so the sidebar degrades gracefully on read-only / public surfaces.
  onAddPerson?: () => void;
  onShare?: () => void;
  onImport?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
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

  // Add + Import mutate the tree → edit-gated. Share / Print / Export are
  // read-safe and stay available to viewers (they previously lived in the header).
  const canAdd = canEdit && !!onAddPerson;
  const canImport = canEdit && !!onImport;
  const showActions = canAdd || canImport || onShare || onPrint || onExportPdf;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label={ts('navAria')}>
      <div className="sidebar-panel">
        <div className="sb-top">
        {/* Header — logo + wordmark + tagline */}
        <div className="sb-head">
          <Link href="/" aria-label={ts('backToSiteAria')} title={ts('backToSiteTitle')} className="sb-brand">
            <span className="sb-logo" aria-hidden="true">
              <BrandMark size={28} color="#0d0d0d" accent="#0d0d0d" surface="var(--accent)" />
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
        </div>{/* /sb-top — fixed header + active tree */}

        {/* Navigation — the only scrollable zone (header & footer stay fixed) */}
        <nav className="sb-nav" aria-label={ts('navAria')}>
          {NAV_GROUPS.map(group => (
            <div key={group.labelKey} className="sb-group">
              <div className="sb-section">{ts(group.labelKey)}</div>
              {group.items.map(navItem)}
            </div>
          ))}
          {/* Gérer — settings (+ admin) */}
          <div className="sb-group">
            <div className="sb-section">{ts('sectionManage')}</div>
            <button
              onClick={() => { onViewChange('settings'); onClose(); }}
              aria-current={activeView === 'settings' ? 'page' : undefined}
              aria-label={t('settings')}
              className={`sb-item ${activeView === 'settings' ? 'sb-item-active' : ''}`}
            >
              {activeView === 'settings' && <span aria-hidden="true" className="sb-active-bar" />}
              <span className="sb-icon"><Settings size={16} aria-hidden="true" /></span>
              <span className="sb-label">{t('settings')}</span>
            </button>
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
          </div>
        </nav>

        <div className="sb-foot">
        {/* Quick actions */}
        {showActions && (
          <div className="sb-actions">
            {canAdd && onAddPerson && (
              <button className="sb-add" onClick={() => { onAddPerson(); onClose(); }} title={ts('addPerson')} aria-label={ts('addPerson')}>
                <Plus size={15} aria-hidden="true" /> {ts('addPersonShort')}
              </button>
            )}
            <div className="sb-action-grid">
              {onShare && <button className="sb-chip" onClick={() => { onShare(); onClose(); }} aria-label={ts('share')} title={ts('share')}><Share2 size={16} aria-hidden="true" /></button>}
              {canImport && onImport && <button className="sb-chip" onClick={() => { onImport(); onClose(); }} aria-label={ts('import')} title={ts('import')}><Download size={16} aria-hidden="true" /></button>}
              {onPrint && <button className="sb-chip" onClick={() => { onPrint(); onClose(); }} aria-label={ts('print')} title={ts('print')}><Printer size={16} aria-hidden="true" /></button>}
              {onExportPdf && <button className="sb-chip" onClick={() => { onExportPdf(); onClose(); }} aria-label={ts('export')} title={ts('export')}><BookOpen size={16} aria-hidden="true" /></button>}
            </div>
          </div>
        )}

        {/* Account footer — compact (≤100px): account line · sync line · back link */}
        <div className="sb-account">
          {userEmail ? (
            <>
              {/* account: avatar · name · email · logout — one line */}
              <div className="sb-acct">
                <button onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profil'; }}
                  aria-label={ts('myProfile')} title={ts('myProfile')} className="sb-acct-main">
                  <span className="sb-avatar mono">{initials(displayName, userEmail)}</span>
                  <span className="sb-acct-name">{truncate(displayName || userEmail.split('@')[0], 16)}</span>
                  <span className="sb-acct-email">{truncate(userEmail, 22)}</span>
                </button>
                <button onClick={onSignOut} aria-label={ts('signOut')} title={ts('signOut')} className="sb-logout"><LogOut size={14} /></button>
              </div>

              {/* sync: status · last-sync · presence — one line (clickable to resync) */}
              {cloud && !isDemo && (syncStatus !== 'idle' || lastSyncAt != null || presenceCount > 1) && (() => {
                const word = syncStatus === 'syncing' ? ts('syncSyncing')
                  : syncStatus === 'error' ? ts('syncError')
                  : syncStatus === 'offline' ? ts('syncOffline')
                  : syncStatus === 'saved' ? ts('syncSaved') : null;
                const wordClass = syncStatus === 'syncing' ? 'sb-sync-busy'
                  : (syncStatus === 'error' || syncStatus === 'offline') ? 'sb-sync-bad' : 'sb-sync-ok';
                let rel: string | null = null;
                if (lastSyncAt != null) { const { key, count } = relativeSyncParts(lastSyncAt); rel = count != null ? tSync(key, { count }) : tSync(key); }
                const inner = (
                  <>
                    <RefreshCw size={10} aria-hidden="true" className="sb-sync-ico" style={{ animation: syncStatus === 'syncing' ? 'spin 0.8s linear infinite' : undefined }} />
                    {word && <span className={`sb-sync-word ${wordClass}`}>{word}</span>}
                    {rel && <span className="sb-sync-dim">· {rel}</span>}
                    {presenceCount > 1 && <span className="sb-sync-dim sb-sync-pres">· <Users size={9} aria-hidden="true" /> {presenceCount}</span>}
                  </>
                );
                return onResync
                  ? <button onClick={() => onResync()} disabled={syncStatus === 'syncing'} title={tSync('resync')} className="sb-syncline">{inner}</button>
                  : <div className="sb-syncline">{inner}</div>;
              })()}

              {isDemo && <div className="sb-syncline"><span className="sb-demo">{ts('demoBadge')}</span></div>}
            </>
          ) : (
            <button onClick={onSignIn} className="sb-item" aria-label={ts('signIn')} title={ts('signIn')}>
              <span className="sb-icon"><LogIn size={16} /></span>
              <span className="sb-label">{ts('signIn')}</span>
            </button>
          )}
          {/* back link — discreet, no uppercase */}
          <Link href="/" className="sb-foot-link" onClick={onClose} aria-label={ts('backToSite')} title={ts('backToSite')}>
            <ArrowLeft size={10} aria-hidden="true" /> {ts('backToSite')}
          </Link>
        </div>
        </div>{/* /sb-foot — fixed actions + account */}
      </div>

      <style>{`
        /* Compact 200px (was 240) gives the content ~40px back on every page.
           The shell is flex (.sidebar flex-shrink:0 + main flex:1), so narrowing
           here widens the canvas automatically — no overlap is possible. */
        .sidebar { width: 200px; flex-shrink: 0; position: relative; z-index: var(--z-sticky); }
        .sidebar-panel {
          position: absolute; inset: 0; width: 200px;
          background: var(--bg); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }
        /* Standard desktop: drop to 180px so mid-size laptops keep more canvas. */
        @media (min-width: 769px) and (max-width: 1200px) {
          .sidebar, .sidebar-panel { width: 180px; }
          .sb-item { font-size: 13px; gap: 10px; padding: 4px 14px; }
          .sb-head, .sb-tree { padding-left: 12px; padding-right: 12px; }
          .sb-section { padding-left: 14px; }
        }

        /* Short viewports: compact items (30px / 11px) so all 11 nav items + footer
           fit without the scroll cutting off « Statistiques ». The nav still scrolls
           as a safety net. >= 800px keeps the comfortable 34px / 13px. */
        @media (max-height: 799px) {
          .sb-item { min-height: 30px; font-size: 11px; padding: 3px 16px; gap: 10px; }
          .sb-icon { width: 15px; }
          .sb-section { font-size: 7.5px; padding-top: 1px; padding-bottom: 1px; }
          .sb-group { padding: 1px 0; }
          .sb-add { min-height: 30px; font-size: 11px; }
          .sb-chip { height: 24px; }
          .sb-head { padding-top: 10px; padding-bottom: 9px; }
          .sb-tree { padding-top: 8px; padding-bottom: 8px; }
        }

        /* Header */
        .sb-head { display: flex; align-items: center; gap: 8px; padding: 13px 12px 11px; border-bottom: 1px solid var(--accent-light); }
        .sb-brand { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; color: inherit; flex: 1; min-width: 0; }
        .sb-logo { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; }
        .sb-brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.05; }
        .sb-wordmark { font-size: 14px; font-weight: 600; font-style: italic; letter-spacing: 0.01em; color: var(--ink); white-space: nowrap; }
        .sb-tagline { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.13em; text-transform: uppercase; color: #a98f4e; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Active tree block */
        .sb-tree {
          display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 10px 14px;
          background: var(--bg-card); border: none; border-bottom: 1px solid var(--border);
          cursor: pointer; text-align: left; transition: background var(--t-fast);
        }
        .sb-tree:hover { background: var(--bg-muted); }
        .sb-tree-head { display: flex; align-items: center; gap: 6px; }
        .sb-tree-eyebrow { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); flex: 1; }
        .sb-tree-chev { color: var(--text-light); flex-shrink: 0; }
        .sb-tree-name { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-tree-meta { font-family: var(--font-mono); font-size: 10px; color: var(--accent-text); opacity: 0.85; }
        .sb-tree-badge { align-self: flex-start; margin-top: 5px; font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 7px; border: 1px solid currentColor; }
        .sb-badge-owner { color: var(--accent-text); }
        .sb-badge-guest { color: var(--text-muted); }
        .sb-pending { min-width: 18px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--danger); color: #fff; font-family: var(--font-mono); font-size: 10px; font-weight: 700; flex-shrink: 0; }

        /* Layout: fixed top + fixed footer, only the nav scrolls */
        .sb-top { flex-shrink: 0; }
        .sb-foot { flex-shrink: 0; }

        /* Navigation — the single scrollable zone, with a VISIBLE thin scrollbar
           so overflow is never silent (the old hidden scrollbar made deep items
           look like they had disappeared on short viewports). */
        .sb-nav { flex: 1 1 auto; min-height: 0; padding: 4px 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
        .sb-nav::-webkit-scrollbar { width: 5px; }
        .sb-nav::-webkit-scrollbar-thumb { background: var(--border-strong); }
        .sb-nav::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        .sb-group { padding: 2px 0; }
        .sb-group + .sb-group { border-top: 1px solid var(--border); }
        .sb-section { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: #a98f4e; padding: 2px 16px 2px; }
        .sb-item {
          position: relative; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 34px;
          padding: 4px 16px; border: none; background: transparent; cursor: pointer; line-height: 1.3;
          color: var(--text-muted); font-family: var(--font-body); font-size: 13px; font-weight: 500;
          text-align: left; text-decoration: none; transition: background var(--t-fast), color var(--t-fast);
        }
        .sb-item:hover { background: #1a1a24; color: var(--ink); }
        .sb-item:hover .sb-icon { color: var(--accent-text); }
        .sb-item-active { color: var(--accent-text); font-weight: 700; background: var(--bg-card); }
        .sb-item-active .sb-icon { color: var(--accent); }
        .sb-active-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
        .sb-icon { width: 16px; display: inline-flex; justify-content: center; position: relative; flex-shrink: 0; color: var(--accent-text); transition: color var(--t-fast); }
        .sb-count { margin-left: auto; background: var(--danger); color: #fff; padding: 1px 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 700; }

        /* Quick actions */
        .sb-actions { padding: 9px 12px 8px; border-top: 1px solid var(--border); }
        .sb-add {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: var(--accent); color: #0d0d0d; border: 1px solid var(--accent); cursor: pointer;
          font-family: var(--font-body); font-size: 12px; font-weight: 700; padding: 0 12px; min-height: 34px;
          white-space: nowrap; line-height: 1;
          transition: background var(--t-fast), box-shadow var(--t-fast);
        }
        .sb-add:hover { background: var(--accent-hover); box-shadow: var(--shadow-accent); }
        /* Icon-only action row — compact 32px squares, no labels (tooltips carry
           the names). Saves the vertical space the stacked icon+label grid used. */
        .sb-action-grid { display: flex; gap: 6px; margin-top: 6px; }
        .sb-chip {
          flex: 1; height: 26px; display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;
          transition: border-color var(--t-fast), color var(--t-fast), background var(--t-fast);
        }
        .sb-chip:hover { border-color: var(--accent); color: var(--accent-text); background: var(--accent-light); }
        .sb-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* Account footer — compact (≤100px): account 36 · sync 22 · back 24 */
        .sb-account { padding: 8px 10px 9px; border-top: 1px solid #2D2D3A; }
        .sb-acct { display: flex; align-items: center; gap: 8px; height: 36px; }
        .sb-acct-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: none; border: none; padding: 3px; cursor: pointer; text-align: left; transition: background var(--t-fast); }
        .sb-acct-main:hover { background: var(--bg-card); }
        .sb-avatar { width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--accent); color: #0d0d0d; font-family: var(--font-display); font-size: 12px; font-weight: 700; }
        .sb-acct-name { flex-shrink: 0; max-width: 80px; font-family: var(--font-body); font-size: 12px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-acct-email { min-width: 0; max-width: 100px; font-family: var(--font-mono); font-size: 10px; color: #a98f4e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-logout { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex-shrink: 0; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
        .sb-logout:hover { background: var(--bg-card); color: var(--danger); }
        /* sync line — one row, everything inline */
        .sb-syncline { display: flex; align-items: center; gap: 5px; height: 22px; width: 100%; padding: 0 3px; background: none; border: none; font-family: var(--font-mono); font-size: 9px; color: #a98f4e; overflow: hidden; }
        button.sb-syncline { cursor: pointer; transition: opacity var(--t-fast); }
        button.sb-syncline:hover:not(:disabled) { opacity: 0.8; }
        button.sb-syncline:disabled { cursor: default; }
        .sb-sync-ico { flex-shrink: 0; color: #a98f4e; }
        .sb-sync-word { font-weight: 700; flex-shrink: 0; }
        .sb-sync-ok { color: #5B8A6E; }
        .sb-sync-busy { color: #c98a3a; }
        .sb-sync-bad { color: var(--danger); }
        .sb-sync-dim { color: #a98f4e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-sync-pres { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }
        .sb-demo { font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-text); }
        /* back link — discreet, lowercase */
        .sb-foot-link { display: flex; align-items: center; justify-content: center; gap: 5px; height: 24px; margin-top: 2px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.04em; color: var(--text-muted); text-decoration: none; transition: color var(--t-fast); }
        .sb-foot-link:hover { color: var(--accent-text); }

        @media (max-width: 768px) {
          .sidebar { width: 0; }
          /* The whole drawer scrolls on mobile (no fixed-height children starving the
             nav). Nav takes its natural height so EVERY item is reachable. */
          .sidebar-panel { position: fixed; width: 248px; transform: translateX(-100%); transition: transform 0.3s ease; overflow-y: auto; -webkit-overflow-scrolling: touch; }
          .sidebar.sidebar-open .sidebar-panel { transform: translateX(0); box-shadow: var(--shadow-lg); }
          .sb-nav { flex: 0 0 auto; overflow: visible; }
          /* Comfortable touch targets in the mobile drawer (≥44px). */
          .sb-item { min-height: 44px; }
        }
      `}</style>
    </aside>
  );
}
