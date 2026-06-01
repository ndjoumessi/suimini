'use client';
import { useState, useCallback, useEffect } from 'react';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ViewMode, RelationType } from '@/types';
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
import ShareModal from './ShareModal';
import Toast from './Toast';

export default function SuiminiApp() {
  const store = useFamilyStore();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [view, setView] = useState<ViewMode>('tree');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; icon?: string } | null>(null);

  const showToast = useCallback((msg: string, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const handleSelectPerson = useCallback((id: string) => {
    setSelectedPersonId(id);
  }, []);

  if (!store.loaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '8px' }}>🌿 Suimini</div>
          <div style={{ color: 'var(--text-muted)' }}>Chargement...</div>
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
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
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
        onShare={() => setShowShare(true)}
        dark={dark}
        onToggleDark={toggleDark}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div style={{ display: 'none', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', alignItems: 'center', gap: '12px' }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-sm">☰</button>
          <span className="serif" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>🌿 Suimini</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{store.activeTree?.name}</span>
        </div>

        {!store.activeTree ? (
          <EmptyState onCreateTree={() => setShowTreeSelector(true)} />
        ) : (
          <>
            {view === 'tree' && <TreeView tree={store.activeTree} selectedPersonId={selectedPersonId} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} />}
            {view === 'list' && <ListView tree={store.activeTree} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} />}
            {view === 'timeline' && <TimelineView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'gallery' && <GalleryView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'birthdays' && <BirthdaysView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'ancestors' && <AncestorsView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'statistics' && <StatisticsView tree={store.activeTree} />}
          </>
        )}
      </main>

      {/* Modals */}
      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          tree={store.activeTree!}
          onClose={() => setSelectedPersonId(null)}
          onUpdate={(updates) => { store.updatePerson(selectedPerson.id, updates); showToast('Profil mis à jour'); }}
          onDelete={() => { store.deletePerson(selectedPerson.id); setSelectedPersonId(null); showToast('Personne supprimée', '🗑'); }}
          onSelectPerson={handleSelectPerson}
          onAddRelationship={store.addRelationship}
          onDeleteRelationship={store.deleteRelationship}
        />
      )}

      {showAddPerson && store.activeTree && (
        <AddPersonModal
          tree={store.activeTree}
          onClose={() => setShowAddPerson(false)}
          onAdd={(person, relation) => {
            const created = store.addPerson(person);
            if (created && relation) {
              store.addRelationship({
                type: relation.type,
                person1Id: created.id,
                person2Id: relation.personId,
                isActive: true,
              });
            }
            if (created) {
              setSelectedPersonId(created.id);
              showToast(`${created.firstName} ${created.lastName} ajouté(e)${relation ? ' avec relation' : ''}`);
            }
            setShowAddPerson(false);
          }}
        />
      )}

      {showTreeSelector && (
        <TreeSelectorModal
          trees={store.trees}
          activeTreeId={store.activeTreeId}
          onSelect={(id) => { store.switchTree(id); showToast('Arbre changé'); }}
          onCreate={(name, desc) => { store.createTree(name, desc); showToast(`Arbre "${name}" créé 🌳`); }}
          onDelete={(id) => { store.deleteTree(id); showToast('Arbre supprimé', '🗑'); }}
          onClose={() => setShowTreeSelector(false)}
        />
      )}

      {showImportExport && store.activeTree && (
        <ImportExportModal
          tree={store.activeTree}
          onImport={(t) => { store.importTree(t); showToast(`Arbre "${t.name}" importé ✅`); }}
          onClose={() => setShowImportExport(false)}
        />
      )}

      {showPrint && store.activeTree && (
        <PrintModal tree={store.activeTree} onClose={() => setShowPrint(false)} />
      )}

      {showShare && store.activeTree && (
        <ShareModal tree={store.activeTree} onClose={() => setShowShare(false)} />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.msg} icon={toast.icon} />}

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
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
