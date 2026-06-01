'use client';
import { useState } from 'react';
import { FamilyTree, SearchFilters } from '@/types';
import { searchPersons, getAge, formatYear, getDisplayName } from '@/lib/treeUtils';
import { UsersRound, Plus, ChevronDown, Filter, X, MapPin, User } from 'lucide-react';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
}

const BATCH = 50;

export default function ListView({ tree, onSelectPerson, onAddPerson }: Props) {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<'name' | 'birth' | 'death'>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH);

  const filtered = searchPersons(tree.persons, filters);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    if (sortBy === 'birth') return (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
    if (sortBy === 'death') return (a.deathDate || '9999').localeCompare(b.deathDate || '9999');
    return 0;
  });

  const visible = sorted.slice(0, visibleCount);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>
            Personnes — {tree.name}
          </h2>
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }} aria-expanded={showFilters}>
            <Filter size={14} aria-hidden="true" /> Filtres {Object.keys(filters).filter(k => filters[k as keyof SearchFilters] !== undefined).length > 0 && '●'}
          </button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="input" style={{ width: 'auto' }}>
            <option value="name">Trier : Nom</option>
            <option value="birth">Trier : Naissance</option>
            <option value="death">Trier : Décès</option>
          </select>
          <button onClick={onAddPerson} className="btn btn-primary btn-sm" style={{ gap: '6px' }}><Plus size={14} aria-hidden="true" /> Ajouter</button>
        </div>

        <input
          value={filters.query || ''}
          onChange={e => setFilters(f => ({ ...f, query: e.target.value || undefined }))}
          placeholder="Rechercher par nom, profession, biographie…"
          className="input"
        />

        {showFilters && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="animate-fade-in">
            <select
              value={filters.gender || ''}
              onChange={e => setFilters(f => ({ ...f, gender: e.target.value as typeof filters.gender || undefined }))}
              className="input" style={{ width: 'auto' }}
            >
              <option value="">Tous sexes</option>
              <option value="male">Hommes</option>
              <option value="female">Femmes</option>
              <option value="other">Autre</option>
            </select>
            <select
              value={filters.isAlive === undefined ? '' : filters.isAlive ? 'true' : 'false'}
              onChange={e => setFilters(f => ({ ...f, isAlive: e.target.value === '' ? undefined : e.target.value === 'true' }))}
              className="input" style={{ width: 'auto' }}
            >
              <option value="">Tous</option>
              <option value="true">Vivants</option>
              <option value="false">Décédés</option>
            </select>
            <input
              type="number"
              value={filters.birthYearFrom || ''}
              onChange={e => setFilters(f => ({ ...f, birthYearFrom: e.target.value ? +e.target.value : undefined }))}
              placeholder="Né après..."
              className="input" style={{ width: '120px' }}
            />
            <input
              type="number"
              value={filters.birthYearTo || ''}
              onChange={e => setFilters(f => ({ ...f, birthYearTo: e.target.value ? +e.target.value : undefined }))}
              placeholder="Né avant..."
              className="input" style={{ width: '120px' }}
            />
            <input
              value={filters.birthPlace || ''}
              onChange={e => setFilters(f => ({ ...f, birthPlace: e.target.value || undefined }))}
              placeholder="Lieu de naissance..."
              className="input" style={{ width: '160px' }}
            />
            <button onClick={() => setFilters({})} className="btn btn-ghost btn-sm" style={{ gap: '6px' }}><X size={14} aria-hidden="true" /> Réinitialiser</button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
        {sorted.length} personne{sorted.length !== 1 ? 's' : ''} trouvée{sorted.length !== 1 ? 's' : ''}
        {filtered.length !== tree.persons.length && ` sur ${tree.persons.length}`}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <UsersRound size={56} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
            <div>
              <h3 style={{ margin: '0 0 4px' }}>Aucune personne trouvée</h3>
              <p style={{ margin: 0 }}>{tree.persons.length === 0 ? 'Cet arbre est vide.' : 'Aucun résultat avec ces filtres.'}</p>
            </div>
            <button onClick={tree.persons.length === 0 ? onAddPerson : () => setFilters({})} className="btn btn-primary btn-sm">
              {tree.persons.length === 0 ? <><Plus size={14} /> Ajouter une personne</> : 'Réinitialiser les filtres'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {visible.map(person => {
              const age = getAge(person.birthDate, person.deathDate);
              return (
                <button
                  key={person.id}
                  onClick={() => onSelectPerson(person.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', background: 'var(--bg-card)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out)', opacity: person.isAlive ? 1 : 0.8,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = ''; }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {person.profilePhoto
                      ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User size={20} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getDisplayName(person)}
                      {person.maidenName && <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '12px' }}> ({person.maidenName})</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      {person.occupation || '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {person.birthDate && <span>{formatYear(person.birthDate)}</span>}
                      {!person.isAlive && person.deathDate && <span>† {formatYear(person.deathDate)}</span>}
                      {age !== null && <span>{age} ans</span>}
                      {person.birthPlace?.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} aria-hidden="true" /> {person.birthPlace.city}</span>}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    <span className={`badge badge-${person.gender === 'male' ? 'male' : person.gender === 'female' ? 'female' : 'accent'}`}>
                      {person.gender === 'male' ? '♂' : person.gender === 'female' ? '♀' : '⚧'}
                    </span>
                    <span className={`badge badge-${person.isAlive ? 'alive' : 'deceased'}`}>
                      {person.isAlive ? 'vivant' : 'décédé'}
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
              <ChevronDown size={14} /> Voir plus ({sorted.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
