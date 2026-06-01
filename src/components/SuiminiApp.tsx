'use client';
import { useState, useCallback } from 'react';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { ViewMode } from '@/types';
import Sidebar from './Sidebar';
import TreeView from './TreeView';
import ListView from './ListView';
import TimelineView from './TimelineView';
import StatisticsView from './StatisticsView';
import GalleryView from './GalleryView';
import BirthdaysView from './BirthdaysView';
import AncestorsView from './AncestorsView';
import PersonModal from './PersonModal';
import AddPersonModal from './AddPersonModal';
import TreeSelectorModal from './TreeSelectorModal';
import ImportExportModal from './ImportExportModal';
import PrintModal from './PrintModal';

export default function SuiminiApp() {
  const store = useFamilyStore();
  const [view, setView] = useState<ViewMode>('tree');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectPerson = useCallback((id: string) => {
    setSelectedPersonId(id);
  }, []);

  if (!store.loaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '8px' }}>🌿 Suimini</div>
          <div style={{ color: 'var(--text-muted)' }}>Chargement de votre arbre...</div>
        </div>
      </div>
    );
  }

  const selectedPerson = selectedPersonId
    ? store.activeTree?.persons.find(p => p.id === selectedPersonId) || null
    : null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          className="mobile-overlay"
        />
      )}

      <Sidebar
        activeView={view}
        onViewChange={setView}
        activeTree={store.activeTree}
        trees={store.trees}
        onShowTreeSelector={() => setShowTreeSelector(true)}
        onAddPerson={() => setShowAddPerson(true)}
        onShowImportExport={() => setShowImportExport(true)}
        onPrint={() => setShowPrint(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div style={{
          display: 'none', padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)', alignItems: 'center', gap: '12px'
        }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-sm">☰</button>
          <span className="serif" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>🌿 Suimini</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            {store.activeTree?.name}
          </span>
        </div>

        {!store.activeTree ? (
          <EmptyState onCreateTree={() => setShowTreeSelector(true)} />
        ) : (
          <>
            {view === 'tree' && (
              <TreeView
                tree={store.activeTree}
                selectedPersonId={selectedPersonId}
                onSelectPerson={handleSelectPerson}
                onAddPerson={() => setShowAddPerson(true)}
              />
            )}
            {view === 'list' && (
              <ListView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
                onAddPerson={() => setShowAddPerson(true)}
              />
            )}
            {view === 'timeline' && (
              <TimelineView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
              />
            )}
            {view === 'gallery' && (
              <GalleryView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
              />
            )}
            {view === 'birthdays' && (
              <BirthdaysView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
              />
            )}
            {view === 'ancestors' && (
              <AncestorsView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
              />
            )}
            {view === 'statistics' && (
              <StatisticsView tree={store.activeTree} />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          tree={store.activeTree!}
          onClose={() => setSelectedPersonId(null)}
          onUpdate={(updates) => store.updatePerson(selectedPerson.id, updates)}
          onDelete={() => { store.deletePerson(selectedPerson.id); setSelectedPersonId(null); }}
          onSelectPerson={handleSelectPerson}
          onAddRelationship={store.addRelationship}
          onDeleteRelationship={store.deleteRelationship}
        />
      )}

      {showAddPerson && (
        <AddPersonModal
          onClose={() => setShowAddPerson(false)}
          onAdd={(person) => {
            const created = store.addPerson(person);
            if (created) setSelectedPersonId(created.id);
            setShowAddPerson(false);
          }}
        />
      )}

      {showTreeSelector && (
        <TreeSelectorModal
          trees={store.trees}
          activeTreeId={store.activeTreeId}
          onSelect={store.switchTree}
          onCreate={store.createTree}
          onDelete={store.deleteTree}
          onClose={() => setShowTreeSelector(false)}
        />
      )}

      {showImportExport && store.activeTree && (
        <ImportExportModal
          tree={store.activeTree}
          onImport={store.importTree}
          onClose={() => setShowImportExport(false)}
        />
      )}

      {showPrint && store.activeTree && (
        <PrintModal
          tree={store.activeTree}
          onClose={() => setShowPrint(false)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ onCreateTree }: { onCreateTree: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '72px' }}>🌳</div>
      <div>
        <h2 style={{ marginBottom: '8px' }}>Commencez votre arbre généalogique</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
          Créez un nouvel arbre ou importez des données GEDCOM pour découvrir et préserver l&apos;histoire de votre famille.
        </p>
      </div>
      <button onClick={onCreateTree} className="btn btn-primary btn-lg">🌱 Créer mon arbre</button>
    </div>
  );
}
