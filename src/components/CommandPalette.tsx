'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { FamilyTree, ViewMode, Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree | null;
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onNavigate: (v: ViewMode) => void;
  onAddPerson: () => void;
  onImportExport: () => void;
  onPrint: () => void;
  onShare: () => void;
  onPresent: () => void;
  onTreeSelector: () => void;
}

interface CommandItem {
  id: string;
  kind: 'person' | 'view' | 'action';
  label: string;
  sublabel?: string;
  icon: string;
  run: () => void;
  searchText: string;
}

const VIEW_DEFS: { view: ViewMode; icon: string; label: string }[] = [
  { view: 'tree', icon: '🌳', label: 'Arbre' },
  { view: 'list', icon: '👥', label: 'Personnes' },
  { view: 'timeline', icon: '📅', label: 'Chronologie' },
  { view: 'map', icon: '🗺', label: 'Carte' },
  { view: 'gallery', icon: '📸', label: 'Galerie' },
  { view: 'birthdays', icon: '🎂', label: 'Anniversaires' },
  { view: 'ancestors', icon: '🔍', label: 'Exploration' },
  { view: 'statistics', icon: '📊', label: 'Statistiques' },
  { view: 'settings', icon: '⚙️', label: 'Paramètres' },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
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

export default function CommandPalette({ tree, onClose, onSelectPerson, onNavigate, onAddPerson, onImportExport, onPrint, onShare, onPresent, onTreeSelector }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions: CommandItem[] = useMemo(() => [
    { id: 'a-add', kind: 'action', label: 'Ajouter une personne', icon: '➕', searchText: 'ajouter personne nouveau membre add', run: () => { onClose(); onAddPerson(); } },
    { id: 'a-present', kind: 'action', label: 'Mode présentation', sublabel: 'Diaporama plein écran', icon: '🎬', searchText: 'presentation diaporama plein ecran slideshow', run: () => { onClose(); onPresent(); } },
    { id: 'a-import', kind: 'action', label: 'Importer / Exporter', icon: '📁', searchText: 'import export gedcom json sauvegarde', run: () => { onClose(); onImportExport(); } },
    { id: 'a-print', kind: 'action', label: 'Imprimer', icon: '🖨', searchText: 'imprimer print pdf', run: () => { onClose(); onPrint(); } },
    { id: 'a-share', kind: 'action', label: 'Partager', icon: '🔗', searchText: 'partager share lien', run: () => { onClose(); onShare(); } },
    { id: 'a-tree', kind: 'action', label: "Changer d'arbre", icon: '🌲', searchText: 'changer arbre tree selecteur', run: () => { onClose(); onTreeSelector(); } },
  ], [onClose, onAddPerson, onPresent, onImportExport, onPrint, onShare, onTreeSelector]);

  const views: CommandItem[] = useMemo(() => VIEW_DEFS.map(v => ({
    id: `v-${v.view}`, kind: 'view' as const, label: `Aller à : ${v.label}`, icon: v.icon,
    searchText: `${v.label} vue navigation aller`,
    run: () => { onClose(); onNavigate(v.view); },
  })), [onClose, onNavigate]);

  const personItems: CommandItem[] = useMemo(() => {
    if (!tree) return [];
    return tree.persons.map((p: Person) => ({
      id: `p-${p.id}`, kind: 'person' as const,
      label: getDisplayName(p),
      sublabel: [p.occupation, formatYear(p.birthDate)].filter(Boolean).join(' · ') || undefined,
      icon: p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑',
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
      const persons = personItems.filter(i => i.searchText.includes(q)).slice(0, 8);
      const acts = actions.filter(i => normalize(i.searchText).includes(q));
      const navs = views.filter(i => normalize(i.searchText).includes(q));
      if (persons.length) groups.push({ title: 'Membres', items: persons });
      if (navs.length) groups.push({ title: 'Navigation', items: navs });
      if (acts.length) groups.push({ title: 'Actions', items: acts });
    }
    return groups;
  }, [query, actions, views, personItems]);

  const flat = useMemo(() => results.flatMap(g => g.items), [results]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.run(); }
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
      <div className="animate-scale-in" onKeyDown={handleKeyDown}
        style={{ width: '92%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            placeholder="Rechercher un membre, une vue, une action…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: 'var(--text)', fontFamily: 'Lato, sans-serif' }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-light)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '8px' }}>
          {flat.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              Aucun résultat pour « {query} »
            </div>
          )}
          {results.map(group => (
            <div key={group.title} style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-light)', padding: '6px 10px 4px', fontWeight: 700 }}>{group.title}</div>
              {group.items.map(item => {
                runningIdx++;
                const idx = runningIdx;
                const isActive = idx === active;
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => item.run()}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 10px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      textAlign: 'left', fontFamily: 'Lato, sans-serif',
                    }}
                  >
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Highlight text={item.label} query={query} />
                      </div>
                      {item.sublabel && <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sublabel}</div>}
                    </div>
                    {isActive && <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>↵</span>}
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
        </div>
      </div>
    </div>
  );
}
