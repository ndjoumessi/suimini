'use client';
import { useMemo } from 'react';
import { FamilyTree } from '@/types';
import { computeTreeStats, getAge, getDisplayName, formatYear } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
}

/** A restrained figure: large serif number + quiet caption, rendered inline (no tile). */
function Figure({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ minWidth: '92px' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1, color: color || 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
        {value}
      </div>
      <div className="label" style={{ marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '1px' }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, maxValue, colorFn }: { data: { label: string; value: number; color?: string }[]; maxValue: number; colorFn?: (label: string) => string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {data.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '80px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
            {item.label}
          </div>
          <div style={{ flex: 1, background: 'var(--bg-muted)', borderRadius: '100px', overflow: 'hidden', height: '18px' }}>
            <div style={{
              height: '100%',
              width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0',
              background: item.color || colorFn?.(item.label) || 'var(--accent)',
              borderRadius: '100px',
              display: 'flex', alignItems: 'center',
              transition: 'width var(--t-base) var(--ease-out)',
              paddingLeft: '6px',
            }}>
              {item.value > 0 && (
                <span style={{ fontSize: '10px', color: 'white', fontWeight: '700' }}>{item.value}</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: '700', minWidth: '24px' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function StatisticsView({ tree }: Props) {
  const stats = useMemo(() => computeTreeStats(tree), [tree]);

  // Birth decade distribution
  const decadeDist = useMemo(() => {
    const decades: Record<number, number> = {};
    tree.persons.forEach(p => {
      if (p.birthDate) {
        const decade = Math.floor(new Date(p.birthDate).getFullYear() / 10) * 10;
        decades[decade] = (decades[decade] || 0) + 1;
      }
    });
    return Object.entries(decades)
      .map(([d, v]) => ({ label: `${d}s`, value: v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tree]);

  // Occupation distribution
  const occupationDist = useMemo(() => {
    const occs: Record<string, number> = {};
    tree.persons.forEach(p => {
      const occ = p.occupation || 'Non renseigné';
      occs[occ] = (occs[occ] || 0) + 1;
    });
    return Object.entries(occs)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tree]);

  // Country distribution
  const countryDist = useMemo(() => {
    const countries: Record<string, number> = {};
    tree.persons.forEach(p => {
      const c = p.birthPlace?.country || p.birthPlace?.city || 'Inconnu';
      countries[c] = (countries[c] || 0) + 1;
    });
    return Object.entries(countries)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tree]);

  // Surname distribution
  const surnameDist = useMemo(() => {
    const surnames: Record<string, number> = {};
    tree.persons.forEach(p => {
      surnames[p.lastName] = (surnames[p.lastName] || 0) + 1;
    });
    return Object.entries(surnames)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tree]);

  const maxDecade = Math.max(...decadeDist.map(d => d.value), 1);
  const maxOcc = Math.max(...occupationDist.map(d => d.value), 1);
  const maxCountry = Math.max(...countryDist.map(d => d.value), 1);
  const maxSurname = Math.max(...surnameDist.map(d => d.value), 1);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem' }}>Statistiques — {tree.name}</h2>
      </div>

      <div style={{ padding: '20px', maxWidth: '1000px' }}>
        {/* Overview — a narrative line, then a quiet row of secondary figures (no KPI-tile wall) */}
        <div style={{ marginBottom: '28px' }}>
          <p className="serif" style={{ margin: '0 0 18px', fontSize: '1.5rem', lineHeight: 1.35, maxWidth: '34ch', textWrap: 'balance' }}>
            Votre famille compte{' '}
            <span style={{ color: 'var(--accent)' }}>{stats.totalPersons}</span>
            {stats.totalPersons > 1 ? ' personnes' : ' personne'}, sur{' '}
            <span style={{ color: 'var(--accent)' }}>{stats.totalGenerations}</span>
            {stats.totalGenerations > 1 ? ' générations' : ' génération'}.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 32px' }}>
            <Figure label="Hommes" value={stats.totalMales} color="var(--male)" />
            <Figure label="Femmes" value={stats.totalFemales} color="var(--female)" />
            <Figure label="Vivants" value={stats.totalAlive} color="var(--success)" />
            <Figure label="Défunts" value={stats.totalDeceased} color="var(--deceased)" />
            <Figure label="Relations" value={stats.totalRelationships} />
            <Figure label="Avec photo" value={stats.totalPhotos} />
            <Figure label="Événements" value={stats.totalEvents} />
            {stats.averageLifespan && (
              <Figure label="Durée de vie moy." value={stats.averageLifespan} sub="ans" />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Notable persons */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Personnes notables</h3>
            {stats.oldestPerson && (
              <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', marginBottom: '8px' }}>
                <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>Plus âgé(e)</div>
                <div style={{ fontWeight: '700' }}>{getDisplayName(stats.oldestPerson)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatYear(stats.oldestPerson.birthDate)} · {getAge(stats.oldestPerson.birthDate)} ans
                </div>
              </div>
            )}
            {stats.youngestPerson && (
              <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', marginBottom: '8px' }}>
                <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>Plus jeune</div>
                <div style={{ fontWeight: '700' }}>{getDisplayName(stats.youngestPerson)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatYear(stats.youngestPerson.birthDate)} · {getAge(stats.youngestPerson.birthDate)} ans
                </div>
              </div>
            )}
            {stats.mostCommonSurname && (
              <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>Nom le plus fréquent</div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{stats.mostCommonSurname}</div>
              </div>
            )}
          </div>

          {/* Birth decade chart */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Naissances par décennie</h3>
            {decadeDist.length > 0
              ? <BarChart data={decadeDist} maxValue={maxDecade} colorFn={() => 'var(--text-muted)'} />
              : <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Aucune donnée</p>
            }
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Occupations */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Professions</h3>
            <BarChart data={occupationDist} maxValue={maxOcc} colorFn={() => 'var(--text-muted)'} />
          </div>

          {/* Surnames */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Noms de famille</h3>
            <BarChart data={surnameDist} maxValue={maxSurname} colorFn={() => 'var(--text-muted)'} />
          </div>
        </div>

        {/* Countries */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Origines géographiques (naissance)</h3>
          <BarChart data={countryDist} maxValue={maxCountry} colorFn={() => 'var(--text-muted)'} />
        </div>

        {/* Gender ratio visual */}
        <div className="card" style={{ padding: '16px', marginTop: '16px' }}>
          <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1rem' }}>Répartition hommes / femmes</h3>
          {stats.totalPersons > 0 && (
            <div>
              <div style={{ display: 'flex', height: '32px', borderRadius: '100px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ 
                  width: `${(stats.totalMales / stats.totalPersons) * 100}%`, 
                  background: 'var(--male)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: '700'
                }}>
                  {stats.totalMales > 0 && stats.totalMales}
                </div>
                <div style={{ 
                  width: `${(stats.totalFemales / stats.totalPersons) * 100}%`, 
                  background: 'var(--female)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: '700'
                }}>
                  {stats.totalFemales > 0 && stats.totalFemales}
                </div>
                <div style={{ 
                  flex: 1, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: 'var(--text-muted)'
                }}>
                  {stats.totalPersons - stats.totalMales - stats.totalFemales > 0 && (stats.totalPersons - stats.totalMales - stats.totalFemales)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--male)' }}>{Math.round((stats.totalMales / stats.totalPersons) * 100)}% hommes</span>
                <span style={{ color: 'var(--female)' }}>{Math.round((stats.totalFemales / stats.totalPersons) * 100)}% femmes</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
