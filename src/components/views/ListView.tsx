'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, SearchFilters } from '@/types';
import { searchPersons, getGeneration } from '@/lib/treeUtils';
import { UsersRound, Plus, ChevronDown, Search, List, LayoutGrid } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import PersonCard from '../person/PersonCard';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
  canEdit?: boolean;
}

const BATCH = 60;
type SortKey = 'name' | 'first' | 'birth' | 'generation';

export default function ListView({ tree, onSelectPerson, onAddPerson, canEdit = true }: Props) {
  const t = useTranslations('list');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [visibleCount, setVisibleCount] = useState(BATCH);

  // Generation index per person (for the "génération" sort).
  const genMap = useMemo(() => {
    const m = new Map<string, number>();
    tree.persons.forEach(p => getGeneration(p.id, tree.relationships, tree.persons, m));
    return m;
  }, [tree]);

  const filtered = useMemo(() => searchPersons(tree.persons, filters), [tree.persons, filters]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    if (sortBy === 'first') return a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
    if (sortBy === 'birth') return (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
    if (sortBy === 'generation') return ((genMap.get(a.id) ?? 0) - (genMap.get(b.id) ?? 0)) || a.lastName.localeCompare(b.lastName);
    return 0;
  }), [filtered, sortBy, genMap]);

  const visible = sorted.slice(0, visibleCount);

  // Quick-filter chips: gender + alive status. "Tous" clears both.
  const noFilter = filters.gender === undefined && filters.isAlive === undefined;
  const setGender = (g: SearchFilters['gender']) => setFilters(f => ({ ...f, gender: f.gender === g ? undefined : g }));
  const setAlive = (v: boolean) => setFilters(f => ({ ...f, isAlive: f.isAlive === v ? undefined : v }));
  const chips: { key: string; label: string; active: boolean; onClick: () => void }[] = [
    { key: 'all', label: t('all'), active: noFilter, onClick: () => setFilters(f => ({ ...f, gender: undefined, isAlive: undefined })) },
    { key: 'males', label: t('males'), active: filters.gender === 'male', onClick: () => setGender('male') },
    { key: 'females', label: t('females'), active: filters.gender === 'female', onClick: () => setGender('female') },
    { key: 'alive', label: t('alivePlural'), active: filters.isAlive === true, onClick: () => setAlive(true) },
    { key: 'deceased', label: t('deceasedPlural'), active: filters.isAlive === false, onClick: () => setAlive(false) },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .lv-toolbar { padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); display: flex; flex-direction: column; gap: 10px; }
        .lv-search-wrap { position: relative; display: flex; align-items: center; }
        .lv-search-ico { position: absolute; left: 12px; color: var(--accent-text); pointer-events: none; }
        .lv-search { width: 100%; height: 42px; padding: 0 12px 0 38px; background: #1A1A24; color: var(--text);
          border: 1px solid var(--border-strong); font-family: var(--font-body); font-size: 14px; border-radius: 0; }
        .lv-search::placeholder { color: var(--text-muted); }
        .lv-search:focus { outline: none; border: 2px solid var(--accent); padding-left: 37px; }

        .lv-row2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lv-chips { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
        .lv-chip { padding: 6px 12px; background: transparent; border: 1px solid var(--border-strong); color: var(--text-muted);
          font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; cursor: pointer; border-radius: 0;
          transition: border-color var(--t-fast), color var(--t-fast), background var(--t-fast); white-space: nowrap; }
        .lv-chip:hover { border-color: var(--accent); color: var(--accent-text); }
        .lv-chip-active { background: var(--accent); border-color: var(--accent); color: #12131a; font-weight: 700; }
        .lv-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .lv-sort { height: 34px; background: #1A1A24; color: var(--text); border: 1px solid var(--border-strong);
          font-family: var(--font-mono); font-size: 11px; padding: 0 8px; border-radius: 0; cursor: pointer; }
        .lv-seg { display: inline-flex; border: 1px solid var(--border-strong); flex-shrink: 0; }
        .lv-seg-btn { width: 36px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
        .lv-seg-btn + .lv-seg-btn { border-left: 1px solid var(--border-strong); }
        .lv-seg-btn:hover { color: var(--accent-text); }
        .lv-seg-active { background: var(--accent); color: #12131a; }
        .lv-add { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px;
          background: var(--accent); color: #12131a; border: 1px solid var(--accent); cursor: pointer;
          font-family: var(--font-display); font-weight: 700; font-size: 13px; border-radius: 0; transition: background var(--t-fast); }
        .lv-add:hover { background: var(--accent-hover); }
        .lv-count { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); opacity: 0.85; flex-shrink: 0; }

        /* ---- shared avatar (square, gender-coloured, Spectral initials) ---- */
        .lv-ava { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 700; font-size: 14px; overflow: hidden; border-radius: 0; }
        .lv-ava-lg { width: 48px; height: 48px; font-size: 16px; }
        .lv-ava img { width: 100%; height: 100%; object-fit: cover; }
        .lv-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); opacity: 0.9; }
        .lv-place { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); white-space: nowrap; }

        /* ---- LIST rows ---- */
        .lv-list { max-width: 820px; margin: 0 auto; border: 1px solid var(--border); border-bottom: none; }
        .lv-row { position: relative; width: 100%; display: flex; align-items: center; gap: 12px; height: 64px;
          padding: 0 14px 0 18px; background: transparent; border: none; border-bottom: 1px solid var(--border);
          text-align: left; cursor: pointer; transition: background var(--t-fast); }
        .lv-row:hover { background: #1E1E28; }
        .lv-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .lv-rbar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--bar); transition: background var(--t-fast); }
        .lv-row:hover .lv-rbar { background: var(--accent); }
        .lv-rname { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .lv-rlast { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lv-rfirst { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lv-rdates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); opacity: 0.85; flex-shrink: 0; white-space: nowrap; }
        .lv-rtags { display: flex; align-items: center; gap: 10px; flex-shrink: 0; min-width: 0; }
        .lv-dagger { font-family: var(--font-mono); font-size: 14px; color: var(--text-muted); }

        /* ---- GRID cards (2 columns) ---- */
        .lv-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; max-width: 720px; margin: 0 auto; }
        .lv-gcard { position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; min-height: 180px;
          padding: 22px 14px 16px; background: var(--bg-card); border: 1px solid var(--border); cursor: pointer; text-align: center;
          transition: border-color var(--t-fast), box-shadow var(--t-base), transform var(--t-fast); }
        .lv-gcard:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .lv-gcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .lv-gbar { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--bar); }
        .lv-gname { font-family: var(--font-display); font-size: 15px; font-weight: 600; color: var(--ink); line-height: 1.25; margin-top: 2px; }

        @media (max-width: 560px) {
          .lv-grid { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lv-gcard { transition: border-color var(--t-fast) ease; }
          .lv-gcard:hover { transform: none; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="lv-toolbar">
        <div className="lv-search-wrap">
          <Search size={16} className="lv-search-ico" aria-hidden="true" />
          <input
            className="lv-search"
            value={filters.query || ''}
            onChange={e => { setFilters(f => ({ ...f, query: e.target.value || undefined })); setVisibleCount(BATCH); }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </div>

        <div className="lv-row2">
          <div className="lv-chips" role="group" aria-label={t('filters')}>
            {chips.map(c => (
              <button key={c.key} className={`lv-chip ${c.active ? 'lv-chip-active' : ''}`}
                aria-pressed={c.active} onClick={() => { c.onClick(); setVisibleCount(BATCH); }}>
                {c.label}
              </button>
            ))}
          </div>

          <span className="lv-count">{t('peopleCount', { count: sorted.length })}</span>

          <select className="lv-sort" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} aria-label={t('sortName')}>
            <option value="name">{t('sortName')}</option>
            <option value="first">{t('sortFirst')}</option>
            <option value="birth">{t('sortBirth')}</option>
            <option value="generation">{t('sortGeneration')}</option>
          </select>

          <div className="lv-seg" role="group" aria-label="Affichage">
            <button className={`lv-seg-btn ${layout === 'list' ? 'lv-seg-active' : ''}`} aria-pressed={layout === 'list'}
              aria-label={t('viewList')} title={t('viewList')} onClick={() => setLayout('list')}><List size={16} aria-hidden="true" /></button>
            <button className={`lv-seg-btn ${layout === 'grid' ? 'lv-seg-active' : ''}`} aria-pressed={layout === 'grid'}
              aria-label={t('viewGrid')} title={t('viewGrid')} onClick={() => setLayout('grid')}><LayoutGrid size={16} aria-hidden="true" /></button>
          </div>

          {canEdit && (
            <button className="lv-add" onClick={onAddPerson}><Plus size={15} aria-hidden="true" /> {t('add')}</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {sorted.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={t('emptyTitle')}
            description={tree.persons.length === 0 ? t('emptyTree') : t('emptyNoResults')}
            action={
              (canEdit || tree.persons.length > 0)
                ? (tree.persons.length === 0
                    ? { label: t('addPerson'), onClick: onAddPerson }
                    : { label: t('resetFilters'), onClick: () => setFilters({}) })
                : undefined
            }
          />
        ) : layout === 'list' ? (
          <div className="lv-list">
            {visible.map(person => (
              <PersonCard key={person.id} person={person} onSelect={onSelectPerson} variant="row" />
            ))}
          </div>
        ) : (
          <div className="lv-grid">
            {visible.map(person => (
              <PersonCard key={person.id} person={person} onSelect={onSelectPerson} variant="grid" />
            ))}
          </div>
        )}

        {visibleCount < sorted.length && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button onClick={() => setVisibleCount(c => c + BATCH)} className="btn btn-secondary btn-sm">
              <ChevronDown size={14} aria-hidden="true" /> {t('showMore', { remaining: sorted.length - visibleCount })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
