'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree, ViewMode, Person } from '@/types';
import { getDisplayName, formatYear, findRelationPath, describeRelation } from '@/lib/treeUtils';
import { searchPersons } from '@/lib/fuzzySearch';
import type { Locale } from '@/i18n/config';
import { useOverlay } from '@/hooks/useOverlay';
import {
  Search, SearchX, Clock, CornerDownLeft, User, UserPlus, Download, Upload, Play,
  Printer, Share2, TreePine, Users, Calendar, Map as MapIcon, Images, BookOpen, Cake, BarChart2, Settings, ScrollText,
  SlidersHorizontal, Sparkles, RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  tree: FamilyTree | null;
  trees: FamilyTree[];
  activeTreeId: string | null;
  onClose: () => void;
  /** Open a person, switching trees first if it lives in another tree. */
  onOpenPerson: (treeId: string, personId: string) => void;
  onNavigate: (v: ViewMode) => void;
  /** Undefined for viewers (read-only) → the "add person" command is hidden. */
  onAddPerson?: () => void;
  onImportExport: (tab: 'export' | 'import') => void;
  onPrint: () => void;
  onShare: () => void;
  onPresent: () => void;
  onTreeSelector: () => void;
  onNarrative: () => void;
}

interface CommandItem {
  id: string;
  kind: 'person' | 'view' | 'action';
  label: string;
  sublabel?: string;
  Icon: LucideIcon;
  run: () => void;
  searchText: string;
  treeName?: string; // for grouping cross-tree person results
  person?: Person; // for enriched person rendering
  kinship?: string; // pre-computed relation caption
  reason?: string; // AI match reason caption
  approx?: boolean; // fuzzy (Bamiléké-tolerant) match, not exact/prefix
  score?: number; // 0..1 fuzzy relevance, for the score meter
}

type GenderFilter = 'all' | 'male' | 'female';
type AliveFilter = 'all' | 'living' | 'deceased';

interface Filters {
  yearFrom: string;
  yearTo: string;
  place: string;
  gender: GenderFilter;
  alive: AliveFilter;
  hasPhotos: boolean;
}

const EMPTY_FILTERS: Filters = { yearFrom: '', yearTo: '', place: '', gender: 'all', alive: 'all', hasPhotos: false };

function filtersActive(f: Filters): boolean {
  return !!(f.yearFrom || f.yearTo || f.place.trim() || f.gender !== 'all' || f.alive !== 'all' || f.hasPhotos);
}

interface AiResult { id: string; score: number; reason: string }
type AiState = 'idle' | 'loading' | 'done' | 'error';

const VIEW_DEFS: { view: ViewMode; Icon: LucideIcon; labelKey: string }[] = [
  { view: 'tree', Icon: TreePine, labelKey: 'view.tree' },
  { view: 'list', Icon: Users, labelKey: 'view.list' },
  { view: 'timeline', Icon: Calendar, labelKey: 'view.timeline' },
  { view: 'map', Icon: MapIcon, labelKey: 'view.map' },
  { view: 'gallery', Icon: Images, labelKey: 'view.gallery' },
  { view: 'journal', Icon: BookOpen, labelKey: 'view.journal' },
  { view: 'birthdays', Icon: Cake, labelKey: 'view.birthdays' },
  { view: 'ancestors', Icon: Search, labelKey: 'view.ancestors' },
  { view: 'statistics', Icon: BarChart2, labelKey: 'view.statistics' },
  { view: 'settings', Icon: Settings, labelKey: 'view.settings' },
];

const RECENT_KEY = 'suimini_recent_searches';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function birthYear(p: Person): number | null {
  if (!p.birthDate || p.birthDate.length < 4) return null;
  const y = parseInt(p.birthDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function getInitials(p: Person): string {
  const a = (p.firstName || '').trim().charAt(0);
  const b = (p.lastName || '').trim().charAt(0);
  const init = `${a}${b}`.toUpperCase();
  return init || '?';
}

function lifeSpan(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return p.isAlive ? b : `${b} – ?`;
  if (d) return `? – ${d}`;
  return '';
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = normalize(text).indexOf(normalize(query));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-light)', color: 'inherit', borderRadius: 0, padding: '0 1px', fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** 32px square avatar: photo or initials on a tinted square (Atelier sharp corners). */
function Avatar({ person }: { person: Person }) {
  const common: React.CSSProperties = {
    width: '32px', height: '32px', flexShrink: 0, borderRadius: 0,
    border: '1.5px solid var(--border-strong)', objectFit: 'cover',
  };
  if (person.profilePhoto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.profilePhoto} alt="" style={common} aria-hidden="true" />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        ...common, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--accent-light)', color: 'var(--accent)',
        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
      }}
    >
      {getInitials(person)}
    </span>
  );
}

