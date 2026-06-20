'use client';
import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarDays, MapPin } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { FamilyTree, EventType, Person } from '@/types';
import { getDisplayName, formatDate, getChildren, getParents } from '@/lib/treeUtils';
import { eventsOverlapping, type HistoricalEvent } from '@/lib/history';

interface TimelineEntry {
  date: string;
  year: number;
  type: EventType | 'birth' | 'death';
  personId: string;
  personName: string;
  description: string;
  place?: string;
}

// Event type → a design-system token (stays on-brand and retints in dark mode).
const EVENT_COLORS: Record<string, string> = {
  birth: 'var(--success)',
  death: 'var(--deceased)',
  marriage: 'var(--accent)',
  divorce: 'var(--danger)',
  baptism: 'var(--info)',
  graduation: 'var(--warning)',
  military: 'var(--text-muted)',
  immigration: 'var(--info)',
  other: 'var(--accent)',
};

// Generation → design token. Cycles through a curated on-brand palette so that
// each generation reads as a distinct hue without becoming rainbow chaos.
const GENERATION_PALETTE: readonly string[] = [
  'var(--accent)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--female)',
  'var(--male)',
];
const NEUTRAL_GEN_COLOR = 'var(--text-light)';

type ViewMode = 'list' | 'century';
type Scope = 'family' | 'individual';

interface LifeBar {
  person: Person;
  name: string;
  birthYear: number;
  /** Death year, or null while still living (bar extends to "now"). */
  deathYear: number | null;
  /** End year used for layout (deathYear || current year). */
  endYear: number;
  generation: number | null;
}

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

/**
 * BFS generation depth from the tree root (or the earliest-born person if no
 * root). Root is generation 0; each parent→child hop is +1. Walks both
 * directions (children deeper, parents shallower) so the whole connected graph
 * gets a relative depth, then normalises so the shallowest depth is 0.
 */
function computeGenerations(tree: FamilyTree): Map<string, number> {
  const result = new Map<string, number>();
  if (tree.persons.length === 0) return result;

  // Pick a seed: configured root, else the earliest-born person, else first.
  let seedId = tree.rootPersonId;
  if (!seedId || !tree.persons.some(p => p.id === seedId)) {
    const withBirth = tree.persons
      .filter(p => p.birthDate)
      .sort((a, b) => new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime());
    seedId = (withBirth[0] ?? tree.persons[0]).id;
  }

  // BFS over the connected component reachable from the seed (relative depth).
  const depth = new Map<string, number>();
  const queue: string[] = [seedId];
  depth.set(seedId, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    const children = getChildren(id, tree.relationships, tree.persons);
    const parents = getParents(id, tree.relationships, tree.persons);
    for (const child of children) {
      if (!depth.has(child.id)) { depth.set(child.id, d + 1); queue.push(child.id); }
    }
    for (const parent of parents) {
      if (!depth.has(parent.id)) { depth.set(parent.id, d - 1); queue.push(parent.id); }
    }
  }

  // Normalise so the shallowest reachable depth becomes generation 0.
  let min = Infinity;
  depth.forEach(d => { if (d < min) min = d; });
  if (min === Infinity) min = 0;
  depth.forEach((d, id) => result.set(id, d - min));
  return result;
}

function genColor(gen: number | null): string {
  if (gen == null) return NEUTRAL_GEN_COLOR;
  return GENERATION_PALETTE[gen % GENERATION_PALETTE.length];
}

