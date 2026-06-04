'use client';
import { FamilyTree, ViewMode } from '@/types';
import {
  TreePine, Users, Calendar, Map, Images, BookOpen, Cake, Search, BarChart2, Settings,
  Plus, Play, Share2, FolderOpen, Printer, Moon, Sun, ChevronDown, LogOut, LogIn, Cloud,
  Check, CloudOff, Shield,
} from 'lucide-react';
import { BrandLockup } from './Brand';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
import type { LucideIcon } from 'lucide-react';

interface NavItem { view: ViewMode; Icon: LucideIcon; label: string }
const NAV_GROUPS: NavItem[][] = [
  [
    { view: 'tree', Icon: TreePine, label: 'Arbre' },
    { view: 'list', Icon: Users, label: 'Personnes' },
    { view: 'map', Icon: Map, label: 'Carte' },
  ],
  [
    { view: 'timeline', Icon: Calendar, label: 'Chronologie' },
    { view: 'journal', Icon: BookOpen, label: 'Journal' },
    { view: 'birthdays', Icon: Cake, label: 'Anniversaires' },
  ],
  [
    { view: 'gallery', Icon: Images, label: 'Galerie' },
    { view: 'ancestors', Icon: Search, label: 'Exploration' },
    { view: 'statistics', Icon: BarChart2, label: 'Statistiques' },
  ],
  [
    { view: 'settings', Icon: Settings, label: 'Paramètres' },
  ],
];

interface Props {
  activeView: ViewMode;
  onViewChange: (v: ViewMode) => void;
  activeTree: FamilyTree | null;
  trees: FamilyTree[];
  onShowTreeSelector: () => void;
  onAddPerson: () => void;
  onShowImportExport: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  onPresent?: () => void;
  birthdayAlertCount?: number;
  dark: boolean;
  onToggleDark: () => void;
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  displayName?: string | null;
  isDemo?: boolean;
  cloud?: boolean;
  syncStatus?: 'idle' | 'saved' | 'syncing' | 'offline';
  presenceCount?: number;
  onSignIn?: () => void;
  onSignOut?: () => void;
  isAdmin?: boolean;
  unreadCount?: number;
}

function SyncIndicator({ status }: { status: 'idle' | 'saved' | 'syncing' | 'offline' }) {
  if (status === 'syncing') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}><span className="spinner" style={{ width: 11, height: 11 }} /> Synchronisation…</span>;
  if (status === 'offline') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}><CloudOff size={12} /> Hors ligne</span>;
  if (status === 'saved') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}><Check size={12} /> Sauvegardé</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)' }}><Cloud size={12} /> Local</span>;
}

