'use client';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarDays, MapPin, Sparkles, Moon, Heart, Star } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
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

// Event type → Lucide icon + accent colour for the timeline list.
function eventVisual(type: string): { Icon: typeof Star; color: string } {
  if (type === 'birth') return { Icon: Sparkles, color: 'var(--accent-text)' };
  if (type === 'death') return { Icon: Moon, color: 'var(--male)' };
  if (type === 'marriage') return { Icon: Heart, color: 'var(--female)' };
  return { Icon: Star, color: 'var(--text)' };
}

// One timeline row: slides in from its side when scrolled into view (reduced-motion
// + headless safe: visible by default, animation replays on intersect).
function TLRow({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    const tm = window.setTimeout(() => setSeen(true), 1400);
    return () => { io.disconnect(); clearTimeout(tm); };
  }, []);
  return <div ref={ref} className={`tl-row tl-row-${side} ${seen ? 'tl-in' : ''}`}>{children}</div>;
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
    color: active ? '#12131a' : 'var(--text)',
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
        <div style={{ flex: '1 1 auto' }} />{/* title lives in ContentHeader (no double header) */}

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
          <EmptyState icon={CalendarDays} title={t('emptyTitle')} description={t('empty')} />
        </div>
      ) : view === 'list' ? (
        /* ─── LIST VIEW — central gold line, alternating event cards ──────── */
        <div className="tl-scroll">
          {/* Chronologie = liste ordonnée sémantique (1.3.1) ; le rendu visuel
              (classes .tl*) est inchangé, les <ol>/<li> sont neutralisés en CSS inline. */}
          <ol className="tl" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {decades.map(decade => (
              <li key={decade}>
                <h2 className="tl-decade"><span>{decade}<span className="tl-decade-s">s</span></span></h2>
                {byDecade[decade].map((entry, i) => {
                  const { Icon, color } = eventVisual(entry.type);
                  const typeName = t(`type_${entry.type}`);
                  const side = i % 2 === 0 ? 'left' : 'right';
                  return (
                    <TLRow key={`${decade}-${i}`} side={side}>
                      <span className="tl-node" style={{ borderColor: color }} aria-hidden="true" />
                      <button className="tl-card" onClick={() => onSelectPerson(entry.personId)}>
                        <span className="tl-card-head">
                          <span role="img" aria-label={typeName} title={typeName} style={{ display: 'inline-flex', color }}>
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <span className="tl-year">{entry.year}</span>
                        </span>
                        <span className="tl-name">{entry.description}</span>
                        <span className="tl-meta">
                          <span className="tl-date"><CalendarDays size={11} aria-hidden="true" /> {formatDate(entry.date)}</span>
                          {entry.place && <span className="tl-place"><MapPin size={11} aria-hidden="true" /> {entry.place}</span>}
                        </span>
                      </button>
                    </TLRow>
                  );
                })}
              </li>
            ))}
          </ol>
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
                        color: '#12131a',
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
        /* ── Timeline list: central gold line + alternating event cards ── */
        .tl-scroll { flex: 1; overflow-y: auto; }
        .tl { position: relative; max-width: 940px; margin: 0 auto; padding: 16px 16px 64px; }
        .tl::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; transform: translateX(-50%);
          background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 14%, transparent)); }
        .tl-decade { position: relative; display: flex; justify-content: center; margin: 32px 0 22px; }
        .tl-decade > span { position: relative; z-index: 1; font-family: var(--font-display); font-weight: 600; font-size: 2rem; letter-spacing: -0.02em; color: var(--accent-text); background: var(--bg); padding: 2px 18px; }
        .tl-decade-s { font-size: 0.58em; color: var(--text-light); }
        .tl-row { position: relative; width: 50%; box-sizing: border-box; padding: 0 40px 18px; }
        .tl-row-left { left: 0; }
        .tl-row-right { left: 50%; }
        .tl-node { position: absolute; top: 18px; width: 14px; height: 14px; background: var(--bg); border: 2px solid var(--accent); border-radius: 50%; z-index: 2; }
        .tl-row-left .tl-node { right: -7px; }
        .tl-row-right .tl-node { left: -7px; }
        .tl-card { width: 100%; display: flex; flex-direction: column; gap: 5px; text-align: left;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 0; padding: 13px 16px; cursor: pointer;
          opacity: 0; transform: translateX(var(--tl-dx, 24px));
          transition: opacity 600ms var(--ease-out), transform 600ms var(--ease-out), border-color 160ms ease, box-shadow 200ms ease; }
        .tl-row-left .tl-card { --tl-dx: -24px; text-align: right; align-items: flex-end; }
        .tl-row-right .tl-card { --tl-dx: 24px; }
        .tl-in .tl-card { opacity: 1; transform: translateX(0); }
        .tl-card:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .tl-card-head { display: inline-flex; align-items: center; gap: 8px; }
        .tl-row-left .tl-card-head { flex-direction: row-reverse; }
        .tl-year { font-family: var(--font-display); font-size: 1.1rem; font-weight: 600; color: var(--accent-text); }
        .tl-name { font-family: var(--font-display); font-size: 15px; color: var(--ink); line-height: 1.3; }
        .tl-meta { display: flex; gap: 12px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
        .tl-row-left .tl-meta { justify-content: flex-end; }
        .tl-date { display: inline-flex; align-items: center; gap: 4px; color: var(--accent-text); }
        .tl-place { display: inline-flex; align-items: center; gap: 4px; }
        @media (prefers-reduced-motion: reduce) {
          .tl-card { opacity: 1; transform: none; transition: border-color 160ms ease, box-shadow 200ms ease; }
          .tl-card:hover { transform: none; }
        }
        @media (max-width: 680px) {
          .tl::before { left: 16px; }
          .tl-row, .tl-row-left, .tl-row-right { width: 100%; left: 0; padding: 0 0 16px 44px; }
          .tl-row .tl-card, .tl-row-left .tl-card { text-align: left; align-items: flex-start; --tl-dx: 24px; }
          .tl-row-left .tl-card-head { flex-direction: row; }
          .tl-row-left .tl-meta { justify-content: flex-start; }
          .tl-node { left: 9px !important; right: auto !important; }
        }

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
