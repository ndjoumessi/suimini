'use client';
import { useState, useMemo } from 'react';
import { FamilyTree, Person } from '@/types';
import {
  getDisplayName, formatYear, getAllAncestors, getAllDescendants,
  findCommonAncestors, findRelationPath, describeRelation, getAge
} from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

export default function AncestorsView({ tree, onSelectPerson }: Props) {
  const [person1Id, setPerson1Id] = useState('');
  const [person2Id, setPerson2Id] = useState('');
  const [mode, setMode] = useState<'relation' | 'compare' | 'ancestors' | 'descendants'>('relation');
  const dual = mode === 'relation' || mode === 'compare';

  const person1 = tree.persons.find(p => p.id === person1Id) || null;
  const person2 = tree.persons.find(p => p.id === person2Id) || null;

  const relationPath = useMemo(() => {
    if (!person1Id || !person2Id || !dual) return null;
    return findRelationPath(person1Id, person2Id, tree.relationships, tree.persons);
  }, [person1Id, person2Id, tree, dual]);

  const relation = useMemo(() => {
    if (!relationPath || !person1Id || !person2Id) return null;
    return describeRelation(person1Id, person2Id, relationPath, tree.relationships, tree.persons);
  }, [relationPath, person1Id, person2Id, tree]);

  const commonAncestors = useMemo(() => {
    if (!person1Id || !person2Id || !dual) return [];
    return findCommonAncestors(person1Id, person2Id, tree.relationships, tree.persons);
  }, [person1Id, person2Id, tree, dual]);

  const ancestors = useMemo(() => {
    if (!person1Id || mode !== 'ancestors') return [];
    return getAllAncestors(person1Id, tree.relationships, tree.persons);
  }, [person1Id, tree, mode]);

  const descendants = useMemo(() => {
    if (!person1Id || mode !== 'descendants') return [];
    return getAllDescendants(person1Id, tree.relationships, tree.persons);
  }, [person1Id, tree, mode]);

  const pathPersons = useMemo(() => {
    if (!relationPath) return [];
    return relationPath.map(id => tree.persons.find(p => p.id === id)).filter(Boolean) as Person[];
  }, [relationPath, tree]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h2 className="serif" style={{ margin: '0 0 10px', fontSize: '1.1rem' }}>
          🔍 Exploration familiale
        </h2>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {(['relation','compare','ancestors','descendants'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="btn btn-sm"
              style={{
                background: mode === m ? 'var(--accent)' : 'var(--bg-muted)',
                color: mode === m ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {{ relation: '🔗 Lien de parenté', compare: '⚖️ Comparer', ancestors: '🌲 Ancêtres', descendants: '🌱 Descendants' }[m]}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {dual ? 'Personne A' : 'Personne'}
            </label>
            <select value={person1Id} onChange={e => setPerson1Id(e.target.value)} className="input">
              <option value="">Choisir...</option>
              {tree.persons.map(p => (
                <option key={p.id} value={p.id}>{getDisplayName(p)} {p.birthDate ? `(${formatYear(p.birthDate)})` : ''}</option>
              ))}
            </select>
          </div>

          {dual && (
            <>
              <div style={{ color: 'var(--text-muted)', fontSize: '20px', paddingTop: '20px' }}>⟷</div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Personne B
                </label>
                <select value={person2Id} onChange={e => setPerson2Id(e.target.value)} className="input">
                  <option value="">Choisir...</option>
                  {tree.persons.filter(p => p.id !== person1Id).map(p => (
                    <option key={p.id} value={p.id}>{getDisplayName(p)} {p.birthDate ? `(${formatYear(p.birthDate)})` : ''}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* RELATION MODE */}
        {mode === 'relation' && person1Id && person2Id && (
          <div className="animate-fade-in">
            {/* Relation result */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                <PersonBubble person={person1} onClick={() => person1 && onSelectPerson(person1.id)} />
                <div style={{ textAlign: 'center' }}>
                  {relation ? (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔗</div>
                      <div style={{ 
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        padding: '6px 14px', borderRadius: '100px',
                        fontWeight: '700', fontSize: '14px', border: '1px solid var(--accent)',
                      }}>
                        {relation}
                      </div>
                      {relationPath && (
                        <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                          {relationPath.length - 1} degré{relationPath.length > 2 ? 's' : ''} de parenté
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px' }}>
                      ⚠️ Aucun lien familial trouvé
                    </div>
                  )}
                </div>
                <PersonBubble person={person2!} onClick={() => onSelectPerson(person2!.id)} />
              </div>
            </div>

            {/* Path */}
            {pathPersons.length > 2 && (
              <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Chemin de parenté</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {pathPersons.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => onSelectPerson(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: '100px', background: 'var(--bg-muted)',
                          cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-muted)'; }}
                      >
                        <span>{p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑'}</span>
                        <span>{getDisplayName(p)}</span>
                      </button>
                      {i < pathPersons.length - 1 && (
                        <span style={{ color: 'var(--text-light)', fontSize: '16px' }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common ancestors */}
            {commonAncestors.length > 0 && (
              <div className="card" style={{ padding: '16px' }}>
                <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>
                  Ancêtres communs ({commonAncestors.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {commonAncestors.map(p => (
                    <PersonCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPARE MODE */}
        {mode === 'compare' && person1 && person2 && (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '12px' }}>
              <PersonBubble person={person1} onClick={() => onSelectPerson(person1.id)} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', marginBottom: '4px' }}>⚖️</div>
                {relation
                  ? <span className="badge badge-accent" style={{ fontSize: '12px' }}>{relation}</span>
                  : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Aucun lien direct</span>}
              </div>
              <PersonBubble person={person2} onClick={() => onSelectPerson(person2.id)} />
            </div>

            {/* Attribute comparison */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 className="serif" style={{ margin: '0 0 4px', fontSize: '1rem' }}>Comparaison des fiches</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '12px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'var(--success)', verticalAlign: 'middle', marginRight: '4px' }} /> point commun
                &nbsp;·&nbsp; valeurs différentes en neutre
              </div>
              {COMPARE_FIELDS.map(f => {
                const a = f.get(person1); const b = f.get(person2);
                const same = !!a && !!b && a.toLowerCase() === b.toLowerCase();
                return <CompareRow key={f.label} label={f.label} a={a} b={b} same={same} />;
              })}
            </div>

            {/* DNA comparison */}
            {((person1.dnaOrigins?.length || 0) > 0 || (person2.dnaOrigins?.length || 0) > 0) && (() => {
              const regionsA = new Set((person1.dnaOrigins || []).map(d => d.region.toLowerCase()));
              const regionsB = new Set((person2.dnaOrigins || []).map(d => d.region.toLowerCase()));
              const chip = (region: string, percent: number, shared: boolean) => (
                <span key={region} className="badge" style={{ background: shared ? 'var(--success)' : 'var(--bg-muted)', color: shared ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {region} {Math.round(percent)}%
                </span>
              );
              return (
                <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>🧬 Origines &amp; ADN</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignContent: 'flex-start' }}>
                      {(person1.dnaOrigins || []).length === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>—</span>
                        : (person1.dnaOrigins || []).map(d => chip(d.region, d.percent, regionsB.has(d.region.toLowerCase())))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignContent: 'flex-start' }}>
                      {(person2.dnaOrigins || []).length === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>—</span>
                        : (person2.dnaOrigins || []).map(d => chip(d.region, d.percent, regionsA.has(d.region.toLowerCase())))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Common ancestors */}
            <div className="card" style={{ padding: '16px' }}>
              <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>
                Ancêtres communs ({commonAncestors.length})
              </h3>
              {commonAncestors.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Aucun ancêtre commun trouvé.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {commonAncestors.map(p => <PersonCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANCESTORS MODE */}
        {mode === 'ancestors' && person1Id && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                <strong>{ancestors.length}</strong> ancêtres trouvés pour{' '}
                <strong>{getDisplayName(person1!)}</strong>
              </div>
            </div>
            {ancestors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Aucun ancêtre enregistré
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {ancestors.map(p => (
                  <PersonCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* DESCENDANTS MODE */}
        {mode === 'descendants' && person1Id && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                <strong>{descendants.length}</strong> descendant{descendants.length !== 1 ? 's' : ''} trouvé{descendants.length !== 1 ? 's' : ''} pour{' '}
                <strong>{getDisplayName(person1!)}</strong>
              </div>
            </div>
            {descendants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Aucun descendant enregistré
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {descendants.map(p => (
                  <PersonCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {(!person1Id || (dual && !person2Id)) && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {{ relation: '🔗', compare: '⚖️', ancestors: '🌲', descendants: '🌱' }[mode]}
            </div>
            <p>{!person1Id
              ? 'Sélectionnez une personne pour commencer'
              : 'Sélectionnez une seconde personne à comparer'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonBubble({ person, onClick }: { person: Person | null; onClick: () => void }) {
  if (!person) return <div style={{ width: '80px' }} />;
  return (
    <button onClick={onClick} style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 6px',
        background: person.gender === 'male' ? '#deeaf5' : person.gender === 'female' ? '#f5dde8' : 'var(--bg-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
        overflow: 'hidden',
        border: `3px solid ${person.gender === 'male' ? 'var(--male)' : person.gender === 'female' ? 'var(--female)' : 'var(--border)'}`,
      }}>
        {person.profilePhoto
          ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : person.gender === 'male' ? '👨' : person.gender === 'female' ? '👩' : '🧑'
        }
      </div>
      <div style={{ fontSize: '12px', fontWeight: '700' }}>{person.firstName}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{person.lastName}</div>
      {person.birthDate && <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>{formatYear(person.birthDate)}</div>}
    </button>
  );
}

function PersonCard({ person, onClick }: { person: Person; onClick: () => void }) {
  const age = getAge(person.birthDate, person.deathDate);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s',
        borderLeft: `4px solid ${person.gender === 'male' ? 'var(--male)' : person.gender === 'female' ? 'var(--female)' : 'var(--border)'}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = person.gender === 'male' ? 'var(--male)' : person.gender === 'female' ? 'var(--female)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: person.gender === 'male' ? '#deeaf5' : '#f5dde8',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        overflow: 'hidden',
      }}>
        {person.profilePhoto
          ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : person.gender === 'male' ? '👨' : person.gender === 'female' ? '👩' : '🧑'
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getDisplayName(person)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {formatYear(person.birthDate)}
          {!person.isAlive && person.deathDate && ` – ${formatYear(person.deathDate)}`}
          {age !== null && ` · ${age} ans`}
        </div>
      </div>
    </button>
  );
}

const COMPARE_FIELDS: { label: string; get: (p: Person) => string }[] = [
  { label: 'Sexe', get: p => p.gender === 'male' ? 'Homme' : p.gender === 'female' ? 'Femme' : p.gender === 'other' ? 'Autre' : '' },
  { label: 'Naissance', get: p => formatYear(p.birthDate) },
  { label: 'Lieu de naissance', get: p => p.birthPlace?.city || '' },
  { label: 'Statut', get: p => p.isAlive ? 'Vivant' : 'Décédé' },
  { label: 'Décès', get: p => p.deathDate ? formatYear(p.deathDate) : '' },
  { label: 'Lieu de décès', get: p => p.deathPlace?.city || '' },
  { label: 'Profession', get: p => p.occupation || '' },
  { label: 'Nationalité', get: p => p.nationality || '' },
  { label: 'Religion', get: p => p.religion || '' },
];

function CompareRow({ label, a, b, same }: { label: string; a: string; b: string; same: boolean }) {
  const cell = (v: string): React.CSSProperties => ({
    flex: 1, padding: '6px 10px', fontSize: '13px', fontWeight: 600,
    background: same ? 'var(--success)' : 'var(--bg-muted)',
    color: same ? '#fff' : v ? 'var(--text)' : 'var(--text-light)',
    borderRadius: 'var(--radius)', textAlign: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={cell(a)}>{a || '—'}</div>
      <div style={{ width: '120px', flexShrink: 0, textAlign: 'center', fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {same ? '✓ ' : ''}{label}
      </div>
      <div style={cell(b)}>{b || '—'}</div>
    </div>
  );
}