export default function Sidebar({ activeView, onViewChange, activeTree, trees, onShowTreeSelector, onAddPerson, onShowImportExport, onPrint, onShare, onPresent, birthdayAlertCount = 0, dark, onToggleDark, isOpen, onClose, userEmail, displayName, isDemo, cloud, syncStatus = 'idle', presenceCount = 0, onSignIn, onSignOut, isAdmin = false, unreadCount = 0 }: Props) {

  return (
    <aside style={{ width: '232px', flexShrink: 0, background: 'var(--bg-card)', borderRight: 'var(--bw) solid var(--border-strong)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 50 }}
      className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
    >
      {/* Logo + dark toggle */}
      <div style={{ padding: '16px 16px 12px', borderBottom: 'var(--bw) solid var(--border-strong)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <BrandLockup size={26} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" fontSize={20} />
          <div style={{ marginTop: '5px' }}>
          {isDemo
            ? <span className="badge badge-accent" style={{ fontSize: '9px' }}>Mode démo</span>
            : <div className="label" style={{ fontSize: '10px', letterSpacing: '1px' }}>Arbre Généalogique</div>}
          </div>
        </div>
        <button onClick={onToggleDark} className="icon-btn" aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'} title={dark ? 'Mode clair' : 'Mode sombre'}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Active tree selector */}
      <button onClick={onShowTreeSelector}
        aria-label="Changer d'arbre"
        style={{ margin: '10px 12px', padding: '10px 12px', background: 'var(--accent-light)', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', transition: 'box-shadow var(--t-fast), transform var(--t-fast)' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div className="label" style={{ fontSize: '10px', marginBottom: '2px' }}>Arbre actif</div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
            {activeTree?.name || 'Aucun arbre'}
          </span>
          <ChevronDown size={14} style={{ opacity: 0.6 }} />
        </div>
        {activeTree && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {activeTree.persons.length} personnes · {activeTree.relationships.length} liens
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }} aria-label="Navigation principale">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ paddingTop: gi > 0 ? '6px' : 0, marginTop: gi > 0 ? '6px' : 0, borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
            {group.map(item => {
              const active = activeView === item.view;
              const showBadge = item.view === 'birthdays' && birthdayAlertCount > 0;
              return (
                <button key={item.view}
                  onClick={() => { onViewChange(item.view); onClose(); }}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  style={{
                    position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 11px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)', marginBottom: '2px',
                    background: active ? 'var(--accent-light)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: active ? 700 : 400,
                    transition: 'background var(--t-fast), color var(--t-fast)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--interactive)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {active && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: '6px', bottom: '6px', width: '2px', borderRadius: '2px', background: 'var(--accent)' }} />}
                  <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', position: 'relative' }}>
                    <item.Icon size={17} aria-hidden="true" />
                    {showBadge && <span className="birthday-pulse-dot" />}
                  </span>
                  {item.label}
                  {showBadge && (
                    <span className="birthday-badge" style={{ marginLeft: 'auto', background: 'var(--danger)', color: 'white', borderRadius: '100px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>
                      {birthdayAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Admin (visible uniquement pour les admins) */}
        {isAdmin && (() => {
          const active = activeView === 'admin';
          return (
            <div style={{ paddingTop: '6px', marginTop: '6px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { onViewChange('admin'); onClose(); }}
                aria-current={active ? 'page' : undefined}
                aria-label="Admin"
                style={{
                  position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 11px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)', marginBottom: '2px',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: active ? 700 : 400,
                  transition: 'background var(--t-fast), color var(--t-fast)',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--interactive)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {active && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: '6px', bottom: '6px', width: '2px', borderRadius: '2px', background: 'var(--accent)' }} />}
                <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', position: 'relative' }}>
                  <Shield size={17} aria-hidden="true" />
                  {unreadCount > 0 && <span className="birthday-pulse-dot" />}
                </span>
                Admin
                {unreadCount > 0 && (
                  <span className="birthday-badge" style={{ marginLeft: 'auto', background: 'var(--danger)', color: 'white', borderRadius: '100px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}
      </nav>

      {/* Actions */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
        <button onClick={onAddPerson} className="btn btn-primary" style={{ width: '100%', height: '36px', borderRadius: '8px', marginBottom: '6px' }}>
          <Plus size={16} /> Ajouter une personne
        </button>
        <button onClick={onPresent} className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: '6px' }}>
          <Play size={14} /> Mode présentation
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '5px' }}>
          <button onClick={onShare} className="btn btn-secondary btn-sm">
            <Share2 size={14} /> Partager
          </button>
          <button onClick={onShowImportExport} className="btn btn-secondary btn-sm">
            <FolderOpen size={14} /> Import
          </button>
        </div>
        <button onClick={onPrint} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
          <Printer size={14} /> Imprimer
        </button>
      </div>

      {/* Account & sync */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', position: 'relative' }}>
        {userEmail ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px' }}>
              <div className="mono" style={{ width: '36px', height: '36px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0, border: '1.5px solid var(--border-strong)' }}>
                {initials(displayName, userEmail)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{truncate(displayName || userEmail.split('@')[0], 16)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncate(userEmail, 22)}</div>
              </div>
              <button onClick={onSignOut} aria-label="Se déconnecter" title="Se déconnecter" className="sb-logout"><LogOut size={16} /></button>
            </div>
            <div style={{ fontSize: '10px', marginTop: '5px', textAlign: 'center' }}><SyncIndicator status={cloud ? syncStatus : 'idle'} /></div>
            {presenceCount > 1 && (
              <div style={{ fontSize: '10px', color: 'var(--accent)', textAlign: 'center', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Users size={11} /> {presenceCount} connectés sur cet arbre
              </div>
            )}
          </>
        ) : (
          // Demo mode also lands here: the top DemoBanner already shows the demo
          // status + "Quitter la démo", so the sidebar only offers the sign-in CTA.
          <button onClick={onSignIn} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
            <LogIn size={14} /> Se connecter pour sauvegarder
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>
          {trees.length} arbre{trees.length > 1 ? 's' : ''} · Suimini v1.5{userEmail ? '' : ' · invité'}
        </div>
      </div>

      <style>{`
        .sb-logout { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: none; background: transparent; color: var(--text-muted); border-radius: 8px; cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
        .sb-logout:hover { background: var(--bg-muted); color: var(--danger); }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform 0.3s ease; }
          .sidebar.sidebar-open { transform: translateX(0); box-shadow: var(--shadow-lg); }
        }
      `}</style>
    </aside>
  );
}
