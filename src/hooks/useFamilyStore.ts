'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FamilyTree, Person, Relationship, JournalEntry } from '@/types';
import { sampleFamilyTree } from '@/lib/sampleData';
import { generateId, getDisplayName } from '@/lib/treeUtils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SharedMeta, ChildTable } from '@/lib/supabaseSync';
import { getDataClient, ensureServerDataLayer } from '@/lib/dataClient';
import { mergeTreeFavoringLocal, treeIdSets, removedIds, TreeIdSets } from '@/lib/syncMerge';
import { addConflicts, Conflict } from '@/lib/conflictQueue';
import { offlineStorage } from '@/lib/offlineStorage';

const STORAGE_KEY = 'suimini_trees';
const ACTIVE_TREE_KEY = 'suimini_active_tree';
const MAX_HISTORY = 50;
// The local→cloud migration prompt is a one-time decision per browser. Once the
// user imports OR dismisses it, we persist that so it never re-appears on the
// next login (the local data is still on disk and would otherwise re-trigger it).
const IMPORT_DONE_KEY = 'suimini_import_done';
const IMPORT_DISMISSED_KEY = 'suimini_import_dismissed';
// Cache schema version. Bump when the persisted tree/person shape changes
// incompatibly: on mismatch the local cache (localStorage + IndexedDB) is purged
// and re-hydrated (cloud → Supabase, guest → fresh sample), so stale data written
// by an older build can never render. The owning userId is stamped alongside for
// defence-in-depth (cross-account staleness is already prevented by the hard cache
// replace on cloud login and the cache wipe in signOut).
const CACHE_META_KEY = 'suimini_cache_meta';
const STORE_VERSION = 3;
// A cloud refetch is forced when the tab regains focus and the cache is older than
// this (Railway/Supabase always wins).
// ⚠️ Volontairement COURT (pas 5 min) : le canal Realtime de SuiminiApp.tsx
// (`postgres_changes` sur `persons`/`relationships`) écoute les tables SUPABASE —
// or depuis le passage à 100% `DB_BACKEND=railway` (voir CLAUDE.md « Backend
// données — Railway »), TOUTES les écritures atterrissent dans Railway, jamais
// dans Supabase. Ce canal ne se déclenche donc plus JAMAIS pour un vrai changement
// de données (symptôme observé : « obligé de faire un refresh manuel pour voir la
// photo mise à jour depuis un autre appareil »). Ce pull-au-retour-de-focus est
// désormais le SEUL mécanisme qui rattrape les écritures d'un autre
// appareil/session — le seuil est donc réduit à quasi-immédiat plutôt que 5 min.
const STALE_MS = 10 * 1000;

function readCacheVersion(): number | null {
  if (typeof window === 'undefined') return null;
  try { return (JSON.parse(localStorage.getItem(CACHE_META_KEY) || '{}').version ?? null); } catch { return null; }
}
function writeCacheMeta(userId: string) {
  try { localStorage.setItem(CACHE_META_KEY, JSON.stringify({ version: STORE_VERSION, userId })); } catch { /* ignore */ }
}

/** True when the user already imported or dismissed the local-data migration prompt. */
function importPromptSuppressed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(IMPORT_DONE_KEY) === 'true'
      || localStorage.getItem(IMPORT_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

// ── Commit-latency guard (reload race) ─────────────────────────────────────────
// A F5 right after an edit can beat the Supabase server-side commit of our just-
// pushed upsert: the reload's SELECT then returns the PRE-edit rows and the hard-
// replace would drop the local edit. So for a tree edited within this window we
// prefer the local cache and merge in remote-only entities (see mergeTreeFavoringLocal).
const FAVOR_LOCAL_MS = 30_000;
// Per-tab-session flag. The FAVOR_LOCAL merge only makes sense for an F5 *within* an
// active session (protect a just-made edit from commit latency). On the FIRST cloud
// load of a session — a fresh login (signOut clears the flag), a reopened tab, etc. —
// the remote is the source of truth and must WIN outright: a full hard-replace, no
// merge. This prevents a stale local cache from resurfacing an old version of the tree
// (« l'arbre affiche une génération précédente au login »). sessionStorage survives F5
// but not tab-close, and signOut removes it explicitly.
const SESSION_LOADED_KEY = 'suimini_session_loaded';
// Ids deleted locally are remembered (a bit longer than the favour window) so the
// merge NEVER resurrects a delete from a not-yet-committed remote row — and the
// subsequent re-push can't turn a resurrection into a permanent re-insert.
const RECENT_DELETE_KEY = 'suimini_recent_deletes';
const RECENT_DELETE_MS = 60_000;

/** Remember ids just deleted locally (persons/relations/journal), pruning stale ones. */
function recordDeletedIds(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const now = Date.now();
    const map: Record<string, number> = JSON.parse(localStorage.getItem(RECENT_DELETE_KEY) || '{}');
    for (const id of ids) map[id] = now;
    for (const k of Object.keys(map)) if (now - map[k] > RECENT_DELETE_MS) delete map[k];
    localStorage.setItem(RECENT_DELETE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/** Oublie un id précis des suppressions récentes (résolution « Restaurer » d'un
 * conflit : la restauration ne doit pas être ré-annulée par le merge favor-local). */
function clearRecentDeletedId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(RECENT_DELETE_KEY) || '{}');
    if (id in map) { delete map[id]; localStorage.setItem(RECENT_DELETE_KEY, JSON.stringify(map)); }
  } catch { /* ignore */ }
}

/** Ids deleted locally within RECENT_DELETE_MS — never re-added by the favour-local merge. */
function getRecentDeletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const now = Date.now();
    const map: Record<string, number> = JSON.parse(localStorage.getItem(RECENT_DELETE_KEY) || '{}');
    return new Set(Object.keys(map).filter(id => now - map[id] <= RECENT_DELETE_MS));
  } catch { return new Set(); }
}

