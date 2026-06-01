'use client';
import { FamilyTree, ViewMode } from '@/types';

const NAV_ITEMS: { view: ViewMode; icon: string; label: string }[] = [
  { view: 'tree',       icon: '🌳', label: 'Arbre' },
  { view: 'list',       icon: '👥', label: 'Personnes' },
  { view: 'timeline',   icon: '📅', label: 'Chronologie' },
  { view: 'map',        icon: '🗺', label: 'Carte' },
  { view: 'gallery',    icon: '📸', label: 'Galerie' },
  { view: 'birthdays',  icon: '🎂', label: 'Anniversaires' },
  { view: 'ancestors',  icon: '🔍', label: 'Exploration' },
  { view: 'statistics', icon: '📊', label: 'Statistiques' },
  { view: 'settings',   icon: '⚙️', label: 'Paramètres' },
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
}

export default function Sidebar({ activeView, onViewChange, activeTree, trees, onShowTreeSelector, onAddPerson, onShowImportExport, onPrint, onShare, onPresent, birthdayAlertCount = 0, dark, onToggleDark, isOpen, onClose }: Props) {
  return (
    <aside style={{ width: '224px', flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 50 }}
      className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
    >
      {/* Logo + dark toggle */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="serif" style={{ fontSize: '1.45rem', color: 'var(--accent)' }}>🌿 Suimini</div>
          <div style={{ fontSize: '10px', color: 'var(--text-light)', letterSpacing: '1px', textTransform: 'uppercase' }}>Arbre Généalogique</div>
        </div>
        <button
          onClick={onToggleDark}
          className="btn btn-ghost btn-sm"
          title={dark ? 'Mode clair' : 'Mode sombre'}
          style={{ padding: '4px 6px', fontSize: '16px' }}
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Active tree selector */}
      <button onClick={onShowTreeSelector}
        style={{ margin: '10px 12px', padding: '10px 12px', background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ fontSize: '10px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Arbre actif</div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
            {activeTree?.name || 'Aucun arbre'}
          </span>
          <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
        </div>
        {activeTree && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {activeTree.persons.length} personnes · {activeTree.relationships.length} liens
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 8px 4px', fontWeight: '700' }}>Vues</div>
        {NAV_ITEMS.map(item => {
          const showBadge = item.view === 'birthdays' && birthdayAlertCount > 0;
          return (
            <button key={item.view}
              onClick={() => { onViewChange(item.view); onClose(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                padding: '8px 11px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)', marginBottom: '2px',
                background: activeView === item.view ? 'var(--accent-light)' : 'transparent',
                color: activeView === item.view ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'Lato, sans-serif', fontSize: '13px',
                fontWeight: activeView === item.view ? '700' : '400',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (activeView !== item.view) e.currentTarget.style.background = 'var(--bg-muted)'; }}
              onMouseLeave={e => { if (activeView !== item.view) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '15px', width: '18px', textAlign: 'center', position: 'relative' }}>
                {item.icon}
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
      </nav>

      {/* Actions */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
        <button onClick={onAddPerson} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '6px' }}>
          ＋ Ajouter une personne
        </button>
        <button onClick={onPresent} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: '6px' }}>
          🎬 Mode présentation
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '5px' }}>
          <button onClick={onShare} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
            🔗 Partager
          </button>
          <button onClick={onShowImportExport} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
            📁 Import/Export
          </button>
        </div>
        <button onClick={onPrint} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
          🖨 Imprimer
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>
          {trees.length} arbre{trees.length > 1 ? 's' : ''} · Suimini v1.3
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform 0.3s ease; }
          .sidebar.sidebar-open { transform: translateX(0); box-shadow: var(--shadow-lg); }
        }
      `}</style>
    </aside>
  );
}
