'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { FamilyTree, ViewMode, Person } from '@/types';
import { getDisplayName, formatYear, fuzzyMatch } from '@/lib/treeUtils';
import { useOverlay } from '@/hooks/useOverlay';
import {
  Search, SearchX, Clock, CornerDownLeft, User, UserPlus, Download, Upload, Play,
  Printer, Share2, TreePine, Users, Calendar, Map, Images, BookOpen, Cake, BarChart2, Settings, ScrollText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  tree: FamilyTree | null;
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onNavigate: (v: ViewMode) => void;
  onAddPerson: () => void;
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
}

const VIEW_DEFS: { view: ViewMode; Icon: LucideIcon; label: string }[] = [
  { view: 'tree', Icon: TreePine, label: 'Arbre' },
  { view: 'list', Icon: Users, label: 'Personnes' },
  { view: 'timeline', Icon: Calendar, label: 'Chronologie' },
  { view: 'map', Icon: Map, label: 'Carte' },
  { view: 'gallery', Icon: Images, label: 'Galerie' },
  { view: 'journal', Icon: BookOpen, label: 'Journal' },
  { view: 'birthdays', Icon: Cake, label: 'Anniversaires' },
  { view: 'ancestors', Icon: Search, label: 'Exploration' },
  { view: 'statistics', Icon: BarChart2, label: 'Statistiques' },
  { view: 'settings', Icon: Settings, label: 'Paramètres' },
];

const RECENT_KEY = 'suimini_recent_searches';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = normalize(text).indexOf(normalize(query));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '3px', padding: '0 1px', fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette({ tree, onClose, onSelectPerson, onNavigate, onAddPerson, onImportExport, onPrint, onShare, onPresent, onTreeSelector, onNarrative }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useOverlay<HTMLDivElement>(onClose);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
    { id: 'a-add', kind: 'action', label: 'Ajouter une personne', Icon: UserPlus, searchText: 'ajouter personne nouveau membre add', run: () => { onClose(); onAddPerson(); } },
    { id: 'a-import', kind: 'action', label: 'Importer des données', sublabel: 'JSON, GEDCOM', Icon: Download, searchText: 'importer import charger gedcom json fichier ouvrir', run: () => { onClose(); onImportExport('import'); } },
    { id: 'a-export', kind: 'action', label: "Exporter l'arbre", sublabel: 'JSON, GEDCOM', Icon: Upload, searchText: 'exporter export telecharger sauvegarde gedcom json', run: () => { onClose(); onImportExport('export'); } },
    { id: 'a-narrative', kind: 'action', label: 'Générer le rapport', sublabel: 'Récit IA de la famille', Icon: ScrollText, searchText: 'rapport narratif recit histoire ia genere texte resume biographie', run: () => { onClose(); onNarrative(); } },
    { id: 'a-present', kind: 'action', label: 'Mode présentation', sublabel: 'Diaporama plein écran', Icon: Play, searchText: 'presentation diaporama plein ecran slideshow', run: () => { onClose(); onPresent(); } },
    { id: 'a-print', kind: 'action', label: 'Imprimer', Icon: Printer, searchText: 'imprimer print pdf', run: () => { onClose(); onPrint(); } },
    { id: 'a-share', kind: 'action', label: 'Partager', Icon: Share2, searchText: 'partager share lien', run: () => { onClose(); onShare(); } },
    { id: 'a-tree', kind: 'action', label: "Changer d'arbre", Icon: TreePine, searchText: 'changer arbre tree selecteur', run: () => { onClose(); onTreeSelector(); } },
  ], [onClose, onAddPerson, onPresent, onImportExport, onPrint, onShare, onTreeSelector, onNarrative]);

  const views: CommandItem[] = useMemo(() => VIEW_DEFS.map(v => ({
    id: `v-${v.view}`, kind: 'view' as const, label: `Aller à : ${v.label}`, Icon: v.Icon,
    searchText: `${v.label} vue navigation aller`,
    run: () => { onClose(); onNavigate(v.view); },
  })), [onClose, onNavigate]);

  const personItems: CommandItem[] = useMemo(() => {
    if (!tree) return [];
    return tree.persons.map((p: Person) => ({
      id: `p-${p.id}`, kind: 'person' as const,
      label: getDisplayName(p),
      sublabel: [p.occupation, formatYear(p.birthDate)].filter(Boolean).join(' · ') || undefined,
      Icon: User,
      searchText: normalize(`${getDisplayName(p)} ${p.maidenName || ''} ${p.occupation || ''} ${(p.tags || []).join(' ')}`),
      run: () => { onClose(); onSelectPerson(p.id); },
    }));
  }, [tree, onClose, onSelectPerson]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const groups: { title: string; items: CommandItem[] }[] = [];
    if (!q) {
      groups.push({ title: 'Actions', items: actions });
      groups.push({ title: 'Navigation', items: views });
      groups.push({ title: 'Membres', items: personItems.slice(0, 6) });
    } else {
      const persons = personItems.filter(i => i.searchText.includes(q) || fuzzyMatch(i.searchText, query)).slice(0, 8);
      const acts = actions.filter(i => normalize(i.searchText).includes(q));
      const navs = views.filter(i => normalize(i.searchText).includes(q));
      if (persons.length) groups.push({ title: 'Membres', items: persons });
      if (navs.length) groups.push({ title: 'Navigation', items: navs });
      if (acts.length) groups.push({ title: 'Actions', items: acts });
    }
    return groups;
  }, [query, actions, views, personItems]);

  const flat = useMemo(() => results.flatMap(g => g.items), [results]);

  function runItem(item: CommandItem) {
    if (query.trim()) saveRecent(query.trim());
    item.run();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) runItem(flat[active]); }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let runningIdx = -1;

  return (
    <div
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(26,22,18,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}
    >
      <div ref={overlayRef} tabIndex={-1} className="animate-scale-in" onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-label="Palette de commandes"
        style={{ width: '92%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            placeholder="Rechercher un membre, une vue, une action…"
            aria-label="Rechercher"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-light)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Recent searches (when empty) */}
        {!query && recent.length > 0 && (
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
        <div ref={listRef} style={{ overflowY: 'auto', padding: '8px' }}>
          {flat.length === 0 && (
            <div style={{ padding: '36px 28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <SearchX size={40} style={{ color: 'var(--text-light)', marginBottom: '10px' }} aria-hidden="true" />
              <div style={{ fontSize: '14px' }}>Aucun résultat pour « {query} »</div>
            </div>
          )}
          {results.map(group => (
            <div key={group.title} style={{ marginBottom: '6px' }}>
              <div className="label" style={{ fontSize: '10px', color: 'var(--text-light)', padding: '6px 10px 4px' }}>{group.title}</div>
              {group.items.map(item => {
                runningIdx++;
                const idx = runningIdx;
                const isActive = idx === active;
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runItem(item)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 10px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      textAlign: 'left', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <span style={{ width: '24px', display: 'inline-flex', justifyContent: 'center', flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                      <item.Icon size={18} aria-hidden="true" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Highlight text={item.label} query={query} />
                      </div>
                      {item.sublabel && <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sublabel}</div>}
                    </div>
                    {isActive && <CornerDownLeft size={13} style={{ color: 'var(--text-light)', flexShrink: 0 }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '14px', padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-light)' }}>
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>esc fermer</span>
          <span style={{ marginLeft: 'auto' }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
