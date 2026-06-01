'use client';
import { FamilyTree, ViewMode } from '@/types';

const NAV_ITEMS: { view: ViewMode; icon: string; label: string }[] = [
  { view: 'tree', icon: '🌳', label: 'Arbre' },
  { view: 'list', icon: '👥', label: 'Personnes' },
  { view: 'timeline', icon: '📅', label: 'Chronologie' },
  { view: 'gallery', icon: '📸', label: 'Galerie' },
  { view: 'birthdays', icon: '🎂', label: 'Anniversaires' },
  { view: 'ancestors', icon: '🔍', label: 'Exploration' },
  { view: 'statistics', icon: '📊', label: 'Statistiques' },
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
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeView, onViewChange, activeTree, trees,
  onShowTreeSelector, onAddPerson, onShowImportExport, onPrint,
  isOpen, onClose
}: Props) {
  return (
    <aside style={{
      width: '220px', flexShrink: 0, background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
      transition: 'transform 0.3s ease', zIndex: 50,
    }} className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>

      {/* Logo */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div className="serif" style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '2px' }}>
          🌿 Suimini
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-light)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Arbre Généalogique
        </div>
      </div>

      {/* Active tree */}
      <button
        onClick={onShowTreeSelector}
        style={{
          margin: '12px', padding: '10px 12px',
          background: 'var(--accent-light)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <div style={{ fontSize: '10px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Arbre actif
        </div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
            {activeTree?.name || 'Aucun arbre'}
          </span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
        </div>
        {activeTree && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {activeTree.persons.length} personnes · {activeTree.relationships.length} liens
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 8px 4px', fontWeight: '700' }}>
          Vues
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            onClick={() => { onViewChange(item.view); onClose(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius)', marginBottom: '2px',
              background: activeView === item.view ? 'var(--accent-light)' : 'transparent',
              color: activeView === item.view ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'Lato, sans-serif', fontSize: '13px',
              fontWeight: activeView === item.view ? '700' : '400',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (activeView !== item.view) e.currentTarget.style.background = 'var(--bg-muted)'; }}
            onMouseLeave={e => { if (activeView !== item.view) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: '15px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Actions */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        <button onClick={onAddPerson} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '5px' }}>
          <span>＋</span> Ajouter
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <button onClick={onShowImportExport} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
            📁 Import/Export
          </button>
          <button onClick={onPrint} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>
          {trees.length} arbre{trees.length > 1 ? 's' : ''} · Suimini v1.1
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); }
          .sidebar.sidebar-open { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
