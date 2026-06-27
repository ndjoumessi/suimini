'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { computeTreeStats, getAge, formatAge, getDisplayName, formatYear, getGeneration } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
}

/** A restrained figure: large serif number + quiet caption, rendered inline (no tile). */
function Figure({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ minWidth: '92px' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: color || 'var(--accent)', fontFamily: 'var(--font-display)' }}>
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
          <div style={{ flex: 1, background: 'var(--bg-muted)', borderRadius: 0, overflow: 'hidden', height: '18px' }}>
            <div style={{
              height: '100%',
              width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0',
              background: item.color || colorFn?.(item.label) || 'var(--accent)',
              borderRadius: 0,
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

/** Quiet empty-state line, used inside every advanced section. */
function EmptyState({ text }: { text: string }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>{text}</p>;
}

/** Mono uppercase section eyebrow + serif heading. */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div className="label" style={{ color: 'var(--accent)', marginBottom: '4px' }}>{eyebrow}</div>
      <h3 className="serif" style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
    </div>
  );
}

// ---------- types for derived data ----------

interface LifespanGroup {
  key: string;        // axis label (e.g. "Gén. 2" or "1920s")
  avg: number;        // average lifespan in years
  count: number;      // qualifying persons
}

interface NameEntry {
  name: string;
  count: number;
  gender: 'male' | 'female' | 'mixed';
}

interface DecadeBucket {
  decade: number;     // e.g. 1920
  label: string;      // "1920s"
  count: number;
}

// ---------- inline-SVG charts (no external libs) ----------

/** Vertical bars: average lifespan per group, count labelled under each bar. */
function LifespanChart({ groups, ariaLabel, yearsLabel, personsLabel }: { groups: LifespanGroup[]; ariaLabel: string; yearsLabel: string; personsLabel: (n: number) => string }) {
  const W = 720, H = 260;
  const padL = 40, padR = 16, padT = 24, padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxAvg = Math.max(...groups.map(g => g.avg), 1);
  // Round the axis up to a tidy ceiling (nearest 10).
  const axisMax = Math.ceil(maxAvg / 10) * 10;
  const n = groups.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.55, 64);
  const yTicks = [0, axisMax / 2, axisMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      {/* y gridlines + labels */}
      {yTicks.map((t, i) => {
        const y = padT + plotH - (t / axisMax) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--text-light)" fontFamily="var(--font-mono, monospace)">{Math.round(t)}</text>
          </g>
        );
      })}
      {groups.map((g, i) => {
        const cx = padL + slot * i + slot / 2;
        const h = (g.avg / axisMax) * plotH;
        const y = padT + plotH - h;
        return (
          <g key={g.key}>
            <rect x={cx - barW / 2} y={y} width={barW} height={h} fill="var(--accent)" />
            {/* avg value on top of bar */}
            <text x={cx} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)" fontFamily="var(--font-display)">{g.avg}</text>
            {/* group label */}
            <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{g.key}</text>
            {/* count */}
            <text x={cx} y={H - padB + 30} textAnchor="middle" fontSize={10} fill="var(--text-light)" fontFamily="var(--font-mono, monospace)">{personsLabel(g.count)}</text>
          </g>
        );
      })}
      {/* axis line */}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth={1.5} />
      <text x={padL} y={14} fontSize={10} fill="var(--text-light)" fontFamily="var(--font-mono, monospace)">{yearsLabel}</text>
    </svg>
  );
}

