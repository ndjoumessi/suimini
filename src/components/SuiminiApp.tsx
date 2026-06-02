'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useBirthdayNotifications } from '@/hooks/useBirthdayNotifications';
import { supabase } from '@/lib/supabase';
import { ViewMode } from '@/types';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AuthModal from './AuthModal';
import DemoBanner from './DemoBanner';
import TreeView from './TreeView';
import ListView from './ListView';
import TimelineView from './TimelineView';
import StatisticsView from './StatisticsView';
import GalleryView from './GalleryView';
import JournalView from './JournalView';
import BirthdaysView from './BirthdaysView';
import AncestorsView from './AncestorsView';
import SettingsView from './SettingsView';
import PersonPanel from './PersonPanel';
import HistoryIndicator from './HistoryIndicator';
import CommandPalette from './CommandPalette';
import PresentationMode from './PresentationMode';
import NarrativeModal from './NarrativeModal';
import AddPersonModal from './AddPersonModal';
import TreeSelectorModal from './TreeSelectorModal';
import ImportExportModal from './ImportExportModal';
import PrintModal from './PrintModal';
import ShareModal from './ShareModal';
import ToastStack, { ToastType, ToastItem } from './Toast';
import { Menu, Search, TreePine, Sprout, Cloud } from 'lucide-react';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement de la carte…
    </div>
  ),
});

