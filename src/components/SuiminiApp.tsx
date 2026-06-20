'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import { useBirthdayNotifications } from '@/hooks/useBirthdayNotifications';
import { useTreeRole } from '@/hooks/useTreeRole';
import { supabase } from '@/lib/supabase';
import { ViewMode, Person, FamilyTree, PhotoTag } from '@/types';
import { generateId } from '@/lib/treeUtils';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AuthModal from './AuthModal';
import DemoBanner from './DemoBanner';
import DashboardView from './DashboardView';
import TreeView from './TreeView';
import ListView from './ListView';
import TimelineView from './TimelineView';
import StatisticsView from './StatisticsView';
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
import PhotoAnalyzer, { FaceAssignment } from './PhotoAnalyzer';
import DocumentScanner, { ImportItem } from './DocumentScanner';
import AdminDashboard from './AdminDashboard';
import TreeSelectorModal from './TreeSelectorModal';
import ImportExportModal from './ImportExportModal';
import PrintModal from './PrintModal';
import ExportPDFModal from './ExportPDFModal';
import ShareModal from './ShareModal';
import ToastStack, { ToastType, ToastItem } from './Toast';
import { BrandLockup } from './Brand';
import OnboardingWizard, { OnboardingData } from './OnboardingWizard';
import { Menu, Search, TreePine, Sprout, Cloud, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement de la carte…
    </div>
  ),
});

// Gallery pulls image-heavy UI; load it on demand to keep the initial app bundle lean.
const GalleryView = dynamic(() => import('./GalleryView'), {
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement de la galerie…
    </div>
  ),
});

