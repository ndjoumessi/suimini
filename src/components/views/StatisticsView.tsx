'use client';
import { useMemo, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { computeTreeStats, getAge, formatAge, getDisplayName, formatYear } from '@/lib/treeUtils';
import { Crown } from 'lucide-react';
import PersonAvatar from '../person/PersonAvatar';

interface Props {
  tree: FamilyTree;
  onSelectPerson?: (id: string) => void;
}

interface DecadeBucket { decade: number; label: string; count: number }
interface RankItem { label: string; value: number; tone?: 'male' | 'female' | 'mixed' }

/* ============================================================================
   StatisticsView — « Tableau de bord mémoriel »
   Masthead hero, inline-SVG charts (donut + decade bars), typographic rankings,
   notable-people cards + founder. No chart library; full control, dark Atelier.
   ========================================================================== */

/** Donut: répartition par genre. Pure SVG (stroke-dasharray arcs). */
function GenderDonut({ male, female, other, abbrMen, abbrWomen }: {
  male: number; female: number; other: number; abbrMen: string; abbrWomen: string;
}) {
  const total = male + female + other;
  const R = 52, SW = 18, CX = 80, CY = 80;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 2.5 : 0; // visual gap between arcs (px of circumference)
  const segs = [
    { v: male, color: 'var(--male)' },
    { v: female, color: 'var(--female)' },
    { v: other, color: 'var(--border-strong)' },
  ].filter(s => s.v > 0);

  let acc = 0;
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" role="img"
      aria-label={`${male} ${abbrMen}, ${female} ${abbrWomen}`} style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg-muted)" strokeWidth={SW} />
      {segs.map((s, i) => {
        const len = Math.max((s.v / total) * C - GAP, 0);
        const el = (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}
            transform={`rotate(-90 ${CX} ${CY})`} strokeLinecap="butt" />
        );
        acc += (s.v / total) * C;
        return el;
      })}
      {/* Centre: gender split in Spectral, gender-coloured to echo the arcs */}
      <text x={CX} y={CY - 6} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700}>
        <tspan fontSize={26} fill="var(--male)">{male}</tspan>
        <tspan fontSize={13} fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)" dy={-1}> {abbrMen}</tspan>
      </text>
      <text x={CX} y={CY + 22} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700}>
        <tspan fontSize={26} fill="var(--female)">{female}</tspan>
        <tspan fontSize={13} fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)" dy={-1}> {abbrWomen}</tspan>
      </text>
    </svg>
  );
}

/** Vertical bar chart: births per decade. Peak in gold, rest blue-grey. Hover tooltip. */
function DecadeChart({ buckets, tooltipFor }: { buckets: DecadeBucket[]; tooltipFor: (b: DecadeBucket) => string }) {
  const t = useTranslations('statistics');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = 760, H = 280;
  const padL = 40, padR = 16, padT = 28, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const peak = Math.max(...buckets.map(b => b.count));
  const axisMax = Math.max(maxCount, 1);
  const n = buckets.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.6, 56);
  const yTicks = [0, Math.round(axisMax / 2), axisMax].filter((v, i, a) => a.indexOf(v) === i);

  const setHoverFromEvent = (i: number, e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('birthsByDecade')} style={{ display: 'block' }}>
        {/* y gridlines + labels */}
        {yTicks.map((tk, i) => {
          const y = padT + plotH - (tk / axisMax) * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--text-light)" fontFamily="var(--font-mono, monospace)">{tk}</text>
            </g>
          );
        })}
        {buckets.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = (b.count / axisMax) * plotH;
          const y = padT + plotH - h;
          const isPeak = b.count === peak && peak > 0;
          const active = hover?.i === i;
          return (
            <g key={b.decade}
              onMouseEnter={(e) => setHoverFromEvent(i, e)}
              onMouseMove={(e) => setHoverFromEvent(i, e)}
              onMouseLeave={() => setHover(h => (h?.i === i ? null : h))}
              style={{ cursor: b.count > 0 ? 'default' : 'default' }}>
              {/* full-height hover hit area */}
              <rect x={cx - slot / 2} y={padT} width={slot} height={plotH} fill="transparent" />
              {b.count > 0 && (
                <rect x={cx - barW / 2} y={y} width={barW} height={h}
                  fill={isPeak ? 'var(--accent)' : 'var(--male)'}
                  opacity={active ? 1 : 0.92}
                  style={{ transition: 'opacity 150ms ease' }} />
              )}
              {b.count > 0 && (
                <text x={cx} y={y - 7} textAnchor="middle" fontSize={12} fontWeight={700}
                  fill={isPeak ? 'var(--accent-text)' : 'var(--text)'} fontFamily="var(--font-display)">{b.count}</text>
              )}
              <text x={cx} y={H - padB + 18} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)">{b.label}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth={1.5} />
      </svg>
      {hover && buckets[hover.i] && (
        <div role="status" style={{
          position: 'absolute', left: hover.x, top: hover.y,
          transform: 'translate(-50%, calc(-100% - 14px))', pointerEvents: 'none',
          background: 'var(--ink)', color: 'var(--bg)', padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'nowrap',
          boxShadow: '3px 3px 0 var(--accent)', zIndex: 2,
        }}>
          {tooltipFor(buckets[hover.i])}
        </div>
      )}
    </div>
  );
}