export default function SuiminiApp() {
  const { user, signOut, isDemo, exitDemo } = useAuth();
  const store = useFamilyStore(user ? { id: user.id, email: user.email } : null);
  const { dark, toggle: toggleDark, mode: themeMode, setMode: setThemeMode } = useDarkMode();
  const { themeId, setTheme, previewTheme, cancelPreview } = useTheme();
  const birthdayAlertCount = useBirthdayNotifications(store.activeTree);

  const [view, setView] = useState<ViewMode>('tree');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import' | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const openAuth = useCallback((tab: 'login' | 'signup' = 'login') => { setAuthTab(tab); setShowAuth(true); }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((msg: string, type: ToastType | string = 'success') => {
    const t: ToastType = (['success', 'error', 'info', 'warning'] as const).includes(type as ToastType) ? type as ToastType : 'info';
    toastCounter.current += 1;
    const id = toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type: t }].slice(-3)); // queue, max 3
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // Surface a failed magic-link exchange + any pending toast (e.g. after password reset).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_error')) {
      showToast('Échec de la connexion. Le lien a peut-être expiré.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
    try {
      const pending = sessionStorage.getItem('suimini_pending_toast');
      if (pending) { showToast(pending, 'success'); sessionStorage.removeItem('suimini_pending_toast'); }
    } catch { /* ignore */ }
  }, [showToast]);

  // Realtime: subscribe to the active tree's persons/relationships + presence of collaborators.
  const activeTreeId = store.activeTree?.id;
  useEffect(() => {
    if (!store.cloud || !supabase || !activeTreeId || !user) return;
    const sb = supabase;
    const reload = () => { store.reloadTreeFromCloud(activeTreeId); showToast('Un collaborateur a modifié cet arbre', 'info'); };
    const channel = sb
      .channel(`tree:${activeTreeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons', filter: `tree_id=eq.${activeTreeId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relationships', filter: `tree_id=eq.${activeTreeId}` }, reload)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') channel.track({ user: user.email || user.id, at: Date.now() });
      });
    return () => { sb.removeChannel(channel); setPresenceCount(1); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.cloud, activeTreeId, user]);

  const handleSelectPerson = useCallback((id: string) => {
    setSelectedPersonId(id);
  }, []);

  // Global keyboard shortcuts: Cmd/Ctrl+K (palette), Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette(p => !p);
        return;
      }
      const target = e.target as HTMLElement | null;
      const editing = !!target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' || target.isContentEditable
      );
      if (mod && e.key.toLowerCase() === 'z' && !editing) {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  if (!store.loaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><TreePine size={30} aria-hidden="true" /> Suimini</div>
          <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
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
        onShowImportExport={() => setImportExportTab('export')}
        onPrint={() => setShowPrint(true)}
        onShare={() => setShowShare(true)}
        onPresent={() => setShowPresentation(true)}
        birthdayAlertCount={birthdayAlertCount}
        dark={dark}
        onToggleDark={toggleDark}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={user?.email || null}
        displayName={(user?.user_metadata?.display_name as string | undefined) || null}
        cloud={store.cloud}
        syncStatus={store.syncStatus}
        presenceCount={store.cloud ? presenceCount : 0}
        onSignIn={() => openAuth('login')}
        isDemo={isDemo}
        onExitDemo={exitDemo}
        onSignOut={async () => { await signOut(); showToast('Déconnecté'); }}
      />

      <main className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        {isDemo && <DemoBanner onCreateAccount={() => openAuth('signup')} onExit={exitDemo} />}
        {/* Mobile header */}
        <div style={{ display: 'none', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', alignItems: 'center', gap: '12px' }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon btn-sm" aria-label="Ouvrir le menu"><Menu size={18} aria-hidden="true" /></button>
          <span className="serif" style={{ fontSize: '1.2rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><TreePine size={18} aria-hidden="true" /> Suimini</span>
          <button onClick={() => setShowPalette(true)} className="btn btn-ghost btn-icon btn-sm" style={{ marginLeft: 'auto' }} aria-label="Rechercher"><Search size={18} aria-hidden="true" /></button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{store.activeTree?.name}</span>
        </div>

        {!store.activeTree ? (
          <EmptyState onCreateTree={() => setShowTreeSelector(true)} />
        ) : (
          <>
            {view === 'tree' && <TreeView tree={store.activeTree} selectedPersonId={selectedPersonId} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} />}
            {view === 'list' && <ListView tree={store.activeTree} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} />}
            {view === 'timeline' && <TimelineView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'map' && <MapView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'gallery' && <GalleryView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'journal' && (
              <JournalView
                tree={store.activeTree}
                onSelectPerson={handleSelectPerson}
                onAdd={(entry) => { store.addJournalEntry(entry); showToast('Entrée ajoutée'); }}
                onUpdate={(id, updates) => { store.updateJournalEntry(id, updates); showToast('Entrée mise à jour'); }}
                onDelete={(id) => { store.deleteJournalEntry(id); showToast('Entrée supprimée', 'info'); }}
              />
            )}
            {view === 'birthdays' && <BirthdaysView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'ancestors' && <AncestorsView tree={store.activeTree} onSelectPerson={handleSelectPerson} />}
            {view === 'statistics' && <StatisticsView tree={store.activeTree} />}
            {view === 'settings' && (
              <SettingsView
                themeId={themeId}
                onSelectTheme={(id) => { setTheme(id); showToast('Thème appliqué'); }}
                onPreviewTheme={previewTheme}
                onCancelPreview={cancelPreview}
                dark={dark}
                mode={themeMode}
                onSetMode={setThemeMode}
                userEmail={user?.email || null}
                displayName={(user?.user_metadata?.display_name as string | undefined) || null}
                cloud={store.cloud}
                trees={store.trees}
                onToast={showToast}
              />
            )}

            {/* Undo / redo indicator at the bottom of the tree */}
            {view === 'tree' && (
              <HistoryIndicator
                canUndo={store.canUndo}
                canRedo={store.canRedo}
                lastAction={store.lastAction}
                nextAction={store.nextAction}
                onUndo={store.undo}
                onRedo={store.redo}
              />
            )}
          </>
        )}
      </main>

      {/* Right side panel (coexists with main, does not block navigation) */}
      {selectedPerson && store.activeTree && (
        <PersonPanel
          key={selectedPerson.id}
          person={selectedPerson}
          tree={store.activeTree}
          onClose={() => setSelectedPersonId(null)}
          onUpdate={(updates) => { store.updatePerson(selectedPerson.id, updates); showToast('Profil mis à jour'); }}
          onDelete={() => { store.deletePerson(selectedPerson.id); setSelectedPersonId(null); showToast('Personne supprimée', 'info'); }}
          onSelectPerson={handleSelectPerson}
          onAddRelationship={store.addRelationship}
          onUpdateRelationship={(id, updates) => { store.updateRelationship(id, updates); showToast('Relation mise à jour'); }}
          onDeleteRelationship={(id) => { store.deleteRelationship(id); showToast('Relation supprimée', 'info'); }}
        />
      )}

      {/* Command palette (Cmd/Ctrl+K) */}
      {showPalette && (
        <CommandPalette
          tree={store.activeTree}
          onClose={() => setShowPalette(false)}
          onSelectPerson={handleSelectPerson}
          onNavigate={setView}
          onAddPerson={() => setShowAddPerson(true)}
          onImportExport={(tab) => setImportExportTab(tab)}
          onPrint={() => setShowPrint(true)}
          onShare={() => setShowShare(true)}
          onPresent={() => setShowPresentation(true)}
          onTreeSelector={() => setShowTreeSelector(true)}
          onNarrative={() => setShowNarrative(true)}
        />
      )}

      {/* AI narrative report */}
      {showNarrative && store.activeTree && (
        <NarrativeModal tree={store.activeTree} onClose={() => setShowNarrative(false)} />
      )}

      {/* Fullscreen presentation */}
      {showPresentation && store.activeTree && (
        <PresentationMode persons={store.activeTree.persons} onClose={() => setShowPresentation(false)} />
      )}

      {/* Modals */}
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
          shared={store.shared}
          onSelect={(id) => { store.switchTree(id); showToast('Arbre changé'); }}
          onCreate={(name, desc) => { store.createTree(name, desc); showToast(`Arbre « ${name} » créé`); }}
          onDelete={(id) => { store.deleteTree(id); showToast('Arbre supprimé', 'info'); }}
          onRename={(id, meta) => { store.updateTreeMeta(id, meta); showToast('Arbre mis à jour'); }}
          onDuplicate={(id, newName) => { store.duplicateTree(id, newName); showToast(`Arbre dupliqué « ${newName} »`); }}
          onClose={() => setShowTreeSelector(false)}
        />
      )}

      {/* Auth (magic link) */}
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />
      )}

      {/* Migration prompt on first login with local data */}
      {store.migrationPending && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1500, background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '14px 18px', maxWidth: '440px', width: '92%' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '7px' }}><Cloud size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" /> Importer vos données locales ?</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Vous avez des arbres enregistrés sur cet appareil. Voulez-vous les copier vers votre compte pour les synchroniser ?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { store.runMigration(); showToast('Données importées dans le cloud'); }} className="btn btn-primary btn-sm">Importer maintenant</button>
            <button onClick={store.dismissMigration} className="btn btn-ghost btn-sm">Plus tard</button>
          </div>
        </div>
      )}

      {importExportTab && store.activeTree && (
        <ImportExportModal
          tree={store.activeTree}
          initialTab={importExportTab}
          onImport={(t) => { store.importTree(t); showToast(`Arbre « ${t.name} » importé`); }}
          onClose={() => setImportExportTab(null)}
        />
      )}

      {showPrint && store.activeTree && (
        <PrintModal tree={store.activeTree} onClose={() => setShowPrint(false)} />
      )}

      {showShare && store.activeTree && (
        <ShareModal
          tree={store.activeTree}
          cloud={store.cloud}
          onRequireAuth={() => { setShowShare(false); openAuth('login'); }}
          onToast={showToast}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Mobile bottom navigation */}
      <BottomNav activeView={view} onViewChange={setView} onOpenMenu={() => setSidebarOpen(true)} />

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .app-main { padding-bottom: 56px; }
          .person-panel {
            position: fixed !important; right: 0; top: 0; bottom: 0;
            width: 100% !important; max-width: 420px; z-index: 1200 !important;
          }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ onCreateTree }: { onCreateTree: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px', textAlign: 'center' }}>
      <TreePine size={72} strokeWidth={1.1} style={{ color: 'var(--accent)' }} aria-hidden="true" />
      <div>
        <h2 style={{ marginBottom: '8px' }}>Commencez votre arbre généalogique</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
          Créez un nouvel arbre ou importez des données GEDCOM pour découvrir et préserver l&apos;histoire de votre famille.
        </p>
      </div>
      <button onClick={onCreateTree} className="btn btn-primary btn-lg" style={{ gap: '8px' }}><Sprout size={18} aria-hidden="true" /> Créer mon arbre</button>
    </div>
  );
}