export default function TimelineView({ tree, onSelectPerson }: Props) {
  const t = useTranslations('timeline');
  const locale = useLocale() as 'fr' | 'en';

  const [view, setView] = useState<ViewMode>('list');
  const [scope, setScope] = useState<Scope>('family');
  const [focusId, setFocusId] = useState<string>('');

  // Persons that can appear in the "Individu" selector (must have a birth date
  // to be placeable on the timeline).
  const selectablePersons = useMemo(
    () =>
      tree.persons
        .filter(p => p.birthDate)
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), locale)),
    [tree.persons, locale]
  );

  const effectiveFocusId = scope === 'individual' ? focusId : '';

  const entries = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = [];

    tree.persons.forEach(person => {
      const name = getDisplayName(person);

      if (person.birthDate) {
        list.push({
          date: person.birthDate,
          year: new Date(person.birthDate).getFullYear(),
          type: 'birth',
          personId: person.id,
          personName: name,
          description: t('eventBirth', { name }),
          place: person.birthPlace?.city,
        });
      }

      if (person.deathDate) {
        list.push({
          date: person.deathDate,
          year: new Date(person.deathDate).getFullYear(),
          type: 'death',
          personId: person.id,
          personName: name,
          description: t('eventDeath', { name }),
          place: person.deathPlace?.city,
        });
      }

      person.events?.forEach(event => {
        if (event.date && event.type !== 'birth' && event.type !== 'death') {
          list.push({
            date: event.date,
            year: new Date(event.date).getFullYear(),
            type: event.type,
            personId: person.id,
            personName: name,
            description: event.description || t('eventGeneric', { type: t(`type_${event.type}`), name }),
            place: event.place?.city,
          });
        }
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [tree, t]);

  // Scope-filtered entries (drives the list view + the event count badge).
  const visibleEntries = useMemo(
    () => (effectiveFocusId ? entries.filter(e => e.personId === effectiveFocusId) : entries),
    [entries, effectiveFocusId]
  );

  // Group by decade (list view)
  const byDecade = useMemo(() => {
    const groups: Record<number, TimelineEntry[]> = {};
    visibleEntries.forEach(e => {
      const decade = Math.floor(e.year / 10) * 10;
      if (!groups[decade]) groups[decade] = [];
      groups[decade].push(e);
    });
    return groups;
  }, [visibleEntries]);

  const decades = Object.keys(byDecade).map(Number).sort((a, b) => a - b);

  // ─── Century view data ───────────────────────────────────────────────────
  const generations = useMemo(() => computeGenerations(tree), [tree]);

  const lifeBars = useMemo<LifeBar[]>(() => {
    const currentYear = new Date().getFullYear();
    const source = effectiveFocusId
      ? tree.persons.filter(p => p.id === effectiveFocusId)
      : tree.persons;
    return source
      .filter(p => p.birthDate)
      .map(p => {
        const birthYear = new Date(p.birthDate!).getFullYear();
        const deathYear = p.deathDate ? new Date(p.deathDate).getFullYear() : null;
        const endYear = deathYear ?? currentYear;
        return {
          person: p,
          name: getDisplayName(p),
          birthYear,
          deathYear,
          endYear: endYear < birthYear ? birthYear : endYear,
          generation: generations.get(p.id) ?? null,
        };
      })
      .filter(b => !Number.isNaN(b.birthYear))
      .sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name, locale));
  }, [tree.persons, effectiveFocusId, generations, locale]);

  // X-axis range: earliest birth → max(latest death, now), padded to decades.
  const axis = useMemo(() => {
    if (lifeBars.length === 0) return null;
    const minBirth = Math.min(...lifeBars.map(b => b.birthYear));
    const maxEnd = Math.max(...lifeBars.map(b => b.endYear));
    const from = Math.floor(minBirth / 10) * 10;
    const to = Math.ceil(maxEnd / 10) * 10;
    const ticks: number[] = [];
    for (let y = from; y <= to; y += 10) ticks.push(y);
    return { from, to, ticks, span: Math.max(to - from, 1) };
  }, [lifeBars]);

  // Personal events when focused on one individual; otherwise all overlapping.
  const markers = useMemo<HistoricalEvent[]>(() => {
    if (!axis) return [];
    return eventsOverlapping(axis.from, axis.to);
  }, [axis]);

  const pct = (year: number) => (axis ? ((year - axis.from) / axis.span) * 100 : 0);

  // Pixels per year governs horizontal scroll width — keep it bounded.
  const PX_PER_YEAR = 9;
  const chartWidth = axis ? Math.max(axis.span * PX_PER_YEAR, 640) : 640;
  const ROW_H = 30;

  // ─── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = view === 'list' ? visibleEntries.length === 0 : lifeBars.length === 0;

  const segBtn = (active: boolean): React.CSSProperties => ({
    border: 'var(--bw) solid var(--border-strong)',
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    padding: '5px 12px',
    fontSize: '11px',
    boxShadow: active ? 'none' : 'var(--shadow-sm)',
    transition: 'background 0.1s, box-shadow 0.1s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header + controls */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>{t('heading', { name: tree.name })}</h2>

        {/* View toggle (Liste / Siècle) */}
        <div role="group" aria-label={t('viewList') + ' / ' + t('viewCentury')} style={{ display: 'flex' }}>
          <button
            type="button"
            className="label"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            style={{ ...segBtn(view === 'list'), borderRight: 'none' }}
          >
            {t('viewList')}
          </button>
          <button
            type="button"
            className="label"
            aria-pressed={view === 'century'}
            onClick={() => setView('century')}
            style={segBtn(view === 'century')}
          >
            {t('viewCentury')}
          </button>
        </div>

        {/* Scope toggle (Famille / Individu) */}
        <div role="group" aria-label={t('scopeFamily') + ' / ' + t('scopeIndividual')} style={{ display: 'flex' }}>
          <button
            type="button"
            className="label"
            aria-pressed={scope === 'family'}
            onClick={() => setScope('family')}
            style={{ ...segBtn(scope === 'family'), borderRight: 'none' }}
          >
            {t('scopeFamily')}
          </button>
          <button
            type="button"
            className="label"
            aria-pressed={scope === 'individual'}
            onClick={() => setScope('individual')}
            style={segBtn(scope === 'individual')}
          >
            {t('scopeIndividual')}
          </button>
        </div>

        {scope === 'individual' && (
          <select
            className="input"
            aria-label={t('choosePerson')}
            value={focusId}
            onChange={e => setFocusId(e.target.value)}
            style={{ fontSize: '12px', padding: '5px 8px', maxWidth: '220px' }}
          >
            <option value="">{t('choosePerson')}</option>
            {selectablePersons.map(p => (
              <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
            ))}
          </select>
        )}

        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('eventCount', { count: visibleEntries.length })}</span>
      </div>

      {/* Body */}
      {isEmpty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={CalendarDays} title={t('empty')} />
        </div>
      ) : view === 'list' ? (
        /* ─── LIST VIEW (existing) ───────────────────────────────────────── */
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {decades.map(decade => (
            <div key={decade} style={{ marginBottom: '24px' }}>
              {/* Decade header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'
              }}>
                <div className="label" style={{ fontSize: '13px', color: 'var(--text-light)', minWidth: '60px' }}>
                  {t('decade', { decade })}
                </div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                  {t('eventCount', { count: byDecade[decade].length })}
                </div>
              </div>

              {/* Events — the single rail is drawn by .timeline-item::before */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {byDecade[decade].map((entry, i) => (
                  <div key={i} className="timeline-item">
                    <div
                      className="timeline-dot"
                      style={{ background: EVENT_COLORS[entry.type] || 'var(--accent)' }}
                    />
                    <button
                      onClick={() => onSelectPerson(entry.personId)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                        padding: '4px 8px', borderRadius: 'var(--radius)',
                        transition: 'background 0.1s', width: '100%',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>
                          {entry.description}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={11} aria-hidden="true" /> {formatDate(entry.date)}</span>
                          {entry.place && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} aria-hidden="true" /> {entry.place}</span>}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        fontWeight: '700',
                        background: 'var(--bg-muted)',
                        padding: '2px 8px', borderRadius: '100px', flexShrink: 0,
                      }}>
                        {entry.year}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── CENTURY VIEW (life bars) ───────────────────────────────────── */
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          <div style={{ position: 'relative', width: chartWidth, minWidth: '100%', padding: '0 12px 24px' }}>
            {/* Decade tick labels (top axis) */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 3,
              height: '34px', background: 'var(--bg-card)',
              borderBottom: 'var(--bw) solid var(--border-strong)',
            }}>
              {axis?.ticks.map(year => (
                <div key={year} style={{
                  position: 'absolute', left: `${pct(year)}%`, top: 0, bottom: 0,
                  transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center',
                }}>
                  <span className="label" style={{ fontSize: '10px', color: 'var(--text-light)' }}>{year}</span>
                </div>
              ))}
            </div>

            {/* Plot area */}
            <div style={{ position: 'relative', marginTop: '8px' }}>
              {/* World-event markers (behind the bars) */}
              {markers.map(ev => {
                const start = Math.max(ev.start, axis!.from);
                const end = Math.min(ev.end ?? ev.start, axis!.to);
                const left = pct(start);
                const width = ev.end ? Math.max(pct(end) - left, 0) : 0;
                return (
                  <div
                    key={ev.id}
                    title={ev[locale].label}
                    style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${left}%`,
                      width: ev.end ? `${width}%` : '0px',
                      borderLeft: '1.5px dashed var(--border)',
                      borderRight: ev.end ? '1.5px dashed var(--border)' : 'none',
                      background: ev.end ? 'color-mix(in srgb, var(--text-light) 8%, transparent)' : 'transparent',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  >
                    <span className="label" style={{
                      position: 'absolute', top: '2px', left: '3px',
                      fontSize: '9px', color: 'var(--text-light)',
                      whiteSpace: 'nowrap', opacity: 0.85,
                    }}>
                      {ev[locale].short}
                    </span>
                  </div>
                );
              })}

              {/* Life bars (one row per person) */}
              {lifeBars.map((bar, i) => {
                const left = pct(bar.birthYear);
                const right = pct(bar.endYear);
                const width = Math.max(right - left, 0.4);
                const color = genColor(bar.generation);
                const living = bar.deathYear == null;
                return (
                  <div key={bar.person.id} style={{ position: 'relative', height: ROW_H, zIndex: 1 }}>
                    <button
                      type="button"
                      className="timeline-life-bar"
                      onClick={() => onSelectPerson(bar.person.id)}
                      title={`${bar.name} · ${bar.birthYear}–${living ? t('living') : bar.deathYear}`}
                      style={{
                        position: 'absolute',
                        top: '3px',
                        height: ROW_H - 8,
                        left: `${left}%`,
                        width: `${width}%`,
                        minWidth: '14px',
                        background: color,
                        color: '#fff',
                        border: 'var(--bw) solid var(--border-strong)',
                        borderRight: living ? '2.5px dotted var(--border-strong)' : `var(--bw) solid var(--border-strong)`,
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '0 7px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: living ? 0.92 : 1,
                      }}
                    >
                      {bar.name} · {bar.birthYear}–{living ? '' : bar.deathYear}
                      {living && <span aria-hidden="true" style={{ marginLeft: '2px' }}>→</span>}
                    </button>
                    {/* alternating row guide */}
                    {i % 2 === 1 && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: -1,
                        background: 'color-mix(in srgb, var(--text-light) 4%, transparent)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .timeline-life-bar { transition: transform 0.1s, box-shadow 0.1s; }
        .timeline-life-bar:hover {
          transform: translate(-1px, -1px);
          box-shadow: var(--shadow);
          z-index: 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .timeline-life-bar { transition: none; }
          .timeline-life-bar:hover { transform: none; box-shadow: var(--shadow-sm); }
        }
      `}</style>
    </div>
  );
}
