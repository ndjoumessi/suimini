'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { Network, ArrowLeftRight, Scale, TreePine, Sprout, AlertCircle, Dna, ChevronDown } from 'lucide-react';
import { GENDER_BAR } from '../tree/nodeStyle';
import { PersonCombobox } from '../ui/PersonCombobox';
import {
  getDisplayName, formatYear, formatAge, getAllAncestors, getAllDescendants,
  findCommonAncestors, findRelationPath, describeRelation, getAge,
} from '@/lib/treeUtils';

const MODE_META = {
  relation: { Icon: ArrowLeftRight, labelKey: 'modeRelation' },
  compare: { Icon: Scale, labelKey: 'modeCompare' },
  ancestors: { Icon: TreePine, labelKey: 'modeAncestors' },
  descendants: { Icon: Sprout, labelKey: 'modeDescendants' },
} as const;

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

function genderColor(p: Person): string {
  return p.gender === 'male' ? GENDER_BAR.male : p.gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
}
function initials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}

export default function AncestorsView({ tree, onSelectPerson }: Props) {
  const t = useTranslations('ancestors');
  const [person1Id, setPerson1Id] = useState('');
  const [person2Id, setPerson2Id] = useState('');
  const [mode, setMode] = useState<'relation' | 'compare' | 'ancestors' | 'descendants'>('relation');
  const [ancestorsOpen, setAncestorsOpen] = useState(true);
  const dual = mode === 'relation' || mode === 'compare';

  const person1 = tree.persons.find(p => p.id === person1Id) || null;
  const person2 = tree.persons.find(p => p.id === person2Id) || null;

  // ---- LOGIC (unchanged) ----
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
  // ---- /LOGIC ----

  const showEmpty = !person1Id || (dual && !person2Id);

  return (
    <div className="ex-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="ex-scroll">
        <div className="ex-wrap">
          {/* HERO */}
          <header className="ex-hero">
            <Network size={24} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h1 className="serif ex-title">{t('title')}</h1>
              <p className="ex-subtitle">{t('subtitle')}</p>
            </div>
          </header>

          {/* Tabs */}
          <div className="ex-tabs" role="tablist" aria-label={t('title')}>
            {(['relation', 'compare', 'ancestors', 'descendants'] as const).map(m => {
              const { Icon, labelKey } = MODE_META[m];
              const on = mode === m;
              return (
                <button key={m} role="tab" aria-selected={on} onClick={() => setMode(m)} className={`ex-tab ${on ? 'on' : ''}`}>
                  <Icon size={15} aria-hidden="true" /> {t(labelKey)}
                </button>
              );
            })}
          </div>

          {/* Selectors */}
          <div className="ex-selectors">
            <div className="ex-field">
              <label className="ex-flabel" id="ex-p1-label" htmlFor="ex-p1">{dual ? t('personA') : t('person')}</label>
              <PersonCombobox
                id="ex-p1"
                persons={tree.persons}
                selectedId={person1Id}
                onSelect={setPerson1Id}
                placeholder={t('choosePlaceholder')}
                emptySearchLabel={t('noPersonFound')}
                ariaLabelledBy="ex-p1-label"
              />
            </div>
            {dual && (
              <>
                <span className="ex-swap" aria-hidden="true"><ArrowLeftRight size={20} /></span>
                <div className="ex-field">
                  <label className="ex-flabel" id="ex-p2-label" htmlFor="ex-p2">{t('personB')}</label>
                  <PersonCombobox
                    id="ex-p2"
                    persons={tree.persons}
                    selectedId={person2Id}
                    onSelect={setPerson2Id}
                    excludeIds={[person1Id]}
                    placeholder={t('choosePlaceholder')}
                    emptySearchLabel={t('noPersonFound')}
                    ariaLabelledBy="ex-p2-label"
                  />
                </div>
              </>
            )}
          </div>

          {/* ===== RELATION ===== */}
          {mode === 'relation' && person1 && person2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="ex-result">
                <button className="ex-party" onClick={() => onSelectPerson(person1.id)}>
                  <Avatar person={person1} size={56} />
                  <span className="serif ex-party-name">{person1.firstName || person1.lastName}</span>
                  {person1.lastName && person1.firstName && <span className="ex-party-sub">{person1.lastName}</span>}
                  {person1.birthDate && <span className="ex-party-year">{formatYear(person1.birthDate)}</span>}
                </button>

                <div className="ex-link">
                  <span className="ex-link-arrow" aria-hidden="true">←</span>
                  {relation ? (
                    <span className="serif ex-relation">{relation}</span>
                  ) : (
                    <span className="ex-nolink"><AlertCircle size={14} aria-hidden="true" /> {t('noFamilyLink')}</span>
                  )}
                  <span className="ex-link-arrow" aria-hidden="true">→</span>
                  {relation && relationPath && (
                    <span className="ex-degree">{t('degrees', { count: relationPath.length - 1 })}</span>
                  )}
                </div>

                <button className="ex-party" onClick={() => onSelectPerson(person2.id)}>
                  <Avatar person={person2} size={56} />
                  <span className="serif ex-party-name">{person2.firstName || person2.lastName}</span>
                  {person2.lastName && person2.firstName && <span className="ex-party-sub">{person2.lastName}</span>}
                  {person2.birthDate && <span className="ex-party-year">{formatYear(person2.birthDate)}</span>}
                </button>
              </div>

              {/* Kinship path */}
              {pathPersons.length > 2 && (
                <div className="ex-card">
                  <div className="ex-eyebrow">{t('kinshipPath')}</div>
                  <div className="ex-path">
                    {pathPersons.map((p, i) => (
                      <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button className="ex-path-chip" onClick={() => onSelectPerson(p.id)} style={{ ['--bar' as string]: genderColor(p) }}>
                          <span className="ex-path-dot" aria-hidden="true" />
                          {getDisplayName(p)}
                        </button>
                        {i < pathPersons.length - 1 && <span className="ex-path-sep" aria-hidden="true">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Common ancestors — collapsible grid */}
              {commonAncestors.length > 0 && (
                <CommonAncestors persons={commonAncestors} open={ancestorsOpen} onToggle={() => setAncestorsOpen(o => !o)} label={t('commonAncestors', { count: commonAncestors.length })} onSelect={onSelectPerson} />
              )}
            </div>
          )}

          {/* ===== COMPARE ===== */}
          {mode === 'compare' && person1 && person2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="ex-result">
                <button className="ex-party" onClick={() => onSelectPerson(person1.id)}>
                  <Avatar person={person1} size={56} />
                  <span className="serif ex-party-name">{person1.firstName || person1.lastName}</span>
                  {person1.birthDate && <span className="ex-party-year">{formatYear(person1.birthDate)}</span>}
                </button>
                <div className="ex-link">
                  <Scale size={20} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  {relation ? <span className="serif ex-relation" style={{ fontSize: '1.1rem' }}>{relation}</span>
                    : <span className="ex-nolink">{t('noDirectLink')}</span>}
                </div>
                <button className="ex-party" onClick={() => onSelectPerson(person2.id)}>
                  <Avatar person={person2} size={56} />
                  <span className="serif ex-party-name">{person2.firstName || person2.lastName}</span>
                  {person2.birthDate && <span className="ex-party-year">{formatYear(person2.birthDate)}</span>}
                </button>
              </div>

              {/* Comparison table — 2 columns split by a gold rule */}
              <div className="ex-card">
                <div className="ex-eyebrow">{t('compareFichesTitle')}</div>
                <div className="ex-legend">
                  <span className="ex-legend-swatch" aria-hidden="true" /> {t('legendCommon')} · {t('legendDifferent')}
                </div>
                <div className="ex-table">
                  {COMPARE_FIELDS.map(f => {
                    const a = f.get(person1, t); const b = f.get(person2, t);
                    const same = !!a && !!b && a.toLowerCase() === b.toLowerCase();
                    return (
                      <div className="ex-trow" key={f.labelKey}>
                        <div className={`ex-tcell ${same ? 'same' : ''} ${a ? '' : 'empty'}`}>{a || '—'}</div>
                        <div className="ex-tlabel">{same ? '✓ ' : ''}{t(f.labelKey)}</div>
                        <div className={`ex-tcell ${same ? 'same' : ''} ${b ? '' : 'empty'}`}>{b || '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DNA */}
              {((person1.dnaOrigins?.length || 0) > 0 || (person2.dnaOrigins?.length || 0) > 0) && (() => {
                const regionsA = new Set((person1.dnaOrigins || []).map(d => d.region.toLowerCase()));
                const regionsB = new Set((person2.dnaOrigins || []).map(d => d.region.toLowerCase()));
                const chip = (region: string, percent: number, shared: boolean) => (
                  <span key={region} className="ex-dna-chip" style={shared ? { background: 'var(--success)', color: 'var(--ink-on-accent)', borderColor: 'var(--success)' } : undefined}>
                    {region} {Math.round(percent)}%
                  </span>
                );
                return (
                  <div className="ex-card">
                    <div className="ex-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Dna size={13} aria-hidden="true" /> {t('originsAndDna')}</div>
                    <div className="ex-dna-grid">
                      <div className="ex-dna-col">
                        {(person1.dnaOrigins || []).length === 0 ? <span className="ex-dash">—</span>
                          : (person1.dnaOrigins || []).map(d => chip(d.region, d.percent, regionsB.has(d.region.toLowerCase())))}
                      </div>
                      <div className="ex-dna-col">
                        {(person2.dnaOrigins || []).length === 0 ? <span className="ex-dash">—</span>
                          : (person2.dnaOrigins || []).map(d => chip(d.region, d.percent, regionsA.has(d.region.toLowerCase())))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Common ancestors */}
              {commonAncestors.length === 0 ? (
                <p className="ex-empty-elegant serif">{t('noCommonAncestor')}</p>
              ) : (
                <CommonAncestors persons={commonAncestors} open={ancestorsOpen} onToggle={() => setAncestorsOpen(o => !o)} label={t('commonAncestors', { count: commonAncestors.length })} onSelect={onSelectPerson} />
              )}
            </div>
          )}

          {/* ===== ANCESTORS ===== */}
          {mode === 'ancestors' && person1 && (
            <div className="animate-fade-in">
              <p className="ex-found">{t.rich('ancestorsFoundFor', { count: ancestors.length, name: getDisplayName(person1), strong: (c) => <strong>{c}</strong> })}</p>
              {ancestors.length === 0 ? (
                <p className="ex-empty-elegant serif">{t('noAncestorRecorded')}</p>
              ) : (
                <div className="ex-anc-grid">
                  {ancestors.map(p => <AncestorCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />)}
                </div>
              )}
            </div>
          )}

          {/* ===== DESCENDANTS ===== */}
          {mode === 'descendants' && person1 && (
            <div className="animate-fade-in">
              <p className="ex-found">{t.rich('descendantsFoundFor', { count: descendants.length, name: getDisplayName(person1), strong: (c) => <strong>{c}</strong> })}</p>
              {descendants.length === 0 ? (
                <p className="ex-empty-elegant serif">{t('noDescendantRecorded')}</p>
              ) : (
                <div className="ex-anc-grid">
                  {descendants.map(p => <AncestorCard key={p.id} person={p} onClick={() => onSelectPerson(p.id)} />)}
                </div>
              )}
            </div>
          )}

          {/* ===== EMPTY STATE ===== */}
          {showEmpty && (
            <div className="ex-empty animate-fade-in">
              <UnlinkedNodes />
              <p className="ex-empty-text">{!person1Id ? t('selectFirstPrompt') : t('selectSecondPrompt')}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ex-scroll { flex: 1; overflow-y: auto; }
        .ex-wrap { max-width: 880px; margin: 0 auto; padding: 0 24px 48px; }
        .ex-hero { display: flex; align-items: flex-start; gap: 14px; padding: 36px 0 24px; border-bottom: 1px solid var(--accent-light); margin-bottom: 22px; }
        .ex-title { margin: 0; font-size: clamp(1.9rem, 4vw, 2.5rem); line-height: 1.05; color: var(--ink); letter-spacing: -0.01em; }
        .ex-subtitle { margin: 6px 0 0; font-size: 15px; color: var(--text-muted); }

        /* Tabs */
        .ex-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
        .ex-tab { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; min-height: 40px; font-family: var(--font-body); font-size: 13.5px; font-weight: 600; cursor: pointer; background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-full); transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast); }
        .ex-tab:hover { background: var(--interactive); color: var(--ink); border-color: var(--accent); }
        .ex-tab.on { background: var(--accent); color: var(--ink-on-accent); font-weight: 700; border-color: var(--accent); }
        .ex-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* Selectors */
        .ex-selectors { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 24px; }
        .ex-field { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
        .ex-flabel { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-text); }
        .ex-swap { display: inline-flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; height: 40px; }

        /* Result card */
        .ex-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: 22px 20px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; }
        .ex-party { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; padding: 6px; min-width: 0; }
        .ex-party:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ex-party-name { font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 4px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ex-party-sub { font-size: 12px; color: var(--text-muted); }
        .ex-party-year { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); }
        .ex-link { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; min-width: 120px; }
        .ex-link-arrow { display: none; }
        .ex-relation { font-size: clamp(1.1rem, 2.5vw, 1.5rem); font-weight: 700; color: var(--accent-text); line-height: 1.1; }
        .ex-degree { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .ex-nolink { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-muted); }

        /* Generic card + eyebrow */
        .ex-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: 16px 18px; }
        .ex-eyebrow { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 12px; }

        /* Kinship path */
        .ex-path { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .ex-path-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius-full); cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--text); transition: border-color var(--t-fast), background var(--t-fast); }
        .ex-path-chip:hover { border-color: var(--accent); background: var(--accent-light); }
        .ex-path-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ex-path-dot { width: 8px; height: 8px; flex-shrink: 0; background: var(--bar); }
        .ex-path-sep { color: var(--text-light); font-size: 15px; }

        /* Common ancestors */
        .ex-anc-toggle { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 14px; }
        .ex-anc-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ex-anc-chevron { color: var(--accent-text); transition: transform var(--t-base) var(--ease-out); }
        .ex-anc-chevron.closed { transform: rotate(-90deg); }
        .ex-anc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
        .ex-acard { display: flex; align-items: center; gap: 10px; padding: 9px 11px; background: var(--surface-3); border: 1px solid var(--border); border-left: 4px solid var(--bar); border-radius: var(--radius); cursor: pointer; text-align: left; transition: border-color var(--t-fast), background var(--t-fast); }
        .ex-acard:hover { border-color: var(--accent); border-left-color: var(--bar); background: var(--interactive); }
        .ex-acard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ex-acard-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .ex-acard-name { font-family: var(--font-display); font-size: 13.5px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ex-acard-dates { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent-text); }

        /* Avatar */
        .ex-avatar { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; color: var(--ink-on-accent); border-radius: var(--radius-sm); overflow: hidden; }
        .ex-avatar img { width: 100%; height: 100%; object-fit: cover; }

        /* Compare table */
        .ex-legend { font-size: 11px; color: var(--text-light); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .ex-legend-swatch { width: 10px; height: 10px; background: var(--success); display: inline-block; }
        .ex-table { display: flex; flex-direction: column; gap: 6px; }
        .ex-trow { display: grid; grid-template-columns: 1fr 130px 1fr; align-items: center; gap: 0; }
        .ex-tcell { padding: 7px 10px; font-size: 13px; font-weight: 600; text-align: center; background: var(--bg-muted); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ex-tcell.same { background: var(--success); color: var(--ink-on-accent); }
        .ex-tcell.empty { color: var(--text-light); font-weight: 400; }
        .ex-tlabel { text-align: center; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light); border-left: 1px solid var(--accent-light); border-right: 1px solid var(--accent-light); padding: 0 8px; }

        /* DNA */
        .ex-dna-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ex-dna-col { display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
        .ex-dna-chip { font-family: var(--font-mono); font-size: 11px; padding: 3px 8px; background: var(--bg-muted); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ex-dash { font-size: 12px; color: var(--text-light); }

        /* Found line */
        .ex-found { font-size: 14px; color: var(--text-muted); margin: 0 0 16px; }

        /* Empty states */
        .ex-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; padding: 56px 20px; }
        .ex-empty-text { margin: 0; color: var(--text-muted); font-size: 15px; max-width: 36ch; }
        .ex-empty-elegant { color: var(--text-muted); font-style: italic; font-size: 17px; text-align: center; padding: 36px 20px; margin: 0; }

        @media (max-width: 560px) {
          .ex-result { grid-template-columns: 1fr; gap: 18px; }
          .ex-dna-grid { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ex-anc-chevron { transition: none; }
        }
      `}</style>
    </div>
  );
}

/** Square gender-coloured avatar (photo when present). */
function Avatar({ person, size }: { person: Person; size: number }) {
  const bg = genderColor(person);
  return (
    <span className="ex-avatar" style={{ width: size, height: size, background: person.profilePhoto ? 'var(--bg-muted)' : bg, fontSize: size * 0.34 }} aria-hidden="true">
      {person.profilePhoto ? <img src={person.profilePhoto} alt="" loading="lazy" decoding="async" /> : initials(person)}
    </span>
  );
}

function CommonAncestors({ persons, open, onToggle, label, onSelect }: { persons: Person[]; open: boolean; onToggle: () => void; label: string; onSelect: (id: string) => void }) {
  return (
    <div className="ex-card">
      <button className="ex-anc-toggle" onClick={onToggle} aria-expanded={open}>
        <ChevronDown size={15} aria-hidden="true" className={`ex-anc-chevron ${open ? '' : 'closed'}`} />
        <span className="ex-eyebrow" style={{ margin: 0 }}>{label}</span>
      </button>
      {open && (
        <div className="ex-anc-grid animate-fade-in">
          {persons.map(p => <AncestorCard key={p.id} person={p} onClick={() => onSelect(p.id)} />)}
        </div>
      )}
    </div>
  );
}

function AncestorCard({ person, onClick }: { person: Person; onClick: () => void }) {
  const age = getAge(person.birthDate, person.deathDate);
  return (
    <button className="ex-acard" onClick={onClick} style={{ ['--bar' as string]: genderColor(person) }}>
      <Avatar person={person} size={40} />
      <span className="ex-acard-body">
        <span className="ex-acard-name">{getDisplayName(person)}</span>
        <span className="ex-acard-dates">
          {formatYear(person.birthDate)}
          {!person.isAlive && person.deathDate ? ` – ${formatYear(person.deathDate)}` : ''}
          {age !== null ? ` · ${formatAge(age)}` : ''}
        </span>
      </span>
    </button>
  );
}

/** Empty-state illustration: two unconnected nodes. */
function UnlinkedNodes() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none" aria-hidden="true">
      <rect x="6" y="20" width="40" height="24" fill="var(--bg-card)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="74" y="20" width="40" height="24" fill="var(--bg-card)" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="50" y1="32" x2="70" y2="32" stroke="var(--text-light)" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="60" cy="32" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

type CompareT = (key: string) => string;
const COMPARE_FIELDS: { labelKey: string; get: (p: Person, t: CompareT) => string }[] = [
  { labelKey: 'fieldSex', get: (p, t) => p.gender === 'male' ? t('valueMale') : p.gender === 'female' ? t('valueFemale') : p.gender === 'other' ? t('valueOther') : '' },
  { labelKey: 'fieldBirth', get: p => formatYear(p.birthDate) },
  { labelKey: 'fieldBirthPlace', get: p => p.birthPlace?.city || '' },
  { labelKey: 'fieldStatus', get: (p, t) => p.isAlive ? t('valueAlive') : t('valueDeceased') },
  { labelKey: 'fieldDeath', get: p => p.deathDate ? formatYear(p.deathDate) : '' },
  { labelKey: 'fieldDeathPlace', get: p => p.deathPlace?.city || '' },
  { labelKey: 'fieldOccupation', get: p => p.occupation || '' },
  { labelKey: 'fieldNationality', get: p => p.nationality || '' },
  { labelKey: 'fieldReligion', get: p => p.religion || '' },
];