// ── Suppressions durables (at-least-once) ──────────────────────────────────────
// Suppressions EN ATTENTE de confirmation serveur, par table (localStorage). Posées
// dès qu'un retrait est détecté, rejouées à CHAQUE push (il y en a un à chaque
// chargement de l'app), effacées seulement une fois le soft-delete persisté. Un F5
// qui coupe le push ne perd donc jamais une suppression — l'ancienne architecture
// comptait sur le diff distant du push suivant pour rattraper ça, précisément le
// mécanisme dangereux qu'on supprime.
const PENDING_DELETE_KEY = 'suimini_pending_deletes';
const PENDING_DELETE_TTL_MS = 7 * 24 * 3600_000;
type PendingDeleteMap = Record<string, Record<string, number>>; // table → id → ts

function readPendingDeletes(): PendingDeleteMap {
  if (typeof window === 'undefined') return {};
  try {
    const map: PendingDeleteMap = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) || '{}');
    const now = Date.now();
    for (const t of Object.keys(map))
      for (const id of Object.keys(map[t]))
        if (now - map[t][id] > PENDING_DELETE_TTL_MS) delete map[t][id];
    return map;
  } catch { return {}; }
}
function writePendingDeletes(map: PendingDeleteMap): void {
  try { localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
function addPendingDeletes(byTable: Partial<Record<ChildTable, string[]>>): void {
  if (typeof window === 'undefined') return;
  const map = readPendingDeletes();
  const now = Date.now();
  for (const [table, ids] of Object.entries(byTable))
    for (const id of ids ?? []) (map[table] ??= {})[id] = now;
  writePendingDeletes(map);
}
function clearPendingDeletes(table: ChildTable, ids: string[]): void {
  if (typeof window === 'undefined') return;
  const map = readPendingDeletes();
  if (!map[table]) return;
  for (const id of ids) delete map[table][id];
  writePendingDeletes(map);
}

export type SyncStatus = 'idle' | 'saved' | 'syncing' | 'offline' | 'error';
export interface StoreUser { id: string; email?: string }

interface HistorySnapshot {
  trees: FamilyTree[];
  description: string;
}

export function useFamilyStore(user: StoreUser | null = null, authReady = true) {
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Undo / redo stacks
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  // Cloud sync state
  const cloud = !!user && isSupabaseConfigured;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [shared, setShared] = useState<Record<string, SharedMeta>>({});
  const [migrationPending, setMigrationPending] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flush plumbing for the debounced cloud push (see the push effect below):
  //  • immediateSyncRef → the NEXT scheduled push runs at 0 ms instead of 700 ms.
  //    Posé par les mutations CRUD explicites (updatePerson/add/delete, relations,
  //    journal) : une action utilisateur explicite ne doit pas attendre le debounce.
  //  • pendingPushRef → fonction qui pousse l'arbre COURANT immédiatement ; appelée
  //    par le listener beforeunload/pagehide pour vider un save en attente avant F5.
  const immediateSyncRef = useRef(false);
  const pendingPushRef = useRef<null | (() => void)>(null);
  // True from the moment doPush's actual network call starts until it settles.
  // pendingPushRef is nulled as soon as the request FIRES (see doPush), so the
  // beforeunload/pagehide flush below can't do anything once a push is genuinely
  // in flight — this ref is what lets beforeunload additionally show the browser's
  // native "leave site?" confirmation in that specific window, buying the async
  // write real wall-clock time to land before the reload actually happens.
  const pushInFlightRef = useRef(false);
  const localCacheRef = useRef<FamilyTree[]>([]);
  // Timestamp of the last cloud push made by THIS client. Realtime echoes our own
  // writes back; the app uses this to ignore them (see SuiminiApp) so we don't
  // toast "un collaborateur a modifié" in a loop on our own edits.
  const lastLocalWriteRef = useRef(0);
  // Set true the moment a cloud load begins. The guest/IndexedDB branch checks it
  // and bails, so a stale local read (started while auth was still resolving) can
  // NEVER overwrite the Supabase data. This is the definitive race guard.
  const supabaseLoadedRef = useRef(false);
  // Origin of the latest sync error, so the in-app "Réessayer" does the RIGHT thing:
  // a failed PULL (load) should re-pull; a failed PUSH (debounced save) must re-push,
  // NEVER pull (a pull would replace the local edit that hasn't reached the server →
  // data loss). null when there is no error.
  const syncErrorKindRef = useRef<'load' | 'save' | null>(null);
  // Ids que CE client a réellement AFFICHÉS (chargés du cloud ou poussés), par
  // arbre. Le push les diffe contre l'état courant pour propager en soft-delete
  // les retraits implicites (undo d'un ajout, fusion/import qui retire des
  // entités…). On ne compare JAMAIS à l'état distant : seuls des ids déjà vus
  // puis retirés ICI sont supprimés — un cache partiel/vide ne peut donc jamais
  // purger un arbre (contrairement à l'ancien DELETE-par-diff).
  const knownIdsRef = useRef<Record<string, TreeIdSets>>({});
  const rememberKnownIds = useCallback((ts: FamilyTree[]) => {
    knownIdsRef.current = Object.fromEntries(ts.map(t => [t.id, treeIdSets(t)]));
  }, []);

  // SINGLE load effect. Gated on authReady so it never runs against a half-init
  // client. It branches by mode — and the two branches are mutually exclusive:
  //   • cloud (logged in)  → load from Supabase ONLY. IndexedDB is NEVER read at
  //     startup in cloud mode. `supabaseLoadedRef` is flipped true synchronously,
  //     so any in-flight guest read bails instead of clobbering the cloud data.
  //   • guest / demo       → load from IndexedDB / localStorage (seed the sample).
  useEffect(() => {
    if (!authReady || typeof window === 'undefined') return;

    // Schema-version cache-bust (runs before any read). Purge ONLY in CLOUD mode,
    // where Supabase can re-hydrate — a guest's local-only trees are irreplaceable,
    // so we NEVER auto-delete them on a version change (better a tolerated old shape
    // than silent data loss). `!==` (not `<`) so a downgrade too — e.g. a deploy
    // rollback leaving a newer-shaped cache the old code can't read — also purges.
    // A missing meta (pre-versioning install) is adopted as-is and just stamped.
    const cachedVersion = readCacheVersion();
    if (cachedVersion != null && cachedVersion !== STORE_VERSION && cloud && user) {
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ACTIVE_TREE_KEY); } catch { /* ignore */ }
      offlineStorage.clear().catch(() => {});
      console.info(`[store] Cache schema incompatible (v${cachedVersion} ≠ v${STORE_VERSION}) → purge + rechargement cloud.`);
    }
    writeCacheMeta(cloud && user ? user.id : 'guest');

    // Always cache localStorage into localCacheRef (migration detection), cheaply.
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as FamilyTree[]) : [];
    localCacheRef.current = parsed;

    // ===== CLOUD MODE: Supabase is the only source. IndexedDB is never read. =====
    if (cloud && user) {
      supabaseLoadedRef.current = true; // from now on the guest branch must not write
      let active = true;
      let settled = false; // flips true once run() reaches any terminal state
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      setSyncStatus('syncing');
      const localTrees = localCacheRef.current;
      const onlySample = localTrees.length === 1 && localTrees[0].id === 'tree1';
      const hasRealLocal = localTrees.length > 0 && !onlySample;
      // Safety net: if the network hangs (loadTreesFromSupabase never settles) the
      // user must NEVER be stuck on an infinite spinner. After 10s, IF the load
      // hasn't settled, reveal the app with the LOCAL CACHE (not an empty []) and
      // flag the error so the in-app banner offers "Réessayer". Guarded by `settled`
      // so it can never clobber a load that already won.
      const safety = setTimeout(() => {
        if (!active || settled) return;
        if (localTrees.length > 0) {
          setTrees(localTrees);
          rememberKnownIds(localTrees);
          setActiveTreeId(prev => prev ?? localTrees[0]?.id ?? null);
        }
        syncErrorKindRef.current = 'load';
        setSyncStatus('error');
        setLoaded(true);
      }, 10000);

      // On a cold load the access token may not be attached to the FIRST REST call
      // yet → RLS returns [] and the app looked empty until a manual refresh. Retry a
      // few times before concluding the account is empty. The loading screen stays up
      // across retries (we don't flip `loaded`), so there is no empty flash.
      const MAX_ATTEMPTS = 3;
      const run = async (attempt: number) => {
        try {
          // Gate : résoudre le défaut serveur (api|direct) AVANT de choisir le
          // transport → la 1ʳᵉ lecture part sur le bon DataClient. Idempotent
          // (résolu une fois, instantané ensuite), fail-safe → 'direct'.
          await ensureServerDataLayer();
          const { trees: remote, shared: sharedMeta } = await getDataClient().loadTrees(user.id);
          if (!active) return;
          setShared(sharedMeta);
          if (remote.length > 0) {
            setMigrationPending(false);
            // FRESH SESSION → HARD-REPLACE (no merge). On the first cloud load of a tab
            // session (fresh login, reopened tab), the remote is authoritative and wins
            // outright, so a stale local cache can't resurface an old version of the tree.
            // The FAVOR_LOCAL commit-latency merge below applies only to a later F5 within
            // the same session (flag already set).
            const freshSession = typeof window !== 'undefined' && !sessionStorage.getItem(SESSION_LOADED_KEY);
            try { if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_LOADED_KEY, '1'); } catch { /* ignore */ }
            // COMMIT-LATENCY GUARD (same-session F5 only): a fresh remote SELECT can still
            // return the pre-edit rows if our just-pushed upsert hasn't committed server-
            // side yet. For a tree edited within FAVOR_LOCAL_MS we keep the LOCAL cache and
            // merge in remote-only entities (a collaborator's add), never resurrecting a
            // local delete. Trees not edited that recently take the remote as-is.
            const nowTs = Date.now();
            const deleted = getRecentDeletedIds();
            const effective = freshSession ? remote : remote.map(rt => {
              const lt = localTrees.find(t => t.id === rt.id);
              const ltAge = lt ? nowTs - Date.parse(lt.updatedAt || '') : Infinity;
              return (lt && ltAge < FAVOR_LOCAL_MS) ? mergeTreeFavoringLocal(lt, rt, deleted) : rt;
            });
            setTrees(effective);
            rememberKnownIds(effective);
            setActiveTreeId(prev => (effective.find(t => t.id === prev) ? prev : effective[0]?.id || null));
            setSyncStatus('saved');
            setLastSyncAt(Date.now());
            // Cache mirrors what we actually show (merged), so IndexedDB/localStorage stay
            // consistent. Trees untouched this recently were replaced by remote above, so
            // SQL-side edits still land on next login.
            localCacheRef.current = effective;
            try {
              await offlineStorage.clear();
              if (!active) return;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(effective));
              for (const t of effective) await offlineStorage.setTree(t);
            } catch { /* IndexedDB/localStorage unavailable — non-fatal */ }
            if (active) { settled = true; setLoaded(true); }
            return;
          }
          // Remote came back empty — could be a genuinely empty account, OR the cold-
          // token race described above (access token not attached to the FIRST REST
          // call yet). Retry BEFORE concluding anything, including before offering the
          // local→cloud migration prompt: taking the `hasRealLocal` fallback on attempt 1
          // used to short-circuit these retries entirely, so an existing account with
          // real cloud data (TEDA, etc.) that merely raced on its first read would
          // permanently latch `migrationPending=true` — a "importer vos données locales ?"
          // prompt stuck showing over an account that already has cloud data. Now BOTH
          // branches (real local data or not) wait out the retries first.
          if (attempt < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => { if (active) run(attempt + 1); }, 400 * attempt);
            return; // keep the loading screen up; do NOT flip `loaded` yet
          }
          if (hasRealLocal) {
            // Cloud genuinely empty (retries exhausted) but real local data → show it +
            // offer migration (never the sample), UNLESS already imported/dismissed here.
            setMigrationPending(!importPromptSuppressed());
            setTrees(localTrees);
            rememberKnownIds(localTrees);
            setActiveTreeId(localTrees[0]?.id || null);
            setSyncStatus('saved');
            if (active) { settled = true; setLoaded(true); }
            return;
          }
          setMigrationPending(false);
          setTrees([]);
          setActiveTreeId(null);
          setSyncStatus('idle');
          if (active) { settled = true; setLoaded(true); }
        } catch (err) {
          if (!active) return;
          if (attempt < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => { if (active) run(attempt + 1); }, 400 * attempt);
            return;
          }
          console.error('[store] Chargement cloud échoué après retries:', err);
          // Fall back to real local data if any, otherwise empty — never the sample.
          if (hasRealLocal) { setTrees(localTrees); rememberKnownIds(localTrees); setActiveTreeId(localTrees[0]?.id || null); }
          else { setTrees([]); setActiveTreeId(null); }
          syncErrorKindRef.current = 'load';
          setSyncStatus('error');
          if (active) { settled = true; setLoaded(true); }
        }
      };
      run(1);
      return () => { active = false; clearTimeout(safety); if (retryTimer) clearTimeout(retryTimer); };
    }

    // ===== GUEST / DEMO MODE: IndexedDB / localStorage / sample seed. =====
    setSyncStatus('idle'); setShared({}); setMigrationPending(false);
    // If a cloud load already owns the data (auth resolved after this branch was
    // queued), never read IndexedDB — that would resurrect stale/empty local data.
    if (supabaseLoadedRef.current) return;
    let active = true;
    (async () => {
      try {
        const idbTrees = await offlineStorage.getAllTrees();
        if (!active || supabaseLoadedRef.current) return;
        if (idbTrees.length > 0) {
          setTrees(idbTrees);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || idbTrees[0]?.id || null);
          localCacheRef.current = idbTrees;
        } else if (parsed.length > 0) {
          // Migrate localStorage → IndexedDB (one-time upgrade).
          for (const tree of parsed) await offlineStorage.setTree(tree);
          if (!active || supabaseLoadedRef.current) return;
          setTrees(parsed);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || parsed[0]?.id || null);
        } else {
          // Guest / demo, first visit → seed the sample tree.
          setTrees([sampleFamilyTree]);
          localCacheRef.current = [sampleFamilyTree];
          setActiveTreeId(sampleFamilyTree.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleFamilyTree]));
          localStorage.setItem(ACTIVE_TREE_KEY, sampleFamilyTree.id);
          await offlineStorage.setTree(sampleFamilyTree);
        }
      } catch {
        if (!active || supabaseLoadedRef.current) return;
        // IndexedDB unavailable (private browsing, etc.) → fall back to localStorage.
        if (parsed.length) {
          setTrees(parsed);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || parsed[0]?.id || null);
        } else {
          setTrees([sampleFamilyTree]);
          localCacheRef.current = [sampleFamilyTree];
          setActiveTreeId(sampleFamilyTree.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleFamilyTree]));
          localStorage.setItem(ACTIVE_TREE_KEY, sampleFamilyTree.id);
        }
      } finally {
        if (active && !supabaseLoadedRef.current) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [authReady, cloud, user, rememberKnownIds]);

  // Debounced push of the active tree to the cloud after any change.
  // (declared after activeTree below)

  const persist = useCallback((updated: FamilyTree[]) => {
    setTrees(updated);
    localCacheRef.current = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Fire-and-forget IndexedDB write (resilient: silently ignored on failure).
    Promise.all(updated.map(t => offlineStorage.setTree(t))).catch(() => {});
  }, []);

  // Persist + record an undoable history snapshot of the PREVIOUS state.
  const commit = useCallback((updated: FamilyTree[], description: string) => {
    setPast(prev => {
      const snapshot: HistorySnapshot = { trees, description };
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
    persist(updated);
  }, [trees, persist]);

  const activeTree = trees.find(t => t.id === activeTreeId) || null;

  // Pousse un arbre au cloud MAINTENANT, dans l'ordre :
  //   1. détecte les retraits implicites (ids affichés — knownIds — disparus du
  //      state sans passer par delete{Person,…} : undo d'un ajout, fusion…) et les
  //      enregistre en suppressions durables (localStorage) ;
  //   2. rejoue TOUTES les suppressions en attente en soft-delete (celles d'un
  //      push précédent coupé par un F5 incluses), en écartant les ids re-présents
  //      localement (undo d'une suppression : l'upsert les ranimera) ;
  //   3. upserte l'arbre entier (UPSERT-only, jamais de DELETE) ;
  //   4. mémorise les ids poussés comme nouveaux « affichés ».
  const pushTreeNow = useCallback(async (tree: FamilyTree): Promise<void> => {
    if (!user) return;
    const isOwner = !shared[tree.id];
    const current = treeIdSets(tree);
    const gone = removedIds(knownIdsRef.current[tree.id], current);
    const allGone = [...gone.persons, ...gone.relationships, ...gone.journal];
    if (allGone.length) {
      recordDeletedIds(allGone); // le merge favor-local ne doit pas les ressusciter
      addPendingDeletes({ persons: gone.persons, relationships: gone.relationships, journal_entries: gone.journal });
    }
    const pending = readPendingDeletes();
    const currentByTable: Record<ChildTable, Set<string>> = {
      persons: current.persons, relationships: current.relationships, journal_entries: current.journal,
    };
    for (const table of Object.keys(pending) as ChildTable[]) {
      const ids = Object.keys(pending[table] ?? {});
      if (!ids.length) continue;
      const restored = ids.filter(id => currentByTable[table]?.has(id));
      if (restored.length) clearPendingDeletes(table, restored);
      const toDelete = ids.filter(id => !currentByTable[table]?.has(id));
      // Best-effort : en échec, l'id RESTE en attente et sera rejoué au prochain
      // push (au plus tard au prochain chargement de l'app).
      if (toDelete.length && await getDataClient().deleteChildRows(tree.id, table, toDelete)) clearPendingDeletes(table, toDelete);
    }
    // ── Résolution de conflits multi-appareils (delete-vs-edit) ──────────────────
    // Un AUTRE appareil a pu soft-deleter une personne/relation APRÈS notre dernière
    // édition. Un UPSERT aveugle (deleted_at:null) la RESSUSCITERAIT. On détecte ces
    // cas, on les EXCLUT de ce push (pas de résurrection) et on les enfile pour que
    // l'utilisateur tranche (ConflictModal). Best-effort / fail-open : la moindre
    // erreur → aucun conflit → le push se déroule comme avant. Ne tourne jamais en
    // mode démo (pushTreeNow sort déjà tôt si `!user`).
    let treeToPush = tree;
    try {
      const [personConflicts, relConflicts] = await Promise.all([
        getDataClient().detectDeleteConflicts(tree.id, 'persons', tree.persons.map(p => ({ id: p.id, updatedAt: p.updatedAt }))),
        getDataClient().detectDeleteConflicts(tree.id, 'relationships', tree.relationships.map(r => ({ id: r.id, updatedAt: (r as { updatedAt?: string }).updatedAt }))),
      ]);
      if (personConflicts.length || relConflicts.length) {
        const queued: Conflict[] = [];
        for (const c of personConflicts) {
          const local = tree.persons.find(p => p.id === c.id);
          if (local) queued.push({ id: c.id, entityType: 'person', treeId: tree.id, local, remoteDeletedAt: c.remoteDeletedAt, type: 'delete-vs-edit' });
        }
        for (const c of relConflicts) {
          const local = tree.relationships.find(r => r.id === c.id);
          if (local) queued.push({ id: c.id, entityType: 'relationship', treeId: tree.id, local, remoteDeletedAt: c.remoteDeletedAt, type: 'delete-vs-edit' });
        }
        if (queued.length) {
          addConflicts(queued);
          const conflictIds = new Set(queued.map(c => c.id));
          treeToPush = {
            ...tree,
            persons: tree.persons.filter(p => !conflictIds.has(p.id)),
            relationships: tree.relationships.filter(r => !conflictIds.has(r.id)),
          };
        }
      }
    } catch { /* fail-open : on pousse l'arbre entier comme avant */ }
    await getDataClient().saveTree(treeToPush, user.id, isOwner);
    knownIdsRef.current = { ...knownIdsRef.current, [tree.id]: current };
  }, [user, shared]);
  const pushTreeNowRef = useRef(pushTreeNow); pushTreeNowRef.current = pushTreeNow;

  // Debounced cloud push of the active tree after any local change.
  //  • Changement implicite (settings, updateTree en bloc) → debounce 700 ms.
  //  • CRUD explicite (add/update/delete personne, relation, journal) → flush ~0 ms
  //    via immediateSyncRef, ce qui réduit à quasi néant la fenêtre de course
  //    « F5 juste après Enregistrer » (sinon le hard-replace au reload écrasait la
  //    modif locale pas encore poussée).
  const activeTreeKey = activeTree ? JSON.stringify(activeTree) : '';
  useEffect(() => {
    if (!cloud || !user || !activeTree || migrationPending) { pendingPushRef.current = null; return; }
    const treeSnapshot = activeTree;         // fresh capture each run (latest edit)
    const doPush = () => {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      pendingPushRef.current = null;         // nothing left pending once we fire
      pushInFlightRef.current = true;        // …but the write itself is now genuinely in flight
      setSyncStatus('syncing');
      // Mark before AND after the write: the realtime echo of our own push can
      // arrive either side of the REST response, so we bracket the whole window.
      lastLocalWriteRef.current = Date.now();
      return pushTreeNowRef.current(treeSnapshot)
        .then(() => { pushInFlightRef.current = false; lastLocalWriteRef.current = Date.now(); syncErrorKindRef.current = null; setSyncStatus('saved'); setLastSyncAt(Date.now()); })
        .catch((err) => { pushInFlightRef.current = false; console.error('[store] Sauvegarde cloud échouée:', err?.message ?? err); syncErrorKindRef.current = 'save'; setSyncStatus('error'); });
    };
    pendingPushRef.current = doPush;          // beforeunload can flush the latest tree
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const delay = immediateSyncRef.current ? 0 : 700;
    immediateSyncRef.current = false;
    saveTimer.current = setTimeout(doPush, delay);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTreeKey, cloud]);

  // Flush a still-pending debounced save before the tab is hidden/unloaded, so a
  // fast F5 right after an edit can't lose it (the reload hard-replace would other-
  // wise overwrite the un-pushed local edit).
  //
  // Two DIFFERENT race windows, two different remedies:
  //  1. The debounce timer hasn't fired yet (0–700 ms) → pendingPushRef still holds
  //     the push function → calling it here starts the request right away instead
  //     of losing it to the timer never getting a chance to run. This is what the
  //     old comment here meant by "best-effort" and covers the common case (the 0 ms
  //     flush on explicit CRUD already shrinks this window to almost nothing).
  //  2. The request is already IN FLIGHT (pendingPushRef was nulled the instant
  //     doPush fired — see doPush) → there is nothing left to "flush", and a
  //     network call already underway can't be force-completed synchronously.
  //     The only real lever left is `beforeunload`'s native confirmation dialog:
  //     returning a value makes the browser ask the user before actually leaving,
  //     which buys the async write the wall-clock time (typically well under a
  //     second) it needs to land. `pagehide` has no such mechanism (unload is
  //     already decided by the time it fires) — it stays a plain best-effort flush.
  useEffect(() => {
    if (!cloud) return;
    const flushOnHide = () => { pendingPushRef.current?.(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      pendingPushRef.current?.();
      if (pushInFlightRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', flushOnHide);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('pagehide', flushOnHide); };
  }, [cloud]);

  // Reload one tree from the cloud (used by realtime collaborator updates).
  const reloadTreeFromCloud = useCallback(async (treeId: string) => {
    if (!cloud) return;
    const fresh = await getDataClient().loadOneTree(treeId);
    if (fresh) {
      setTrees(prev => prev.map(t => t.id === treeId ? fresh : t));
      localCacheRef.current = localCacheRef.current.map(t => t.id === treeId ? fresh : t);
      knownIdsRef.current = { ...knownIdsRef.current, [treeId]: treeIdSets(fresh) };
    }
  }, [cloud]);

  // Force a full resync: wipe the local cache (localStorage + IndexedDB) and reload
  // everything from Supabase. Lets the user pull SQL-side changes on demand without
  // manually clearing storage. Returns true on success.
  const resync = useCallback(async (): Promise<boolean> => {
    if (!cloud || !user) return false;
    setSyncStatus('syncing');
    // Validate/refresh the session ONCE up-front (lock-serialised) so the data
    // queries below reuse a fresh access token instead of each triggering its own
    // refresh. On a stale token that contention can end in a failed refresh and a
    // spurious SIGNED_OUT — the "Se connecter réapparaît après resync" symptom. If
    // the session is genuinely gone, abort cleanly instead of firing a storm of
    // authenticated calls. (resync NEVER touches auth: it only clears the trees
    // cache — localStorage 'suimini_trees' + the IndexedDB 'trees' store — never the
    // Supabase session, which lives in cookies.)
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSyncStatus('error'); return false; }
    }
    try {
      const { trees: remote, shared: sharedMeta } = await getDataClient().loadTrees(user.id);
      // EMPTY-RESULT GUARD: an empty result is almost always the RLS token-not-ready
      // race (the initial loader retries 3× for exactly this), not a genuinely empty
      // account. NEVER destroy the local cache / blank the screen on []. Keep what we
      // have and report failure so the caller can surface a retry. A real "all trees
      // deleted" propagates through the explicit delete flow, not through resync.
      if (remote.length === 0) {
        console.warn('[store] Resync a renvoyé 0 arbre — probablement un jeton non prêt ; cache local conservé.');
        setSyncStatus('error');
        return false;
      }
      try {
        await offlineStorage.clear();              // IndexedDB 'trees' store only
        localStorage.removeItem(STORAGE_KEY);      // 'suimini_trees' only — never the auth cookie
        for (const t of remote) await offlineStorage.setTree(t);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      } catch { /* cache unavailable — non-fatal */ }
      localCacheRef.current = remote;
      setShared(sharedMeta);
      setTrees(remote);
      rememberKnownIds(remote);
      setActiveTreeId(prev => (remote.find(t => t.id === prev) ? prev : remote[0]?.id || null));
      setMigrationPending(false);
      setLastSyncAt(Date.now());
      syncErrorKindRef.current = null;
      setSyncStatus('saved');
      return true;
    } catch (err) {
      console.error('[store] Resync échouée:', err);
      syncErrorKindRef.current = 'load';
      setSyncStatus('error');
      return false;
    }
  }, [cloud, user, rememberKnownIds]);

  // Re-push the active tree (used to recover from a failed debounced SAVE without a
  // destructive pull). Returns true on success.
  const pushActiveTree = useCallback(async (): Promise<boolean> => {
    if (!cloud || !user) return false;
    const tree = trees.find(t => t.id === activeTreeId);
    if (!tree) return false;
    setSyncStatus('syncing');
    try {
      await pushTreeNow(tree);
      lastLocalWriteRef.current = Date.now();
      syncErrorKindRef.current = null;
      setSyncStatus('saved');
      setLastSyncAt(Date.now());
      return true;
    } catch (err) {
      console.error('[store] Re-push échoué:', err);
      syncErrorKindRef.current = 'save';
      setSyncStatus('error');
      return false;
    }
  }, [cloud, user, trees, activeTreeId, pushTreeNow]);

  // Context-aware retry for the in-app error banner: a failed SAVE re-pushes (keeps
  // the local edit), a failed LOAD re-pulls. Never pull-replaces over a pending edit.
  const retrySync = useCallback(async (): Promise<boolean> => {
    return syncErrorKindRef.current === 'save' ? pushActiveTree() : resync();
  }, [pushActiveTree, resync]);

  // ── Résolution des conflits multi-appareils (delete-vs-edit) ─────────────────
  // « Garder la suppression » : on accepte la suppression distante. L'entité est
  // encore locale (elle a été exclue du push, pas retirée du state) → on la retire
  // du cache local du bon arbre (ciblé par conflict.treeId, pas seulement l'actif) et
  // on l'inscrit en suppression durable pour re-confirmer la tombstone au prochain
  // push et empêcher toute résurrection par le merge.
  const resolveConflictKeepDeletion = useCallback((conflict: Conflict): void => {
    recordDeletedIds([conflict.id]);
    addPendingDeletes(conflict.entityType === 'person'
      ? { persons: [conflict.id] } : { relationships: [conflict.id] });
    const nowIso = new Date().toISOString();
    const updated = trees.map(t => {
      if (t.id !== conflict.treeId) return t;
      if (conflict.entityType === 'person') {
        return {
          ...t, updatedAt: nowIso,
          persons: t.persons.filter(p => p.id !== conflict.id),
          relationships: t.relationships.filter(r => r.person1Id !== conflict.id && r.person2Id !== conflict.id),
        };
      }
      return { ...t, updatedAt: nowIso, relationships: t.relationships.filter(r => r.id !== conflict.id) };
    });
    persist(updated);
    // Retire le knownId pour éviter un diff-suppression fantôme ultérieur.
    const set = knownIdsRef.current[conflict.treeId];
    if (set) {
      if (conflict.entityType === 'person') set.persons.delete(conflict.id);
      else set.relationships.delete(conflict.id);
    }
  }, [trees, persist]);

  // « Restaurer » : on ré-upserte l'entité locale VIVANTE (deleted_at:null), ce qui
  // écrase la tombstone distante. On nettoie recent/pending-deletes pour que la
  // restauration « colle », et on bump l'updatedAt local (personne) pour qu'une future
  // détection voie NOTRE édition comme plus récente que la tombstone.
  const restoreConflictEntity = useCallback(async (conflict: Conflict): Promise<boolean> => {
    if (!user) return false;
    clearRecentDeletedId(conflict.id);
    clearPendingDeletes('persons', [conflict.id]);
    clearPendingDeletes('relationships', [conflict.id]);
    const nowIso = new Date().toISOString();
    let entity: Person | Relationship = conflict.local;
    if (conflict.entityType === 'person') {
      const updated = trees.map(t => {
        if (t.id !== conflict.treeId) return t;
        return { ...t, persons: t.persons.map(p => (p.id === conflict.id ? { ...p, updatedAt: nowIso } : p)) };
      });
      const found = updated.find(t => t.id === conflict.treeId)?.persons.find(p => p.id === conflict.id);
      if (found) { entity = found; persist(updated); }
      else entity = { ...(conflict.local as Person), updatedAt: nowIso };
    } else {
      entity = trees.find(t => t.id === conflict.treeId)?.relationships.find(r => r.id === conflict.id) ?? conflict.local;
    }
    try {
      await getDataClient().restoreEntity(conflict.treeId, conflict.entityType, entity);
      return true;
    } catch (err) {
      console.error('[store] Restauration du conflit échouée:', err);
      return false;
    }
  }, [user, trees, persist]);

  // Refs of the latest sync state so the visibility listener stays subscribed once
  // (no re-bind on every status tick) while still reading fresh values.
  const syncStatusRef = useRef(syncStatus); syncStatusRef.current = syncStatus;
  const lastSyncRef = useRef(lastSyncAt); lastSyncRef.current = lastSyncAt;

  // Stale-cache guard: when the tab regains focus and the last successful cloud sync
  // is older than STALE_MS, silently pull fresh data (Supabase always wins). Never
  // fires mid-sync, and NEVER while a save is pending in error (a pull would discard
  // the unsynced local edit). resync() revalidates the session and keeps the cache on
  // an empty result, so a token-not-ready race can't blank the screen.
  useEffect(() => {
    if (!cloud) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || syncStatusRef.current === 'syncing') return;
      if (syncErrorKindRef.current === 'save') return; // unsynced edit pending — don't pull
      const last = lastSyncRef.current;
      if (last != null && Date.now() - last > STALE_MS) {
        console.info('[store] Cache périmé → resync au retour de focus (canal Realtime inopérant depuis le passage à Railway).');
        resync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [cloud, resync]);

  // Migrate local trees to the cloud (on user confirmation).
  const runMigration = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      for (const t of localCacheRef.current) await getDataClient().saveTree(t, user.id, true);
      rememberKnownIds(localCacheRef.current);
      setMigrationPending(false);
      try { localStorage.setItem(IMPORT_DONE_KEY, 'true'); } catch { /* ignore */ }
      setSyncStatus('saved');
    } catch {
      setSyncStatus('offline');
    }
  }, [user, rememberKnownIds]);

  const dismissMigration = useCallback(() => {
    setMigrationPending(false);
    try { localStorage.setItem(IMPORT_DISMISSED_KEY, 'true'); } catch { /* ignore */ }
  }, []);

  // updateTree is the primitive used by every editing action — it records history.
  const updateTreeWithHistory = useCallback((updatedTree: FamilyTree, description: string, immediate = false) => {
    // Explicit CRUD passes immediate=true → the debounced cloud push fires at 0 ms
    // instead of 700 ms (see the push effect). Bulk/implicit edits keep the debounce.
    if (immediate) immediateSyncRef.current = true;
    const updated = trees.map(t => t.id === updatedTree.id ? { ...updatedTree, updatedAt: new Date().toISOString() } : t);
    commit(updated, description);
  }, [trees, commit]);

  // Public updateTree (non-history) kept for compatibility — also records history.
  const updateTree = useCallback((updatedTree: FamilyTree) => {
    updateTreeWithHistory(updatedTree, `Modification de l'arbre`);
  }, [updateTreeWithHistory]);

  const createTree = useCallback((name: string, description?: string) => {
    const newTree: FamilyTree = {
      id: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      persons: [],
      relationships: [],
      settings: {
        defaultView: 'tree',
        showPhotos: true,
        showDates: true,
        showPlaces: true,
        colorScheme: 'default',
        generationsToShow: 5,
      },
    };
    const updated = [...trees, newTree];
    persist(updated);
    setActiveTreeId(newTree.id);
    localStorage.setItem(ACTIVE_TREE_KEY, newTree.id);
    return newTree;
  }, [trees, persist]);

  const deleteTree = useCallback((treeId: string) => {
    const updated = trees.filter(t => t.id !== treeId);
    persist(updated);
    // Prune the offline cache too. `persist` only UPSERTS the remaining trees into
    // IndexedDB, so without this the deleted tree survives in IDB and the local-load
    // effect (which reads IDB first) resurrects it on the next visit — the root cause
    // of "impossible de supprimer un arbre".
    offlineStorage.deleteTree(treeId).catch(() => {});
    // L'arbre n'existe plus : oublier ses ids connus (sinon un futur push d'un
    // arbre recréé avec le même id diffuserait des suppressions fantômes).
    const { [treeId]: _gone, ...rest } = knownIdsRef.current; void _gone;
    knownIdsRef.current = rest;
    if (cloud && user) {
      getDataClient().deleteTree(treeId, user.id)
        .then(({ error }) => { if (error) console.error('[store] Suppression cloud échouée:', error); })
        .catch((err) => console.error('[store] Suppression cloud échouée:', err?.message ?? err));
    }
    if (activeTreeId === treeId) {
      const newActive = updated[0]?.id || null;
      setActiveTreeId(newActive);
      if (newActive) localStorage.setItem(ACTIVE_TREE_KEY, newActive);
      else localStorage.removeItem(ACTIVE_TREE_KEY);
    }
  }, [trees, persist, activeTreeId, cloud, user]);

  const switchTree = useCallback((treeId: string) => {
    setActiveTreeId(treeId);
    localStorage.setItem(ACTIVE_TREE_KEY, treeId);
  }, []);

  // Rename / edit description of any tree (undoable).
  const updateTreeMeta = useCallback((treeId: string, meta: { name?: string; description?: string }) => {
    const target = trees.find(t => t.id === treeId);
    if (!target) return;
    updateTreeWithHistory(
      { ...target, name: meta.name ?? target.name, description: meta.description ?? target.description },
      `Modification de l'arbre « ${meta.name ?? target.name} »`
    );
  }, [trees, updateTreeWithHistory]);

  // Deep-clone a tree under a new name (becomes active).
  const duplicateTree = useCallback((treeId: string, newName: string) => {
    const src = trees.find(t => t.id === treeId);
    if (!src) return null;
    const now = new Date().toISOString();
    const copy: FamilyTree = {
      ...JSON.parse(JSON.stringify(src)),
      id: generateId(),
      name: newName,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...trees, copy];
    persist(updated);
    setActiveTreeId(copy.id);
    localStorage.setItem(ACTIVE_TREE_KEY, copy.id);
    return copy;
  }, [trees, persist]);

  // Person CRUD
  const addPerson = useCallback((person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!activeTree) return null;
    const newPerson: Person = {
      ...person,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateTreeWithHistory(
      { ...activeTree, persons: [...activeTree.persons, newPerson] },
      `Ajout de ${newPerson.firstName} ${newPerson.lastName}`,
      true
    );
    return newPerson;
  }, [activeTree, updateTreeWithHistory]);

  const updatePerson = useCallback((personId: string, updates: Partial<Person>) => {
    if (!activeTree) return;
    const target = activeTree.persons.find(p => p.id === personId);
    const persons = activeTree.persons.map(p =>
      p.id === personId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    updateTreeWithHistory(
      { ...activeTree, persons },
      `Modification de ${target ? getDisplayName(target) : 'la personne'}`,
      true
    );
  }, [activeTree, updateTreeWithHistory]);

  const deletePerson = useCallback((personId: string) => {
    if (!activeTree) return;
    const target = activeTree.persons.find(p => p.id === personId);
    const persons = activeTree.persons.filter(p => p.id !== personId);
    const removedRelIds = activeTree.relationships
      .filter(r => r.person1Id === personId || r.person2Id === personId)
      .map(r => r.id);
    const relationships = activeTree.relationships.filter(
      r => r.person1Id !== personId && r.person2Id !== personId
    );
    // Remember the deletion so a reload within the favour-local window can't resurrect
    // this person (or its relations) from a not-yet-committed remote row. La
    // propagation serveur (soft-delete durable) est faite par le push immédiat
    // (0 ms) déclenché juste dessous — voir pushTreeNow.
    recordDeletedIds([personId, ...removedRelIds]);
    updateTreeWithHistory(
      { ...activeTree, persons, relationships },
      `Suppression de ${target ? getDisplayName(target) : 'la personne'}`,
      true
    );
  }, [activeTree, updateTreeWithHistory]);

  // Relationship CRUD
  const addRelationship = useCallback((rel: Omit<Relationship, 'id'>) => {
    if (!activeTree) return null;
    const newRel: Relationship = { ...rel, id: generateId() };
    updateTreeWithHistory(
      { ...activeTree, relationships: [...activeTree.relationships, newRel] },
      `Ajout d'une relation`,
      true
    );
    return newRel;
  }, [activeTree, updateTreeWithHistory]);

  const updateRelationship = useCallback((relId: string, updates: Partial<Relationship>) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.map(r =>
      r.id === relId ? { ...r, ...updates } : r
    );
    updateTreeWithHistory({ ...activeTree, relationships }, `Modification d'une relation`, true);
  }, [activeTree, updateTreeWithHistory]);

  const deleteRelationship = useCallback((relId: string) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.filter(r => r.id !== relId);
    recordDeletedIds([relId]); // propagation serveur via le push immédiat (pushTreeNow)
    updateTreeWithHistory(
      { ...activeTree, relationships },
      `Suppression d'une relation`,
      true
    );
  }, [activeTree, updateTreeWithHistory]);

  // Journal CRUD
  const addJournalEntry = useCallback((entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!activeTree) return null;
    const now = new Date().toISOString();
    const newEntry: JournalEntry = { ...entry, id: generateId(), createdAt: now, updatedAt: now };
    updateTreeWithHistory(
      { ...activeTree, journal: [...(activeTree.journal || []), newEntry] },
      `Ajout d'une entrée de journal`,
      true
    );
    return newEntry;
  }, [activeTree, updateTreeWithHistory]);

  const updateJournalEntry = useCallback((id: string, updates: Partial<JournalEntry>) => {
    if (!activeTree) return;
    const journal = (activeTree.journal || []).map(e =>
      e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
    );
    updateTreeWithHistory({ ...activeTree, journal }, `Modification d'une entrée de journal`, true);
  }, [activeTree, updateTreeWithHistory]);

  const deleteJournalEntry = useCallback((id: string) => {
    if (!activeTree) return;
    recordDeletedIds([id]); // propagation serveur via le push immédiat (pushTreeNow)
    updateTreeWithHistory(
      { ...activeTree, journal: (activeTree.journal || []).filter(e => e.id !== id) },
      `Suppression d'une entrée de journal`,
      true
    );
  }, [activeTree, updateTreeWithHistory]);

  const importTree = useCallback((tree: FamilyTree) => {
    const imported = { ...tree, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [...trees, imported];
    persist(updated);
    setActiveTreeId(imported.id);
    localStorage.setItem(ACTIVE_TREE_KEY, imported.id);
  }, [trees, persist]);

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setFuture(f => [...f, { trees, description: snapshot.description }]);
      persist(snapshot.trees);
      return prev.slice(0, -1);
    });
  }, [trees, persist]);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setPast(p => [...p, { trees, description: snapshot.description }]);
      persist(snapshot.trees);
      return prev.slice(0, -1);
    });
  }, [trees, persist]);

  return {
    trees,
    activeTree,
    activeTreeId,
    loaded,
    createTree,
    deleteTree,
    switchTree,
    updateTree,
    updateTreeMeta,
    duplicateTree,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    importTree,
    // history
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    lastAction: past.length > 0 ? past[past.length - 1].description : null,
    nextAction: future.length > 0 ? future[future.length - 1].description : null,
    // cloud sync
    cloud,
    syncStatus,
    shared,
    migrationPending,
    runMigration,
    dismissMigration,
    reloadTreeFromCloud,
    lastLocalWriteRef,
    resync,
    retrySync,
    lastSyncAt,
    // multi-device conflict resolution
    resolveConflictKeepDeletion,
    restoreConflictEntity,
  };
}