export default function SuiminiApp() {
  const { user, signOut, isDemo, exitDemo, isAdmin, role, isLoading } = useAuth();
  const admin = useAdminData({ enabled: isAdmin });
  // Stable reference so useFamilyStore's cloud effect doesn't re-run every render
  // (which left syncStatus stuck on 'syncing').
  const storeUser = useMemo(() => (user ? { id: user.id, email: user.email } : null), [user?.id, user?.email]);
  // authReady = auth resolved → the store won't seed the demo sample for logged-in users.
  const store = useFamilyStore(storeUser, !isLoading);
  const { dark, toggle: toggleDark, mode: themeMode, setMode: setThemeMode } = useDarkMode();
  const { themeId, setTheme, previewTheme, cancelPreview } = useTheme();
  const birthdayAlertCount = useBirthdayNotifications(store.activeTree);

  // Collaborative role on the active tree. Owners/guests get 'owner' (full access);
  // shared trees resolve to admin/editor/viewer. Drives the edit / manage gating below.
  const roleTreeId = store.activeTree?.id ?? null;
  const isSharedTree = !!roleTreeId && !!store.shared[roleTreeId];
  const userRole = useTreeRole({
    treeId: roleTreeId,
    cloud: store.cloud,
    isShared: isSharedTree,
    sharedPermission: roleTreeId ? store.shared[roleTreeId]?.permission : undefined,
  });
  const canEdit = userRole !== 'viewer';
  const canManageMembers = userRole === 'owner' || userRole === 'admin';

  // Fallback so non-tree views (stats, journal, settings…) still render when the
  // user has no active tree, instead of taking over the screen with the tree
  // empty state. Only the 'tree' view truly requires a real active tree.
  const emptyTree = useMemo<FamilyTree>(() => ({
    id: '', name: '', createdAt: '', updatedAt: '', persons: [], relationships: [],
  }), []);
  const tc = useTranslations('common');
  const tOffline = useTranslations('offline');

  const [view, setView] = useState<ViewMode>('dashboard');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import' | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showExportPdf, setShowExportPdf] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const openAuth = useCallback((tab: 'login' | 'signup' = 'login') => { setAuthTab(tab); setShowAuth(true); }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);
  const [isOnline, setIsOnline] = useState(true);

  // Detect network connectivity changes.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback((msg: string, type: ToastType | string = 'success') => {
    const t: ToastType = (['success', 'error', 'info', 'warning'] as const).includes(type as ToastType) ? type as ToastType : 'info';
    toastCounter.current += 1;
    const id = toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type: t }].slice(-3)); // queue, max 3
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // --- AI photo analysis (face recognition) ---
  const tPhoto = useTranslations('photoAnalyzer');
  const [photoAnalyzer, setPhotoAnalyzer] = useState<{ open: boolean; personId?: string }>({ open: false });
  const openPhotoAnalyzer = useCallback((personId?: string) => setPhotoAnalyzer({ open: true, personId }), []);

  // --- OCR document scanner (face/record extraction → tree) ---
  const tOcr = useTranslations('ocr');
  const [docScanner, setDocScanner] = useState<{ open: boolean; personId?: string }>({ open: false });
  const openDocumentScanner = useCallback((personId?: string) => setDocScanner({ open: true, personId }), []);

  // Apply scanned-document people atomically: 'new' creates a person, a personId merges filled fields.
  const handleDocumentImport = useCallback((items: ImportItem[]) => {
    const tree = store.activeTree;
    if (!tree) return;
    const now = new Date().toISOString();
    let persons = [...tree.persons];
    let count = 0;
    for (const it of items) {
      if (it.assignment === 'ignore') continue;
      const place = it.birthPlace ? { city: it.birthPlace } : undefined;
      if (it.assignment === 'new') {
        persons.push({
          id: generateId(), firstName: it.firstName || '', lastName: it.lastName || '',
          gender: 'unknown', isAlive: !it.birthDate ? true : true,
          birthDate: it.birthDate || undefined, birthPlace: place, occupation: it.occupation || undefined,
          createdAt: now, updatedAt: now,
        });
        count++;
      } else {
        persons = persons.map(p => {
          if (p.id !== it.assignment) return p;
          return {
            ...p,
            ...(it.firstName ? { firstName: it.firstName } : {}),
            ...(it.lastName ? { lastName: it.lastName } : {}),
            ...(it.birthDate ? { birthDate: it.birthDate } : {}),
            ...(it.occupation ? { occupation: it.occupation } : {}),
            ...(it.birthPlace ? { birthPlace: { ...p.birthPlace, city: it.birthPlace } } : {}),
            updatedAt: now,
          };
        });
        count++;
      }
    }
    if (count > 0) {
      store.updateTree({ ...tree, persons });
      showToast(tOcr('imported', { count }));
    }
  }, [store, showToast, tOcr]);

  // Apply the photo + face tags atomically (one tree update; creates "new member" persons as needed).
  const handlePhotoTags = useCallback((photoUrl: string, assignments: FaceAssignment[]) => {
    const tree = store.activeTree;
    if (!tree) return;
    const now = new Date().toISOString();
    let persons = [...tree.persons];

    // Resolve each assignment to a concrete personId (creating new members on the fly).
    const targets = assignments.map(a => {
      if (a.value === 'new') {
        const np: Person = {
          id: generateId(), firstName: '', lastName: '', gender: a.gender, isAlive: true,
          profilePhoto: photoUrl, photos: [], createdAt: now, updatedAt: now,
        };
        persons.push(np);
        return { personId: np.id, box: a.boundingBox, confidence: a.confidence };
      }
      return { personId: a.value, box: a.boundingBox, confidence: a.confidence };
    });

    const tagged = new Set<string>();
    for (const tg of targets) {
      persons = persons.map(p => {
        if (p.id !== tg.personId) return p;
        const photos = (p.photos || []).includes(photoUrl) ? (p.photos || []) : [...(p.photos || []), photoUrl];
        const tag: PhotoTag = { photoUrl, personId: tg.personId, boundingBox: tg.box, confidence: tg.confidence ?? undefined, taggedAt: now };
        return { ...p, photos, photoTags: [...(p.photoTags || []), tag], updatedAt: now };
      });
      tagged.add(tg.personId);
    }

    store.updateTree({ ...tree, persons });
    showToast(tagged.size > 0 ? tPhoto('saved', { count: tagged.size }) : tPhoto('savedNone'));
  }, [store, showToast, tPhoto]);

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
    // Realtime echoes our OWN writes back. Skip events that land within the
    // self-write window after this client's last cloud push, otherwise every
    // local edit would trigger "un collaborateur a modifié" in a loop.
    const SELF_WRITE_WINDOW_MS = 6000;
    const reload = () => {
      if (Date.now() - store.lastLocalWriteRef.current < SELF_WRITE_WINDOW_MS) return;
      store.reloadTreeFromCloud(activeTreeId);
      showToast('Un collaborateur a modifié cet arbre', 'info');
    };
    const channel = sb
      .channel(`tree:${activeTreeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons', filter: `tree_id=eq.${activeTreeId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relationships', filter: `tree_id=eq.${activeTreeId}` }, reload)
      // Notify the owner/manager when an invited member accepts and joins the tree.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tree_members', filter: `tree_id=eq.${activeTreeId}` }, (payload) => {
        const row = payload.new as { email?: string; status?: string };
        if (row?.status === 'accepted') showToast(`${row.email ?? 'Un membre'} a rejoint « ${store.activeTree?.name ?? 'votre arbre'} »`, 'success');
      })
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

  // First-run onboarding: an approved, logged-in user who hasn't onboarded and has
  // no real tree yet. The store seeds a sample tree ('tree1') for everyone, so we
  // treat "only the untouched sample" as first access.
  useEffect(() => {
    if (!store.loaded || !user || isDemo) return;
    let onboarded = false;
    try { onboarded = localStorage.getItem('suimini_onboarded') === 'true'; } catch { /* ignore */ }
    if (onboarded) return;
    const onlySample = store.trees.length === 0 || (store.trees.length === 1 && store.trees[0].id === 'tree1');
    if (onlySample) setShowOnboarding(true);
  }, [store.loaded, store.trees, user, isDemo]);

  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    const now = new Date().toISOString();
    const person: Person = {
      id: generateId(),
      firstName: data.firstName, lastName: data.lastName, gender: data.gender,
      isAlive: true, birthDate: data.birthDate, profilePhoto: data.profilePhoto,
      createdAt: now, updatedAt: now,
    };
    const tree: FamilyTree = {
      id: '', name: data.treeName, createdAt: now, updatedAt: now,
      persons: [person], relationships: [], rootPersonId: person.id,
      settings: { defaultView: 'tree', showPhotos: true, showDates: true, showPlaces: true, colorScheme: 'default', generationsToShow: 5 },
    };
    store.importTree(tree); // atomic: appends tree (+ root person), sets it active
    try { localStorage.setItem('suimini_onboarded', 'true'); } catch { /* ignore */ }
    setShowOnboarding(false);
    setView('tree');
    setSelectedPersonId(person.id);
    showToast(`Arbre « ${data.treeName} » créé`);
  }, [store, showToast]);

  const handleOnboardingSkip = useCallback(() => {
    try { localStorage.setItem('suimini_onboarded', 'true'); } catch { /* ignore */ }
    setShowOnboarding(false);
  }, []);

  // Handle PWA shortcut deep-links (?view=tree, ?action=add-person, etc.)
  // and Web Share Target payloads stored in sessionStorage by /app/share.
  useEffect(() => {
    if (typeof window === 'undefined' || !store.loaded) return;
    // URL params from shortcuts
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewMode | null;
    const actionParam = params.get('action');
    const validViews: ViewMode[] = ['dashboard', 'tree', 'list', 'map', 'journal', 'timeline', 'statistics', 'birthdays', 'gallery', 'ancestors', 'settings'];
    if (viewParam && validViews.includes(viewParam)) setView(viewParam);
    if (actionParam === 'add-person') setShowAddPerson(true);
    if (actionParam === 'share') setShowShare(true);
    if (params.toString()) window.history.replaceState({}, '', '/app');

    // Shared content from Web Share Target
    try {
      const raw = sessionStorage.getItem('suimini_shared');
      if (raw) {
        sessionStorage.removeItem('suimini_shared');
        const shared = JSON.parse(raw) as { title?: string; text?: string; url?: string };
        const label = [shared.title, shared.text, shared.url].filter(Boolean).join(' — ');
        if (label) showToast(label.slice(0, 80), 'info');
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  // Mobile swipe-between-views (left/right, skip tree which has its own panning).
  const swipeTouchX = useRef<number | null>(null);
  const swipeTouchY = useRef<number | null>(null);
  const SWIPE_VIEWS: ViewMode[] = ['dashboard', 'tree', 'list', 'map', 'journal'];
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeTouchX.current = e.touches[0].clientX;
    swipeTouchY.current = e.touches[0].clientY;
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (swipeTouchX.current === null || swipeTouchY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchY.current;
    swipeTouchX.current = null;
    swipeTouchY.current = null;
    // Only fire on very horizontal swipes (< 30° tilt) of at least 80px.
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
    // Don't interfere with tree panning or open modals.
    const target = e.target as HTMLElement;
    if (target.closest('.tree-svg')) return;
    const anyModalOpen = showAddPerson || showTreeSelector || !!importExportTab || showPrint || showExportPdf || showShare || showPalette || showPresentation || showNarrative || showAuth || showOnboarding || !!docScanner.open || !!photoAnalyzer.open;
    if (anyModalOpen) return;
    const idx = SWIPE_VIEWS.indexOf(view);
    if (idx === -1) return;
    if (dx < 0 && idx < SWIPE_VIEWS.length - 1) setView(SWIPE_VIEWS[idx + 1]);
    if (dx > 0 && idx > 0) setView(SWIPE_VIEWS[idx - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showAddPerson, showTreeSelector, importExportTab, showPrint, showExportPdf, showShare, showPalette, showPresentation, showNarrative, showAuth, showOnboarding, docScanner.open, photoAnalyzer.open]);

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

  // Hold the loading screen until auth is resolved (isLoading) AND the store has
  // loaded (store.loaded). This avoids a flash of empty/guest content while the
  // Supabase session restores and the cloud fetch (with retries) completes.
  if (isLoading || !store.loaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <BrandLockup size={36} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" fontSize={28} />
          <div className="label" style={{ color: 'var(--text-muted)' }}>{tc('loading')}</div>
        </div>
      </div>
    );
  }

  const selectedPerson = selectedPersonId
    ? store.activeTree?.persons.find(p => p.id === selectedPersonId) || null
    : null;

  const handleResync = async () => {
    const ok = await store.resync();
    showToast(ok ? 'Synchronisation terminée' : 'Échec de la synchronisation', ok ? 'success' : 'error');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} aria-hidden="true"
          style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 'calc(var(--z-sticky) - 1)' }}
        />
      )}

      <Sidebar
        activeView={view}
        onViewChange={setView}
        activeTree={store.activeTree}
        trees={store.trees}
        onShowTreeSelector={() => setShowTreeSelector(true)}
        onAddPerson={() => setShowAddPerson(true)}
        canEdit={canEdit}
        userRole={userRole}
        onShowImportExport={() => setImportExportTab('export')}
        onPrint={() => setShowPrint(true)}
        onExportPdf={() => setShowExportPdf(true)}
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
        lastSyncAt={store.lastSyncAt}
        onResync={handleResync}
        presenceCount={store.cloud ? presenceCount : 0}
        onSignIn={() => openAuth('login')}
        isDemo={isDemo}
        isAdmin={isAdmin}
        unreadCount={admin.unreadCount}
        onSignOut={async () => { await signOut(); showToast('Déconnecté'); }}
      />

      <main className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        {!isOnline && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 16px', background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))', borderBottom: 'var(--bw) solid var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', letterSpacing: '0.02em' }}>
            <WifiOff size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--accent)' }} />
            <span><strong>{tOffline('banner')}</strong> — {tOffline('saved')}</span>
          </div>
        )}
        {isDemo && <DemoBanner onCreateAccount={() => openAuth('signup')} onExit={exitDemo} />}
        {/* Mobile header */}
        <div style={{ display: 'none', padding: '10px 16px', borderBottom: 'var(--bw) solid var(--border-strong)', background: 'var(--bg-card)', alignItems: 'center', gap: '12px' }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon btn-sm" aria-label="Ouvrir le menu"><Menu size={18} aria-hidden="true" /></button>
          <BrandLockup size={24} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" fontSize={18} />
          <button onClick={() => setShowPalette(true)} className="btn btn-ghost btn-icon btn-sm" style={{ marginLeft: 'auto' }} aria-label="Rechercher"><Search size={18} aria-hidden="true" /></button>
          <span className="label" style={{ color: 'var(--text-muted)', textTransform: 'none' }}>{store.activeTree?.name}</span>
        </div>

        {view === 'admin' ? (
          <AdminDashboard admin={admin} role={role} onToast={showToast} />
        ) : view === 'dashboard' ? (
          <DashboardView
            trees={store.trees}
            displayName={(user?.user_metadata?.display_name as string | undefined) || null}
            userEmail={user?.email || null}
            onNavigate={setView}
            onNewTree={() => setShowTreeSelector(true)}
            onSelectPerson={(treeId, personId) => { if (treeId !== store.activeTreeId) store.switchTree(treeId); handleSelectPerson(personId); }}
            onNarrative={() => setShowNarrative(true)}
            onAnalyzePhoto={() => openPhotoAnalyzer()}
          />
        ) : view === 'tree' && !store.activeTree ? (
          // The tree view is the only one that genuinely needs an active tree.
          <EmptyState onCreateTree={() => setShowTreeSelector(true)} />
        ) : (
          <>
            {view === 'tree' && store.activeTree && <TreeView tree={store.activeTree} selectedPersonId={selectedPersonId} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} onExport={() => setShowPrint(true)} readOnly={!canEdit} />}
            {view === 'list' && <ListView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} onAddPerson={() => setShowAddPerson(true)} canEdit={canEdit} />}
            {view === 'timeline' && <TimelineView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} />}
            {view === 'map' && <MapView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} />}
            {view === 'gallery' && <GalleryView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} onUpdatePerson={(id, updates) => { store.updatePerson(id, updates); showToast('Photo ajoutée'); }} onAnalyzePhoto={() => openPhotoAnalyzer()} />}
            {view === 'journal' && (
              <JournalView
                tree={store.activeTree ?? emptyTree}
                onSelectPerson={handleSelectPerson}
                onAdd={(entry) => { store.addJournalEntry(entry); showToast('Entrée ajoutée'); }}
                onUpdate={(id, updates) => { store.updateJournalEntry(id, updates); showToast('Entrée mise à jour'); }}
                onDelete={(id) => { store.deleteJournalEntry(id); showToast('Entrée supprimée', 'info'); }}
              />
            )}
            {view === 'birthdays' && <BirthdaysView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} />}
            {view === 'ancestors' && <AncestorsView tree={store.activeTree ?? emptyTree} onSelectPerson={handleSelectPerson} />}
            {view === 'statistics' && <StatisticsView tree={store.activeTree ?? emptyTree} />}
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
                onResync={handleResync}
                lastSyncAt={store.lastSyncAt}
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
          readOnly={!canEdit}
          onClose={() => setSelectedPersonId(null)}
          onUpdate={(updates) => { store.updatePerson(selectedPerson.id, updates); showToast('Profil mis à jour'); }}
          onDelete={() => { store.deletePerson(selectedPerson.id); setSelectedPersonId(null); showToast('Personne supprimée', 'info'); }}
          onSelectPerson={handleSelectPerson}
          onAddRelationship={store.addRelationship}
          onUpdateRelationship={(id, updates) => { store.updateRelationship(id, updates); showToast('Relation mise à jour'); }}
          onDeleteRelationship={(id) => { store.deleteRelationship(id); showToast('Relation supprimée', 'info'); }}
          onAnalyzePhoto={() => openPhotoAnalyzer(selectedPerson.id)}
          onScanDocument={() => openDocumentScanner(selectedPerson.id)}
          onToast={showToast}
        />
      )}

      {/* AI face recognition */}
      {photoAnalyzer.open && store.activeTree && (
        <PhotoAnalyzer
          tree={store.activeTree}
          preselectPersonId={photoAnalyzer.personId}
          onClose={() => setPhotoAnalyzer({ open: false })}
          onConfirm={handlePhotoTags}
        />
      )}

      {/* OCR document scanner */}
      {docScanner.open && store.activeTree && (
        <DocumentScanner
          tree={store.activeTree}
          preselectPersonId={docScanner.personId}
          onClose={() => setDocScanner({ open: false })}
          onImport={handleDocumentImport}
        />
      )}

      {/* Command palette (Cmd/Ctrl+K) */}
      {showPalette && (
        <CommandPalette
          tree={store.activeTree}
          trees={store.trees}
          activeTreeId={store.activeTreeId}
          onClose={() => setShowPalette(false)}
          onOpenPerson={(treeId, personId) => { if (treeId !== store.activeTreeId) store.switchTree(treeId); handleSelectPerson(personId); }}
          onNavigate={setView}
          onAddPerson={canEdit ? () => setShowAddPerson(true) : undefined}
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
      {showAddPerson && store.activeTree && canEdit && (
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
          onMerge={(t) => { store.updateTree(t); showToast(`Arbre « ${t.name} » mis à jour`); }}
          onClose={() => setImportExportTab(null)}
          onScanDocument={() => openDocumentScanner()}
        />
      )}

      {showPrint && store.activeTree && (
        <PrintModal tree={store.activeTree} onClose={() => setShowPrint(false)} />
      )}

      {showExportPdf && store.activeTree && (
        <ExportPDFModal tree={store.activeTree} onClose={() => setShowExportPdf(false)} />
      )}

      {showShare && store.activeTree && (
        <ShareModal
          tree={store.activeTree}
          cloud={store.cloud}
          canManageMembers={canManageMembers}
          onRequireAuth={() => { setShowShare(false); openAuth('login'); }}
          onToast={showToast}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* First-run onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}

      {/* Mobile bottom navigation */}
      <BottomNav activeView={view} onViewChange={setView} onOpenMenu={() => setSidebarOpen(true)} />

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          /* Leave room for the fixed BottomNav (56px + safe-area). PersonPanel
             renders its own full-screen mobile sheet (inset:0) via the isMobile
             branch, so it intentionally has NO override here anymore — the old
             max-width:420px cap conflicted with the full-screen sheet. */
          .app-main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ onCreateTree }: { onCreateTree: () => void }) {
  const t = useTranslations('tree');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px', textAlign: 'center' }}>
      <TreePine size={72} strokeWidth={1.1} style={{ color: 'var(--accent)' }} aria-hidden="true" />
      <div>
        <h2 style={{ marginBottom: '8px' }}>{t('emptyTitle')}</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
          {t('emptySubtitle')}
        </p>
      </div>
      <button onClick={onCreateTree} className="btn btn-primary btn-lg" style={{ gap: '8px' }}><Sprout size={18} aria-hidden="true" /> {t('createButton')}</button>
    </div>
  );
}