/** A typographic ranking row: gold rank, name (Spectral), proportional gold bar, count. */
function RankRow({ rank, label, value, max, tone }: { rank: number; label: string; value: number; max: number; tone?: RankItem['tone'] }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  const nameColor = tone === 'male' ? 'var(--male)' : tone === 'female' ? 'var(--female)' : 'var(--ink)';
  return (
    <li className="sv-rank">
      <span className="sv-rank-n">{rank}</span>
      <div className="sv-rank-body">
        <div className="sv-rank-top">
          <span className="sv-rank-name" style={{ color: nameColor }}>{label}</span>
          <span className="sv-rank-count">{value}</span>
        </div>
        <div className="sv-rank-track"><div className="sv-rank-fill" style={{ width: `${pct}%` }} /></div>
      </div>
    </li>
  );
}

export default function StatisticsView({ tree, onSelectPerson }: Props) {
  const t = useTranslations('statistics');
  const stats = useMemo(() => computeTreeStats(tree), [tree]);

  const other = Math.max(stats.totalPersons - stats.totalMales - stats.totalFemales, 0);
  const pctMale = stats.totalPersons ? Math.round((stats.totalMales / stats.totalPersons) * 100) : 0;
  const pctFemale = stats.totalPersons ? Math.round((stats.totalFemales / stats.totalPersons) * 100) : 0;

  // Births per decade (contiguous, including empty decades for an honest axis).
  const decades = useMemo<DecadeBucket[]>(() => {
    const years = tree.persons
      .filter(p => p.birthDate)
      .map(p => new Date(p.birthDate!).getFullYear())
      .filter(y => !Number.isNaN(y));
    if (years.length === 0) return [];
    const minD = Math.floor(Math.min(...years) / 10) * 10;
    const maxD = Math.floor(Math.max(...years) / 10) * 10;
    const map = new Map<number, number>();
    years.forEach(y => { const d = Math.floor(y / 10) * 10; map.set(d, (map.get(d) || 0) + 1); });
    const out: DecadeBucket[] = [];
    for (let d = minD; d <= maxD; d += 10) out.push({ decade: d, label: `${d}s`, count: map.get(d) || 0 });
    return out;
  }, [tree]);

  // Top first names.
  const topNames = useMemo<RankItem[]>(() => {
    const counts = new Map<string, { display: string; count: number; male: number; female: number }>();
    tree.persons.forEach(p => {
      const raw = (p.firstName || '').trim();
      if (!raw) return;
      const name = raw.split(/\s+/)[0];
      const key = name.toLowerCase();
      if (!counts.has(key)) counts.set(key, { display: name, count: 0, male: 0, female: 0 });
      const rec = counts.get(key)!;
      rec.count++;
      if (p.gender === 'male') rec.male++;
      else if (p.gender === 'female') rec.female++;
    });
    return [...counts.values()]
      .map(rec => ({
        label: rec.display,
        value: rec.count,
        tone: (rec.male > 0 && rec.female === 0 ? 'male' : rec.female > 0 && rec.male === 0 ? 'female' : 'mixed') as RankItem['tone'],
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 10);
  }, [tree]);

  // Birth-place origins (city → region → country).
  const geo = useMemo<RankItem[]>(() => {
    const counts = new Map<string, number>();
    tree.persons.forEach(p => {
      const place = p.birthPlace?.city || p.birthPlace?.region || p.birthPlace?.country;
      if (!place) return;
      counts.set(place, (counts.get(place) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [tree]);

  // Founder: the tree's declared pivot, else the eldest deceased ancestor, else first person.
  const founder = useMemo<Person | undefined>(() => {
    if (tree.rootPersonId) {
      const r = tree.persons.find(p => p.id === tree.rootPersonId);
      if (r) return r;
    }
    return [...tree.persons]
      .filter(p => p.birthDate)
      .sort((a, b) => new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime())[0]
      || tree.persons[0];
  }, [tree]);

  const maxName = topNames[0]?.value ?? 1;
  const maxGeo = geo[0]?.value ?? 1;

  if (stats.totalPersons === 0) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('insufficientData')}
        </div>
      </div>
    );
  }

  const founderYear = founder?.birthDate ? formatYear(founder.birthDate) : null;

  return (
    <div className="sv-root" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .sv-wrap { max-width: 1080px; margin: 0 auto; padding: 28px 24px 64px; }
        .sv-reveal { animation: svReveal 0.6s var(--ease-out) both; }
        @keyframes svReveal { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

        /* ---- Hero masthead ---- */
        .sv-hero { display: flex; align-items: stretch; gap: 0; padding: 8px 0 30px; border-bottom: 1px solid var(--border); margin-bottom: 36px; }
        .sv-hero-cell { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 6px 12px; min-width: 0; }
        .sv-hero-num { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.75rem, 7vw, 5rem); line-height: 0.95; color: var(--accent); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .sv-hero-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-muted); margin-top: 12px; }
        .sv-hero-sep { width: 1px; align-self: stretch; background: var(--accent); opacity: 0.5; flex-shrink: 0; }

        /* ---- Section scaffolding (single Spectral title, no eyebrow-on-every-section) ---- */
        .sv-section { margin-top: 40px; }
        .sv-h { font-family: var(--font-display); font-weight: 600; font-size: 1.4rem; color: var(--ink); margin: 0 0 2px; letter-spacing: -0.01em; }
        .sv-rule { height: 2px; width: 44px; background: var(--accent); margin: 8px 0 22px; }

        /* ---- Two-column blocks ---- */
        .sv-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .sv-panel { background: var(--bg-card); border: 1px solid var(--border); padding: 22px; }
        .sv-panel-h { font-family: var(--font-display); font-size: 1.05rem; color: var(--ink); margin: 0 0 16px; }

        /* gender donut block */
        .sv-donut-row { display: flex; align-items: center; gap: 22px; }
        .sv-legend { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .sv-legend-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text); }
        .sv-dot { width: 12px; height: 12px; flex-shrink: 0; }
        .sv-legend-pct { font-family: var(--font-mono); color: var(--text-muted); font-size: 12px; }

        /* living vs deceased */
        .sv-split-bar { display: flex; height: 28px; overflow: hidden; border: 1px solid var(--border); }
        .sv-split-caption { display: flex; gap: 18px; margin-top: 12px; font-size: 13px; }
        .sv-life { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border); }
        .sv-life-num { font-family: var(--font-display); font-weight: 700; font-size: 3rem; line-height: 1; color: var(--accent); letter-spacing: -0.02em; }
        .sv-life-num small { font-size: 1.1rem; color: var(--text-muted); font-weight: 600; margin-left: 6px; }
        .sv-life-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-muted); margin-top: 8px; }

        /* legend row for decade chart */
        .sv-chart-legend { display: flex; gap: 18px; margin-top: 10px; font-size: 11px; color: var(--text-light); font-family: var(--font-mono); }
        .sv-chart-legend span { display: inline-flex; align-items: center; gap: 6px; }

        /* rankings */
        .sv-rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .sv-rank { display: flex; align-items: center; gap: 14px; }
        .sv-rank-n { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--accent-text); min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; }
        .sv-rank-body { flex: 1; min-width: 0; }
        .sv-rank-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 5px; }
        .sv-rank-name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sv-rank-count { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
        .sv-rank-track { height: 6px; background: var(--bg-muted); overflow: hidden; }
        .sv-rank-fill { height: 100%; background: var(--accent); transition: width var(--t-base) var(--ease-out); }
        .sv-rank-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 44px; }

        /* notable people */
        .sv-notable { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .sv-person { background: var(--bg-card); border: 1px solid var(--border); padding: 20px; display: flex; flex-direction: column; gap: 12px; font-family: inherit; text-align: left; color: inherit; cursor: pointer; transition: border-color var(--t-fast) ease, box-shadow var(--t-fast) ease, transform var(--t-fast) var(--ease-out); }
        .sv-person:hover:not(:disabled) { border-color: var(--accent); box-shadow: var(--shadow-sm); transform: translateY(-2px); }
        .sv-person:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .sv-person:disabled { cursor: default; }
        .sv-person-founder { background: #2a2218; border-color: var(--accent); }
        .sv-person-founder:hover:not(:disabled) { box-shadow: var(--shadow-accent); }
        .sv-person-head { display: flex; align-items: center; gap: 14px; }
        .sv-person-name { font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; color: var(--ink); line-height: 1.15; }
        .sv-person-dates { font-family: var(--font-mono); font-size: 12px; color: var(--accent-text); margin-top: 3px; }
        .sv-person-role { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; }
        .sv-person-founder .sv-person-role { color: var(--accent-text); }

        @media (max-width: 720px) {
          .sv-2col { grid-template-columns: 1fr; }
          .sv-rank-grid { grid-template-columns: 1fr; }
          .sv-hero { flex-wrap: wrap; }
        }
        @media (max-width: 520px) {
          .sv-hero { flex-direction: column; gap: 4px; align-items: stretch; }
          .sv-hero-sep { width: 100%; height: 1px; }
          .sv-hero-cell { flex-direction: row; justify-content: space-between; align-items: baseline; padding: 10px 4px; }
          .sv-hero-label { margin-top: 0; }
          .sv-donut-row { flex-direction: column; align-items: flex-start; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sv-reveal { animation: none; }
          .sv-rank-fill { transition: none; }
        }
      `}</style>

      <div className="sv-wrap">
        {/* ===== HERO ===== */}
        <div className="sv-hero sv-reveal" style={{ animationDelay: '0ms' }}>
          <div className="sv-hero-cell">
            <span className="sv-hero-num">{stats.totalPersons}</span>
            <span className="sv-hero-label">{t('members')}</span>
          </div>
          <span className="sv-hero-sep" aria-hidden="true" />
          <div className="sv-hero-cell">
            <span className="sv-hero-num">{stats.totalGenerations}</span>
            <span className="sv-hero-label">{t('generations')}</span>
          </div>
          <span className="sv-hero-sep" aria-hidden="true" />
          <div className="sv-hero-cell">
            <span className="sv-hero-num">{stats.totalRelationships}</span>
            <span className="sv-hero-label">{t('links')}</span>
          </div>
        </div>

        {/* ===== 1. DÉMOGRAPHIE ===== */}
        <section className="sv-section sv-reveal" style={{ animationDelay: '60ms' }}>
          <h3 className="sv-h">{t('demographyTitle')}</h3>
          <div className="sv-rule" />
          <div className="sv-2col">
            {/* gender donut */}
            <div className="sv-panel">
              <h4 className="sv-panel-h">{t('genderRatio')}</h4>
              <div className="sv-donut-row">
                <GenderDonut male={stats.totalMales} female={stats.totalFemales} other={other}
                  abbrMen={t('abbrMen')} abbrWomen={t('abbrWomen')} />
                <div className="sv-legend">
                  <div className="sv-legend-item">
                    <span className="sv-dot" style={{ background: 'var(--male)' }} />
                    {t('males')} <span className="sv-legend-pct">{pctMale}%</span>
                  </div>
                  <div className="sv-legend-item">
                    <span className="sv-dot" style={{ background: 'var(--female)' }} />
                    {t('females')} <span className="sv-legend-pct">{pctFemale}%</span>
                  </div>
                  {other > 0 && (
                    <div className="sv-legend-item">
                      <span className="sv-dot" style={{ background: 'var(--border-strong)' }} />
                      {other} <span className="sv-legend-pct">{Math.round((other / stats.totalPersons) * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* living vs deceased + life expectancy */}
            <div className="sv-panel">
              <h4 className="sv-panel-h">{t('lifeStatus')}</h4>
              <div className="sv-split-bar" role="img"
                aria-label={`${stats.totalAlive} ${t('alive')}, ${stats.totalDeceased} ${t('deceased')}`}>
                <div style={{ width: `${stats.totalPersons ? (stats.totalAlive / stats.totalPersons) * 100 : 0}%`, background: 'var(--accent)' }} />
                <div style={{ width: `${stats.totalPersons ? (stats.totalDeceased / stats.totalPersons) * 100 : 0}%`, background: 'var(--border-strong)' }} />
              </div>
              <div className="sv-split-caption">
                <span style={{ color: 'var(--accent-text)' }}>{stats.totalAlive} {t('alive')}</span>
                <span style={{ color: 'var(--text-muted)' }}>{stats.totalDeceased} {t('deceased')}</span>
              </div>
              {stats.averageLifespan ? (
                <div className="sv-life">
                  <div className="sv-life-num">{stats.averageLifespan}<small>{t('yearsUnit')}</small></div>
                  <div className="sv-life-label">{t('lifeExpectancy')}</div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ===== 2. NAISSANCES PAR DÉCENNIE ===== */}
        <section className="sv-section sv-reveal" style={{ animationDelay: '120ms' }}>
          <h3 className="sv-h">{t('birthsByDecade')}</h3>
          <div className="sv-rule" />
          {decades.length > 0 ? (
            <div className="sv-panel">
              <DecadeChart buckets={decades}
                tooltipFor={(b) => t('birthsTooltip', { count: b.count, decade: String(b.decade) })} />
              <div className="sv-chart-legend">
                <span><span className="sv-dot" style={{ background: 'var(--accent)' }} /> {t('birthPeak')}</span>
                <span><span className="sv-dot" style={{ background: 'var(--male)' }} /> {t('otherDecades')}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('insufficientData')}</p>
          )}
        </section>

        {/* ===== 3. ONOMASTIQUE — prénoms les plus portés ===== */}
        <section className="sv-section sv-reveal" style={{ animationDelay: '180ms' }}>
          <h3 className="sv-h">{t('topFirstNames')}</h3>
          <div className="sv-rule" />
          {topNames.length > 0 ? (
            <ol className="sv-rank-grid">
              {topNames.map((e, i) => (
                <RankRow key={e.label} rank={i + 1} label={e.label} value={e.value} max={maxName} tone={e.tone} />
              ))}
            </ol>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('insufficientData')}</p>
          )}
        </section>

        {/* ===== 4. GÉOGRAPHIE — origines de naissance ===== */}
        {geo.length > 0 && (
          <section className="sv-section sv-reveal" style={{ animationDelay: '220ms' }}>
            <h3 className="sv-h">{t('birthOrigins')}</h3>
            <div className="sv-rule" />
            <ol className="sv-rank-list">
              {geo.map((g, i) => (
                <RankRow key={g.label} rank={i + 1} label={g.label} value={g.value} max={maxGeo} />
              ))}
            </ol>
          </section>
        )}

        {/* ===== 5. PERSONNES NOTABLES ===== */}
        <section className="sv-section sv-reveal" style={{ animationDelay: '260ms' }}>
          <h3 className="sv-h">{t('notablePersons')}</h3>
          <div className="sv-rule" />
          <div className="sv-notable">
            {stats.oldestPerson && (
              <button type="button" className="sv-person" onClick={() => onSelectPerson?.(stats.oldestPerson!.id)} disabled={!onSelectPerson}>
                <div className="sv-person-head">
                  <PersonAvatar person={stats.oldestPerson} size={48} />
                  <div>
                    <div className="sv-person-name">{getDisplayName(stats.oldestPerson)}</div>
                    <div className="sv-person-dates">
                      {formatYear(stats.oldestPerson.birthDate)} · {formatAge(getAge(stats.oldestPerson.birthDate))}
                    </div>
                  </div>
                </div>
                <span className="sv-person-role">{t('doyen')}</span>
              </button>
            )}
            {stats.youngestPerson && (
              <button type="button" className="sv-person" onClick={() => onSelectPerson?.(stats.youngestPerson!.id)} disabled={!onSelectPerson}>
                <div className="sv-person-head">
                  <PersonAvatar person={stats.youngestPerson} size={48} />
                  <div>
                    <div className="sv-person-name">{getDisplayName(stats.youngestPerson)}</div>
                    <div className="sv-person-dates">
                      {formatYear(stats.youngestPerson.birthDate)} · {formatAge(getAge(stats.youngestPerson.birthDate))}
                    </div>
                  </div>
                </div>
                <span className="sv-person-role">{t('benjamin')}</span>
              </button>
            )}
            {founder && (
              <button type="button" className="sv-person sv-person-founder" onClick={() => onSelectPerson?.(founder.id)} disabled={!onSelectPerson}>
                <div className="sv-person-head">
                  <PersonAvatar person={founder} size={48} />
                  <div>
                    <div className="sv-person-name">{getDisplayName(founder)}</div>
                    <div className="sv-person-dates">
                      {t('founder')}{founderYear ? ` · ${founder.birthDateApprox ? '~' : ''}${founderYear}` : ''}
                    </div>
                  </div>
                </div>
                <span className="sv-person-role"><Crown size={13} aria-hidden="true" /> {t('foundingAncestor')}</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