/** Simple centred word cloud: font-size proportional to frequency. */
function WordCloud({ entries }: { entries: NameEntry[] }) {
  const max = Math.max(...entries.map(e => e.count), 1);
  const min = Math.min(...entries.map(e => e.count), 1);
  const sizeFor = (c: number) => {
    if (max === min) return 22;
    const t = (c - min) / (max - min);
    return Math.round(13 + t * 27); // 13px → 40px
  };
  const colorFor = (e: NameEntry) =>
    e.gender === 'male' ? 'var(--male)' : e.gender === 'female' ? 'var(--female)' : 'var(--ink)';
  // Place larger words toward the centre by sorting biggest-first then alternating sides.
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const ordered: NameEntry[] = [];
  sorted.forEach((e, i) => (i % 2 === 0 ? ordered.push(e) : ordered.unshift(e)));
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center',
      gap: '4px 16px', padding: '12px 4px', lineHeight: 1.1,
    }}>
      {ordered.map(e => (
        <span
          key={e.name}
          title={`${e.name} : ${e.count}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: `${sizeFor(e.count)}px`,
            color: colorFor(e),
            letterSpacing: '-0.01em',
          }}
        >
          {e.name}
        </span>
      ))}
    </div>
  );
}

/** Vertical bar timeline of births per decade; peak decade highlighted in terracotta. */
function DecadeTimeline({ buckets, ariaLabel }: { buckets: DecadeBucket[]; ariaLabel: string }) {
  const W = 720, H = 240;
  const padL = 32, padR = 16, padT = 24, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const peak = Math.max(...buckets.map(b => b.count));
  const n = buckets.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.62, 48);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      {buckets.map((b, i) => {
        const cx = padL + slot * i + slot / 2;
        const h = (b.count / maxCount) * plotH;
        const y = padT + plotH - h;
        const isPeak = b.count === peak && peak > 0;
        return (
          <g key={b.decade}>
            <rect x={cx - barW / 2} y={y} width={barW} height={h} fill={isPeak ? 'var(--accent)' : '#5b7fa6'} />
            {b.count > 0 && (
              <text x={cx} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={isPeak ? 'var(--accent)' : 'var(--text)'} fontFamily="var(--font-display)">{b.count}</text>
            )}
            <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)">{b.label}</text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth={1.5} />
    </svg>
  );
}

export default function StatisticsView({ tree }: Props) {
  const t = useTranslations('statistics');
  const stats = useMemo(() => computeTreeStats(tree), [tree]);

  // Generation index per person (0 = founders, increasing downward), via parent links.
  const generationByPerson = useMemo(() => {
    const memo = new Map<string, number>();
    tree.persons.forEach(p => getGeneration(p.id, tree.relationships, tree.persons, memo));
    return memo;
  }, [tree]);

  // --- 1) Espérance de vie par génération (fallback: par décennie de naissance) ---
  const lifespan = useMemo<{ groups: LifespanGroup[]; mode: 'generation' | 'decade' }>(() => {
    // Deceased persons with BOTH dates → a real lifespan.
    const withLifespan = tree.persons
      .map(p => {
        const age = !p.isAlive && p.birthDate && p.deathDate ? getAge(p.birthDate, p.deathDate) : null;
        return age != null && age >= 0 ? { person: p, age } : null;
      })
      .filter((x): x is { person: Person; age: number } => x !== null);

    if (withLifespan.length === 0) return { groups: [], mode: 'generation' };

    // Try grouping by generation.
    const genBuckets = new Map<number, number[]>();
    withLifespan.forEach(({ person, age }) => {
      const g = generationByPerson.get(person.id) ?? 0;
      if (!genBuckets.has(g)) genBuckets.set(g, []);
      genBuckets.get(g)!.push(age);
    });
    // Generation data is "reliable" only if it spreads people across ≥ 2 generations.
    const genReliable = genBuckets.size >= 2;

    if (genReliable) {
      const groups: LifespanGroup[] = [...genBuckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([g, ages]) => ({
          key: t('genLabel', { n: g + 1 }),
          avg: Math.round(ages.reduce((s, a) => s + a, 0) / ages.length),
          count: ages.length,
        }));
      return { groups, mode: 'generation' };
    }

    // Fallback: group by birth decade.
    const decBuckets = new Map<number, number[]>();
    withLifespan.forEach(({ person, age }) => {
      if (!person.birthDate) return;
      const d = Math.floor(new Date(person.birthDate).getFullYear() / 10) * 10;
      if (!decBuckets.has(d)) decBuckets.set(d, []);
      decBuckets.get(d)!.push(age);
    });
    const groups: LifespanGroup[] = [...decBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, ages]) => ({
        key: `${d}s`,
        avg: Math.round(ages.reduce((s, a) => s + a, 0) / ages.length),
        count: ages.length,
      }));
    return { groups, mode: 'decade' };
  }, [tree, generationByPerson, t]);

  // --- 2) Top prénoms + nuage de mots ---
  const topNames = useMemo<NameEntry[]>(() => {
    const counts = new Map<string, { display: string; count: number; male: number; female: number }>();
    tree.persons.forEach(p => {
      const raw = (p.firstName || '').trim();
      if (!raw) return;
      // First token only (handles composed first names tidily).
      const name = raw.split(/\s+/)[0];
      const key = name.toLowerCase();
      if (!counts.has(key)) counts.set(key, { display: name, count: 0, male: 0, female: 0 });
      const rec = counts.get(key)!;
      rec.count++;
      if (p.gender === 'male') rec.male++;
      else if (p.gender === 'female') rec.female++;
    });
    return [...counts.values()]
      .map(rec => {
        const gender: NameEntry['gender'] =
          rec.male > 0 && rec.female === 0 ? 'male' : rec.female > 0 && rec.male === 0 ? 'female' : 'mixed';
        return { name: rec.display, count: rec.count, gender };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [tree]);

  // --- 3) Timeline des naissances par décennie ---
  const decadeTimeline = useMemo<DecadeBucket[]>(() => {
    const years = tree.persons
      .filter(p => p.birthDate)
      .map(p => new Date(p.birthDate!).getFullYear())
      .filter(y => !Number.isNaN(y));
    if (years.length === 0) return [];
    const minD = Math.floor(Math.min(...years) / 10) * 10;
    const maxD = Math.floor(Math.max(...years) / 10) * 10;
    const map = new Map<number, number>();
    years.forEach(y => {
      const d = Math.floor(y / 10) * 10;
      map.set(d, (map.get(d) || 0) + 1);
    });
    // Fill contiguous decades (including empty ones) for an honest timeline.
    const buckets: DecadeBucket[] = [];
    for (let d = minD; d <= maxD; d += 10) {
      buckets.push({ decade: d, label: `${d}s`, count: map.get(d) || 0 });
    }
    return buckets;
  }, [tree]);

  // --- Optional: répartition géographique (top birth countries / cities) ---
  const geoDist = useMemo(() => {
    const counts: Record<string, number> = {};
    tree.persons.forEach(p => {
      const place = p.birthPlace?.country || p.birthPlace?.city;
      if (!place) return;
      counts[place] = (counts[place] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tree]);
  const maxGeo = Math.max(...geoDist.map(d => d.value), 1);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem' }}>{t('heading', { tree: tree.name })}</h2>
      </div>

      <div style={{ padding: '20px', maxWidth: '1000px' }}>
        {/* Overview — a narrative line, then a quiet row of secondary figures. */}
        <div style={{ marginBottom: '28px' }}>
          <p className="serif" style={{ margin: '0 0 18px', fontSize: '1.5rem', lineHeight: 1.35, maxWidth: '34ch', textWrap: 'balance' }}>
            {t.rich('intro', {
              persons: stats.totalPersons,
              generations: stats.totalGenerations,
              accent: (chunks) => <span style={{ color: 'var(--accent)' }}>{chunks}</span>,
            })}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 32px' }}>
            <Figure label={t('males')} value={stats.totalMales} />
            <Figure label={t('females')} value={stats.totalFemales} />
            <Figure label={t('alive')} value={stats.totalAlive} />
            <Figure label={t('deceased')} value={stats.totalDeceased} />
            <Figure label={t('relationships')} value={stats.totalRelationships} />
            <Figure label={t('withPhoto')} value={stats.totalPhotos} />
            <Figure label={t('events')} value={stats.totalEvents} />
            {stats.averageLifespan && (
              <Figure label={t('avgLifespan')} value={stats.averageLifespan} sub={t('yearsUnit')} />
            )}
          </div>
        </div>

        {/* ===== 1) ESPÉRANCE DE VIE ===== */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <SectionHead
            eyebrow={t('longevityEyebrow')}
            title={lifespan.mode === 'generation' ? t('longevityByGeneration') : t('longevityByDecade')}
          />
          {lifespan.groups.length > 0 ? (
            <>
              <LifespanChart
                groups={lifespan.groups}
                ariaLabel={t('longevityChartAria')}
                yearsLabel={t('yearsAxis')}
                personsLabel={(n) => t('personsCount', { n })}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '8px 0 0' }}>
                {t('longevityCaption')}
              </p>
            </>
          ) : (
            <EmptyState text={t('insufficientData')} />
          )}
        </div>

        {/* ===== 2) TOP PRÉNOMS + NUAGE DE MOTS ===== */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <SectionHead eyebrow={t('onomasticsEyebrow')} title={t('topFirstNames')} />
          {topNames.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 280px) 1fr', gap: '24px', alignItems: 'center' }}>
              {/* Ranked list */}
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {topNames.map((e, i) => (
                  <li key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span className="label" style={{ color: 'var(--text-light)', minWidth: '18px' }}>{i + 1}</span>
                    <span style={{
                      fontWeight: 700,
                      color: e.gender === 'male' ? 'var(--male)' : e.gender === 'female' ? 'var(--female)' : 'var(--ink)',
                    }}>{e.name}</span>
                    <span style={{ flex: 1, borderBottom: '1px dotted var(--border)' }} />
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{e.count}</span>
                  </li>
                ))}
              </ol>
              {/* Word cloud */}
              <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius)', minHeight: '160px', display: 'flex', alignItems: 'center' }}>
                <WordCloud entries={topNames} />
              </div>
            </div>
          ) : (
            <EmptyState text={t('insufficientData')} />
          )}
        </div>

        {/* ===== 3) TIMELINE DES NAISSANCES PAR DÉCENNIE ===== */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <SectionHead eyebrow={t('chronologyEyebrow')} title={t('birthsByDecade')} />
          {decadeTimeline.length > 0 ? (
            <>
              <DecadeTimeline buckets={decadeTimeline} ariaLabel={t('birthsByDecade')} />
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-light)', marginTop: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', background: 'var(--accent)', display: 'inline-block' }} /> {t('birthPeak')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', background: '#5b7fa6', display: 'inline-block' }} /> {t('otherDecades')}
                </span>
              </div>
            </>
          ) : (
            <EmptyState text={t('insufficientData')} />
          )}
        </div>

        {/* ===== Optional: répartition géographique ===== */}
        {geoDist.length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
            <SectionHead eyebrow={t('geographyEyebrow')} title={t('birthOrigins')} />
            <BarChart data={geoDist} maxValue={maxGeo} colorFn={() => '#5b7fa6'} />
          </div>
        )}

        {/* ===== Existing: notable persons ===== */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <SectionHead eyebrow={t('landmarksEyebrow')} title={t('notablePersons')} />
          {(stats.oldestPerson || stats.youngestPerson || stats.mostCommonSurname) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {stats.oldestPerson && (
                <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                  <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>{t('oldest')}</div>
                  <div style={{ fontWeight: '700' }}>{getDisplayName(stats.oldestPerson)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatYear(stats.oldestPerson.birthDate)} · {formatAge(getAge(stats.oldestPerson.birthDate))}
                  </div>
                </div>
              )}
              {stats.youngestPerson && (
                <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                  <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>{t('youngest')}</div>
                  <div style={{ fontWeight: '700' }}>{getDisplayName(stats.youngestPerson)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatYear(stats.youngestPerson.birthDate)} · {formatAge(getAge(stats.youngestPerson.birthDate))}
                  </div>
                </div>
              )}
              {stats.mostCommonSurname && (
                <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                  <div className="label" style={{ color: 'var(--text-light)', marginBottom: '2px' }}>{t('mostCommonSurname')}</div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{stats.mostCommonSurname}</div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState text={t('insufficientData')} />
          )}
        </div>

        {/* ===== Existing: gender ratio visual ===== */}
        <div className="card" style={{ padding: '20px' }}>
          <SectionHead eyebrow={t('demographyEyebrow')} title={t('genderRatio')} />
          {stats.totalPersons > 0 ? (
            <div>
              <div style={{ display: 'flex', height: '32px', borderRadius: 0, overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  width: `${(stats.totalMales / stats.totalPersons) * 100}%`,
                  background: 'var(--male)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: '700',
                }}>
                  {stats.totalMales > 0 && stats.totalMales}
                </div>
                <div style={{
                  width: `${(stats.totalFemales / stats.totalPersons) * 100}%`,
                  background: 'var(--female)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: '700',
                }}>
                  {stats.totalFemales > 0 && stats.totalFemales}
                </div>
                <div style={{
                  flex: 1, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: 'var(--text-muted)',
                }}>
                  {stats.totalPersons - stats.totalMales - stats.totalFemales > 0 && (stats.totalPersons - stats.totalMales - stats.totalFemales)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--male)' }}>{t('percentMales', { pct: Math.round((stats.totalMales / stats.totalPersons) * 100) })}</span>
                <span style={{ color: 'var(--female)' }}>{t('percentFemales', { pct: Math.round((stats.totalFemales / stats.totalPersons) * 100) })}</span>
              </div>
            </div>
          ) : (
            <EmptyState text={t('insufficientData')} />
          )}
        </div>
      </div>
    </div>
  );
}