export default function CommandPalette({ tree, trees, activeTreeId, onClose, onOpenPerson, onNavigate, onAddPerson, onImportExport, onPrint, onShare, onPresent, onTreeSelector, onNarrative }: Props) {
  const t = useTranslations('commandPalette');
  const ts = useTranslations('search');
  const locale = useLocale() as Locale;
  const activeTreeName = trees.find(t => t.id === activeTreeId)?.name ?? null;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [aiResults, setAiResults] = useState<AiResult[] | null>(null);
  const [aiState, setAiState] = useState<AiState>('idle');
  // Message d'erreur serveur localisé (ex. 429 rate limit) ; null → ts('aiError').
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useOverlay<HTMLDivElement>(onClose);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Clear AI results whenever the query changes — AI mode is tied to the typed query.
  useEffect(() => { setAiResults(null); setAiState('idle'); }, [query]);

  function saveRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    setRecent(prev => {
      const next = [t, ...prev.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const actions: CommandItem[] = useMemo(() => [
    ...(onAddPerson ? [{ id: 'a-add', kind: 'action' as const, label: t('action.add'), Icon: UserPlus, searchText: 'ajouter personne nouveau membre add', run: () => { onClose(); onAddPerson(); } }] : []),
    { id: 'a-import', kind: 'action', label: t('action.import'), sublabel: 'JSON, GEDCOM', Icon: Download, searchText: 'importer import charger gedcom json fichier ouvrir', run: () => { onClose(); onImportExport('import'); } },
    { id: 'a-export', kind: 'action', label: t('action.export'), sublabel: 'JSON, GEDCOM', Icon: Upload, searchText: 'exporter export telecharger sauvegarde gedcom json', run: () => { onClose(); onImportExport('export'); } },
    { id: 'a-narrative', kind: 'action', label: t('action.narrative'), sublabel: t('action.narrativeSub'), Icon: ScrollText, searchText: 'rapport narratif recit histoire ia genere texte resume biographie', run: () => { onClose(); onNarrative(); } },
    { id: 'a-present', kind: 'action', label: t('action.present'), sublabel: t('action.presentSub'), Icon: Play, searchText: 'presentation diaporama plein ecran slideshow', run: () => { onClose(); onPresent(); } },
    { id: 'a-print', kind: 'action', label: t('action.print'), Icon: Printer, searchText: 'imprimer print pdf', run: () => { onClose(); onPrint(); } },
    { id: 'a-share', kind: 'action', label: t('action.share'), Icon: Share2, searchText: 'partager share lien', run: () => { onClose(); onShare(); } },
    { id: 'a-tree', kind: 'action', label: t('action.switchTree'), Icon: TreePine, searchText: 'changer arbre tree selecteur', run: () => { onClose(); onTreeSelector(); } },
  ], [t, onClose, onAddPerson, onPresent, onImportExport, onPrint, onShare, onTreeSelector, onNarrative]);

  const views: CommandItem[] = useMemo(() => VIEW_DEFS.map(v => {
    const viewLabel = t(v.labelKey);
    return {
      id: `v-${v.view}`, kind: 'view' as const, label: t('view.goTo', { view: viewLabel }), Icon: v.Icon,
      searchText: `${viewLabel} vue navigation aller`,
      run: () => { onClose(); onNavigate(v.view); },
    };
  }), [t, onClose, onNavigate]);

  // Kinship caption for a person relative to its tree's root. Skips root + unreachable.
  const kinshipFor = useCallback((host: FamilyTree, p: Person): string | undefined => {
    const rootId = host.rootPersonId || host.persons[0]?.id;
    if (!rootId || rootId === p.id) return undefined;
    const path = findRelationPath(rootId, p.id, host.relationships, host.persons);
    if (!path) return undefined;
    const label = describeRelation(rootId, p.id, path, host.relationships, host.persons, locale);
    const root = host.persons.find(x => x.id === rootId);
    const rootName = root ? getDisplayName(root) : '';
    return rootName ? `${label} · ${rootName}` : label;
  }, [locale]);

  // Persons across ALL trees, tagged with their tree for grouping + enriched fields.
  const personItems: CommandItem[] = useMemo(() => {
    return trees.flatMap(host => host.persons.map((p: Person) => ({
      id: `p-${host.id}-${p.id}`, kind: 'person' as const,
      label: getDisplayName(p),
      sublabel: [p.occupation, formatYear(p.birthDate)].filter(Boolean).join(' · ') || undefined,
      Icon: User,
      treeName: host.name,
      person: p,
      kinship: kinshipFor(host, p),
      searchText: normalize(`${getDisplayName(p)} ${p.maidenName || ''} ${p.occupation || ''} ${(p.tags || []).join(' ')} ${host.name} ${p.birthPlace?.city || ''} ${p.birthPlace?.country || ''}`),
      run: () => { onClose(); onOpenPerson(host.id, p.id); },
    })));
  }, [trees, onClose, onOpenPerson, kinshipFor]);

  // Apply structured filters (compose with text query). Operates on the Person behind each item.
  const matchesFilters = useCallback((p: Person): boolean => {
    if (filters.yearFrom) {
      const y = birthYear(p);
      if (y === null || y < parseInt(filters.yearFrom, 10)) return false;
    }
    if (filters.yearTo) {
      const y = birthYear(p);
      if (y === null || y > parseInt(filters.yearTo, 10)) return false;
    }
    if (filters.place.trim()) {
      const needle = normalize(filters.place.trim());
      const hay = normalize(`${p.birthPlace?.city || ''} ${p.birthPlace?.country || ''}`);
      if (!hay.includes(needle)) return false;
    }
    if (filters.gender !== 'all' && p.gender !== filters.gender) return false;
    if (filters.alive === 'living' && !p.isAlive) return false;
    if (filters.alive === 'deceased' && p.isAlive) return false;
    if (filters.hasPhotos && !(p.profilePhoto || (p.photos && p.photos.length))) return false;
    return true;
  }, [filters]);

  const hasFilters = filtersActive(filters);

  const filteredPersons = useMemo(
    () => (hasFilters ? personItems.filter(i => i.person && matchesFilters(i.person)) : personItems),
    [personItems, hasFilters, matchesFilters],
  );

  // Group person items by tree, active tree first.
  const groupByTree = (items: CommandItem[]) => {
    const byTree = new Map<string, CommandItem[]>();
    for (const it of items) {
      const k = it.treeName || t('group.members');
      (byTree.get(k) ?? byTree.set(k, []).get(k)!).push(it);
    }
    return [...byTree.entries()]
      .sort((a, b) => (a[0] === activeTreeName ? -1 : 0) - (b[0] === activeTreeName ? -1 : 0))
      .map(([title, groupItems]) => ({ title, items: groupItems }));
  };

  // AI result rows: map ids → enriched person items, preserving API order, attaching reason.
  const aiItems: CommandItem[] | null = useMemo(() => {
    if (!aiResults) return null;
    const out: CommandItem[] = [];
    for (const r of aiResults) {
      const base = personItems.find(i => i.id === `p-${activeTreeId}-${r.id}`)
        ?? personItems.find(i => i.person?.id === r.id);
      if (base) out.push({ ...base, reason: r.reason });
    }
    return out;
  }, [aiResults, personItems, activeTreeId]);

  const results = useMemo(() => {
    const groups: { title: string; items: CommandItem[] }[] = [];

    // AI mode takes over the result region when AI results are present.
    if (aiResults) {
      groups.push({ title: ts('aiSearch'), items: aiItems ?? [] });
      return groups;
    }

    const q = normalize(query.trim());
    if (!q) {
      // When filters are active with no query, show matching persons directly.
      if (hasFilters) {
        groups.push(...groupByTree(filteredPersons.slice(0, 30)));
        return groups;
      }
      groups.push({ title: t('group.actions'), items: actions });
      groups.push({ title: t('group.navigation'), items: views });
      const activePersons = filteredPersons.filter(i => i.treeName === activeTreeName).slice(0, 6);
      if (activePersons.length) groups.push({ title: activeTreeName || t('group.members'), items: activePersons });
    } else {
      // Ranking noms bamiléké/TEDA : exact/préfixe (littéral + synonyme)
      // puis approché (Fuse, tolérant aux fautes). searchPersons est pur.
      const personsBehind = filteredPersons.map(i => i.person).filter((p): p is Person => !!p);
      const ranked = searchPersons(query, personsBehind);
      const exactNameIds = new Set(ranked.filter(r => r.kind === 'exact').map(r => r.person.id));
      const fuzzyScore = new Map(ranked.filter(r => r.kind === 'fuzzy').map(r => [r.person.id, r.score] as const));

      // EXACT : nom exact/synonyme (via searchPersons) OU substring littérale sur
      // le searchText (préserve la recherche par métier, lieu, tags, arbre, nom de
      // jeune fille). La tolérance aux FAUTES de nom passe désormais entièrement par
      // searchPersons → les vrais rapprochements flous tombent dans le groupe
      // « approché » (badge), au lieu d'être noyés en exact par l'ancien fuzzyMatch.
      const exactItems = filteredPersons.filter(i =>
        i.person && (exactNameIds.has(i.person.id) || i.searchText.includes(q)),
      );
      const exactItemIds = new Set(exactItems.map(i => i.id));

      // APPROCHÉ : matches flous par nom non déjà classés en exact.
      const approxItems = filteredPersons
        .filter(i => i.person && fuzzyScore.has(i.person.id) && !exactItemIds.has(i.id))
        .map(i => ({ ...i, approx: true, score: fuzzyScore.get(i.person!.id) }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 20);

      groups.push(...groupByTree(exactItems.slice(0, 30)));
      if (approxItems.length) groups.push({ title: ts('approxGroup'), items: approxItems });

      const navs = views.filter(i => normalize(i.searchText).includes(q));
      const acts = actions.filter(i => normalize(i.searchText).includes(q));
      if (navs.length) groups.push({ title: t('group.navigation'), items: navs });
      if (acts.length) groups.push({ title: t('group.actions'), items: acts });
    }
    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions, views, filteredPersons, hasFilters, activeTreeName, t, ts, aiResults, aiItems]);

  const flat = useMemo(() => results.flatMap(g => g.items), [results]);

  // Reset active row when the result set changes shape (avoids stale highlight).
  useEffect(() => { setActive(0); }, [aiResults, hasFilters]);

  function runItem(item: CommandItem) {
    if (query.trim()) saveRecent(query.trim());
    item.run();
  }

  async function runAiSearch() {
    const q = query.trim();
    const persons = tree?.persons ?? [];
    if (!q || persons.length === 0 || aiState === 'loading') return;
    saveRecent(q);
    setAiState('loading');
    setAiResults(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q, persons }),
      });
      const data = (await res.json().catch(() => ({}))) as { results?: AiResult[]; error?: string };
      if (!res.ok) {
        // Message serveur déjà localisé (ex. 429 rate limit « réessayez dans X min »).
        setAiErrorMsg(data?.error || null);
        setAiResults(null);
        setAiState('error');
        return;
      }
      setAiErrorMsg(null);
      setAiResults(Array.isArray(data.results) ? data.results : []);
      setAiState('done');
    } catch {
      setAiErrorMsg(null);
      setAiResults(null);
      setAiState('error');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      // Cmd/Ctrl+Enter → AI search on the current query.
      if ((e.metaKey || e.ctrlKey) && query.trim() && (tree?.persons.length ?? 0) > 0) { runAiSearch(); return; }
      if (flat[active]) runItem(flat[active]);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const aiDisabled = (tree?.persons.length ?? 0) === 0;
  let runningIdx = -1;

  const toggleBtnStyle = (on: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em',
    padding: '5px 9px', borderRadius: 0, cursor: 'pointer',
    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: on ? 'var(--accent-light)' : 'var(--bg-card)',
    color: on ? 'var(--accent)' : 'var(--text-muted)',
    fontWeight: on ? 700 : 400,
  });

  return (
    <div
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'var(--scrim)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}
    >
      <div ref={overlayRef} tabIndex={-1} className="animate-scale-in" onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-label={t('dialogLabel')}
        style={{ width: '92%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchAriaLabel')}
            // Pattern ARIA combobox : aria-activedescendant vit sur l'INPUT (l'élément
            // focalisé) — posé sur la listbox jamais focalisée, il était inopérant.
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="cp-listbox"
            aria-autocomplete="list"
            aria-activedescendant={flat.length > 0 ? `cp-opt-${active}` : undefined}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-light)', border: '1px solid var(--border)', borderRadius: 0, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Tools bar: Filters toggle + AI search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowFilters(s => !s)}
            aria-expanded={showFilters}
            style={{ ...toggleBtnStyle(showFilters || hasFilters), display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            {ts('filters')}
            {hasFilters && <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: 0 }} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={runAiSearch}
            disabled={aiDisabled || !query.trim() || aiState === 'loading'}
            style={{
              ...toggleBtnStyle(aiState === 'done' || aiState === 'loading'),
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              opacity: (aiDisabled || !query.trim()) ? 0.45 : 1,
              cursor: (aiDisabled || !query.trim() || aiState === 'loading') ? 'not-allowed' : 'pointer',
            }}
          >
            {aiState === 'loading'
              ? <LoadingSpinner size={13} />
              : <Sparkles size={13} aria-hidden="true" />}
            {aiState === 'loading' ? ts('aiSearching') : ts('aiSearch')}
          </button>

          {aiResults && (
            <span className="label" style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={11} aria-hidden="true" /> IA
            </span>
          )}
          {aiState === 'error' && (
            <span role="alert" style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: aiResults ? 0 : 'auto' }}>{aiErrorMsg || ts('aiError')}</span>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="animate-fade-in" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-muted)' }}>
            {/* Birth year range */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: '110px' }}>
                <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{ts('yearFrom')}</span>
                <input type="number" inputMode="numeric" className="input" value={filters.yearFrom}
                  onChange={e => setFilters(f => ({ ...f, yearFrom: e.target.value }))}
                  placeholder="1900" style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }} />
              </label>
              <label style={{ flex: 1, minWidth: '110px' }}>
                <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{ts('yearTo')}</span>
                <input type="number" inputMode="numeric" className="input" value={filters.yearTo}
                  onChange={e => setFilters(f => ({ ...f, yearTo: e.target.value }))}
                  placeholder="2000" style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }} />
              </label>
            </div>

            {/* Place */}
            <label style={{ display: 'block' }}>
              <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{ts('place')}</span>
              <input type="text" className="input" value={filters.place}
                onChange={e => setFilters(f => ({ ...f, place: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }} />
            </label>

            {/* Gender */}
            <div>
              <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{ts('gender')}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => setFilters(f => ({ ...f, gender: 'male' }))} style={toggleBtnStyle(filters.gender === 'male')}>{ts('male')}</button>
                <button type="button" onClick={() => setFilters(f => ({ ...f, gender: 'female' }))} style={toggleBtnStyle(filters.gender === 'female')}>{ts('female')}</button>
                <button type="button" onClick={() => setFilters(f => ({ ...f, gender: 'all' }))} style={toggleBtnStyle(filters.gender === 'all')}>{ts('all')}</button>
              </div>
            </div>

            {/* Living / Deceased */}
            <div>
              <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{ts('living')} / {ts('deceased')}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => setFilters(f => ({ ...f, alive: 'living' }))} style={toggleBtnStyle(filters.alive === 'living')}>{ts('living')}</button>
                <button type="button" onClick={() => setFilters(f => ({ ...f, alive: 'deceased' }))} style={toggleBtnStyle(filters.alive === 'deceased')}>{ts('deceased')}</button>
                <button type="button" onClick={() => setFilters(f => ({ ...f, alive: 'all' }))} style={toggleBtnStyle(filters.alive === 'all')}>{ts('all')}</button>
              </div>
            </div>

            {/* Has photos + Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
                <input type="checkbox" checked={filters.hasPhotos}
                  onChange={e => setFilters(f => ({ ...f, hasPhotos: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)', width: '15px', height: '15px' }} />
                {ts('hasPhotos')}
              </label>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                disabled={!hasFilters}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em',
                  padding: '5px 9px', borderRadius: 0, border: '1.5px solid var(--border-strong)',
                  background: 'var(--bg-card)', color: 'var(--text-muted)',
                  cursor: hasFilters ? 'pointer' : 'not-allowed', opacity: hasFilters ? 1 : 0.45,
                }}
              >
                <RotateCcw size={12} aria-hidden="true" /> {ts('clearFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Recent searches (when empty) */}
        {!query && !aiResults && recent.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Clock size={13} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
            {recent.map(r => (
              <button key={r} onClick={() => { setQuery(r); inputRef.current?.focus(); }} className="badge" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} id="cp-listbox" role="listbox" aria-label={t('dialogLabel')} style={{ overflowY: 'auto', padding: '8px' }}>
          {aiState === 'loading' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '36px 28px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <LoadingSpinner size={18} /> {ts('aiSearching')}
            </div>
          )}
          {aiState !== 'loading' && flat.length === 0 && (
            <EmptyState
              icon={SearchX}
              title={aiResults ? ts('noMatch') : (hasFilters && !query) ? ts('noMatch') : t('noResults', { query })}
            />
          )}
          {results.map(group => (
            <div key={group.title} style={{ marginBottom: '6px' }}>
              <div className="label" style={{ fontSize: '10px', color: 'var(--text-light)', padding: '6px 10px 4px' }}>{group.title}</div>
              {group.items.map(item => {
                runningIdx++;
                const idx = runningIdx;
                const isActive = idx === active;
                const isPerson = item.kind === 'person' && item.person;
                return (
                  <button
                    key={item.id}
                    id={`cp-opt-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runItem(item)}
                    style={{
                      width: '100%', display: 'flex', alignItems: isPerson ? 'flex-start' : 'center', gap: '12px',
                      padding: '9px 10px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      textAlign: 'left', fontFamily: 'var(--font-body)',
                    }}
                  >
                    {isPerson && item.person ? (
                      <Avatar person={item.person} />
                    ) : (
                      <span style={{ width: '24px', display: 'inline-flex', justifyContent: 'center', flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                        <item.Icon size={18} aria-hidden="true" />
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isPerson && item.person ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', overflow: 'hidden' }}>
                            <span style={{ fontSize: '14px', color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Highlight text={item.label} query={query} />
                            </span>
                            {lifeSpan(item.person) && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                {lifeSpan(item.person)}
                              </span>
                            )}
                          </div>
                          {item.approx && typeof item.score === 'number' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
                              <span className="label" style={{ fontSize: '9px', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '1px 5px', letterSpacing: '0.03em', flexShrink: 0 }}>
                                {ts('approxMatch')}
                              </span>
                              <span aria-hidden="true" style={{ position: 'relative', width: '48px', height: '4px', background: 'var(--border-strong)', flexShrink: 0 }}>
                                <span style={{ position: 'absolute', inset: 0, width: `${Math.round(item.score * 100)}%`, background: 'var(--accent)' }} />
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                {Math.round(item.score * 100)}%
                              </span>
                            </div>
                          )}
                          {item.person.birthPlace?.city && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.person.birthPlace.city}
                            </div>
                          )}
                          {item.kinship && (
                            <div className="label" style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ts('kinship')}: {item.kinship}
                            </div>
                          )}
                          {item.reason && (
                            <div style={{ fontSize: '11.5px', color: 'var(--accent)', marginTop: '3px', fontStyle: 'italic', whiteSpace: 'normal' }}>
                              {item.reason}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '14px', color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Highlight text={item.label} query={query} />
                          </div>
                          {item.sublabel && <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sublabel}</div>}
                        </>
                      )}
                    </div>
                    {isActive && <CornerDownLeft size={13} style={{ color: 'var(--text-light)', flexShrink: 0, marginTop: isPerson ? '3px' : 0 }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '14px', padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-light)' }}>
          <span>↑↓ {t('hint.navigate')}</span>
          <span>↵ {t('hint.open')}</span>
          <span>esc {t('hint.close')}</span>
          <span style={{ marginLeft: 'auto' }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
