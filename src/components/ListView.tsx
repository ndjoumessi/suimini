'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, SearchFilters } from '@/types';
import { searchPersons, getAge, formatYear, getDisplayName } from '@/lib/treeUtils';
import { UsersRound, Plus, ChevronDown, Filter, X, MapPin } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import PersonAvatar from './PersonAvatar';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
  canEdit?: boolean;
}

const BATCH = 50;

export default function ListView({ tree, onSelectPerson, onAddPerson, canEdit = true }: Props) {
  const t = useTranslations('list');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<'name' | 'birth' | 'death'>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH);

  // Memoized so filtering + sorting don't re-run on every unrelated render (large trees).
  const filtered = useMemo(() => searchPersons(tree.persons, filters), [tree.persons, filters]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    if (sortBy === 'birth') return (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
    if (sortBy === 'death') return (a.deathDate || '9999').localeCompare(b.deathDate || '9999');
    return 0;
  }), [filtered, sortBy]);

  const visible = sorted.slice(0, visibleCount);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .lv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 14px; max-width: 1080px; margin: 0 auto; }
        .lv-card { display: flex; flex-direction: column; gap: 7px; text-align: left; cursor: pointer;
          background: var(--bg-card); border: 1px solid var(--border); padding: 16px;
          transition: border-color var(--t-fast) var(--ease-out), box-shadow var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out); }
        .lv-card:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .lv-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .lv-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
        .lv-tags { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; flex-shrink: 0; }
        .lv-name { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--ink); line-height: 1.2; }
        .lv-maiden { font-weight: 400; color: var(--text-muted); font-size: 13px; }
        .lv-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); opacity: 0.9; }
        .lv-age { color: var(--text-light); }
        .lv-occ { font-family: var(--font-body); font-style: italic; font-size: 13px; color: var(--text-muted); }
        .lv-place { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-light); }
        @media (prefers-reduced-motion: reduce) { .lv-card { transition: border-color var(--t-fast) ease; } .lv-card:hover { transform: none; } }
      `}</style>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>
            {t('title')} | {tree.name}
          </h2>
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }} aria-expanded={showFilters}>
            <Filter size={14} aria-hidden="true" /> {t('filters')}
            {(() => { const n = Object.keys(filters).filter(k => filters[k as keyof SearchFilters] !== undefined).length; return n > 0 ? <span className="badge badge-accent" style={{ marginLeft: '2px' }} aria-label={t('activeFilters', { count: n })}>{n}</span> : null; })()}
          </button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="input" style={{ width: 'auto' }}>
            <option value="name">{t('sortName')}</option>
            <option value="birth">{t('sortBirth')}</option>
            <option value="death">{t('sortDeath')}</option>
          </select>
          {canEdit && <button onClick={onAddPerson} className="btn btn-primary btn-sm" style={{ gap: '6px' }}><Plus size={14} aria-hidden="true" /> {t('add')}</button>}
        </div>

        <input
          value={filters.query || ''}
          onChange={e => setFilters(f => ({ ...f, query: e.target.value || undefined }))}
          placeholder={t('searchPlaceholder')}
          className="input"
        />

        {showFilters && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="animate-fade-in">
            <select
              value={filters.gender || ''}
              onChange={e => setFilters(f => ({ ...f, gender: e.target.value as typeof filters.gender || undefined }))}
              className="input" style={{ width: 'auto' }}
            >
              <option value="">{t('allGenders')}</option>
              <option value="male">{t('males')}</option>
              <option value="female">{t('females')}</option>
              <option value="other">{t('genderOther')}</option>
            </select>
            <select
              value={filters.isAlive === undefined ? '' : filters.isAlive ? 'true' : 'false'}
              onChange={e => setFilters(f => ({ ...f, isAlive: e.target.value === '' ? undefined : e.target.value === 'true' }))}
              className="input" style={{ width: 'auto' }}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="true">{t('alivePlural')}</option>
              <option value="false">{t('deceasedPlural')}</option>
            </select>
            <input
              type="number"
              value={filters.birthYearFrom || ''}
              onChange={e => setFilters(f => ({ ...f, birthYearFrom: e.target.value ? +e.target.value : undefined }))}
              placeholder={t('bornAfter')}
              className="input" style={{ width: '120px' }}
            />
            <input
              type="number"
              value={filters.birthYearTo || ''}
              onChange={e => setFilters(f => ({ ...f, birthYearTo: e.target.value ? +e.target.value : undefined }))}
              placeholder={t('bornBefore')}
              className="input" style={{ width: '120px' }}
            />
            <input
              value={filters.birthPlace || ''}
              onChange={e => setFilters(f => ({ ...f, birthPlace: e.target.value || undefined }))}
              placeholder={t('birthPlacePlaceholder')}
              className="input" style={{ width: '160px' }}
            />
            <button onClick={() => setFilters({})} className="btn btn-ghost btn-sm" style={{ gap: '6px' }}><X size={14} aria-hidden="true" /> {t('reset')}</button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
        {t('found', { count: sorted.length })}
        {filtered.length !== tree.persons.length && ` ${t('outOf', { total: tree.persons.length })}`}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
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
        ) : (
          <div className="lv-grid">
            {visible.map((person) => {
              const age = getAge(person.birthDate, person.deathDate);
              const dates = [
                person.birthDate ? formatYear(person.birthDate) : null,
                !person.isAlive && person.deathDate ? `† ${formatYear(person.deathDate)}` : null,
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={person.id}
                  onClick={() => onSelectPerson(person.id)}
                  className="lv-card"
                  style={{ opacity: person.isAlive ? 1 : 0.82 }}
                >
                  <div className="lv-card-top">
                    <PersonAvatar person={person} size={56} />
                    <div className="lv-tags">
                      <span className={`badge badge-${person.gender === 'male' ? 'male' : person.gender === 'female' ? 'female' : 'accent'}`}>
                        {person.gender === 'male' ? t('genderMale') : person.gender === 'female' ? t('genderFemale') : t('genderOther')}
                      </span>
                      <span className={`badge badge-${person.isAlive ? 'alive' : 'deceased'}`}>
                        {person.isAlive ? t('alive') : t('deceased')}
                      </span>
                    </div>
                  </div>

                  <div className="lv-name">
                    {getDisplayName(person)}
                    {person.maidenName && <span className="lv-maiden"> ({person.maidenName})</span>}
                  </div>

                  {dates && (
                    <div className="lv-dates">
                      {dates}{age !== null && <span className="lv-age"> · {t('years', { age })}</span>}
                    </div>
                  )}

                  {person.occupation && <div className="lv-occ">{person.occupation}</div>}

                  {person.birthPlace?.city && (
                    <div className="lv-place"><MapPin size={12} aria-hidden="true" /> {person.birthPlace.city}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {visibleCount < sorted.length && (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button onClick={() => setVisibleCount(c => c + BATCH)} className="btn btn-secondary btn-sm">
              <ChevronDown size={14} /> {t('showMore', { remaining: sorted.length - visibleCount })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
