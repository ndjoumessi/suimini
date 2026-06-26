'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, SearchFilters } from '@/types';
import { searchPersons, getAge, formatYear, getDisplayName } from '@/lib/treeUtils';
import { UsersRound, Plus, ChevronDown, Filter, X, MapPin, User } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

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
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-card)', maxWidth: '760px', margin: '0 auto' }}>
            {visible.map((person, idx) => {
              const age = getAge(person.birthDate, person.deathDate);
              return (
                <button
                  key={person.id}
                  onClick={() => onSelectPerson(person.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', border: 'none',
                    borderBottom: idx < visible.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background var(--t-fast) var(--ease-out)', opacity: person.isAlive ? 1 : 0.75,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Avatar — photo, else initials in the display face on terracotta */}
                  <div style={{
                    width: '44px', height: '44px', flexShrink: 0,
                    background: person.profilePhoto ? 'var(--bg-muted)' : 'var(--accent)',
                    color: '#fff', border: 'var(--bw) solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em',
                  }}>
                    {person.profilePhoto
                      ? <img src={person.profilePhoto} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : ((person.firstName?.[0] || '') + (person.lastName?.[0] || '')).toUpperCase() || <User size={20} style={{ color: '#fff' }} aria-hidden="true" />
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getDisplayName(person)}
                      {person.maidenName && <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '12px' }}> ({person.maidenName})</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      {person.occupation || '·'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {person.birthDate && <span>{formatYear(person.birthDate)}</span>}
                      {!person.isAlive && person.deathDate && <span>† {formatYear(person.deathDate)}</span>}
                      {age !== null && <span>{t('years', { age })}</span>}
                      {person.birthPlace?.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} aria-hidden="true" /> {person.birthPlace.city}</span>}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    <span className={`badge badge-${person.gender === 'male' ? 'male' : person.gender === 'female' ? 'female' : 'accent'}`}>
                      {person.gender === 'male' ? t('genderMale') : person.gender === 'female' ? t('genderFemale') : t('genderOther')}
                    </span>
                    <span className={`badge badge-${person.isAlive ? 'alive' : 'deceased'}`}>
                      {person.isAlive ? t('alive') : t('deceased')}
                    </span>
                  </div>
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
