'use client';
import { useMemo, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Home, Cake, Clock, Sparkles, Sprout, Plus,
  TreePine, Users, Calendar, BookOpen, ScanFace,
} from 'lucide-react';
import PersonAvatar from '../person/PersonAvatar';
import { FamilyTree, ViewMode } from '@/types';
import {
  computeTreeStats, getUpcomingAnniversaries, getAge, getDisplayName,
} from '@/lib/treeUtils';

interface Props {
  trees: FamilyTree[];
  activeTree?: FamilyTree | null;
  canEdit?: boolean;
  displayName?: string | null;
  userEmail?: string | null;
  onNavigate: (v: ViewMode) => void;
  /** Open the tree selector / creation flow. */
  onNewTree: () => void;
  /** Open the add-person flow on the active tree. */
  onAddPerson: () => void;
  /** Switch to a person's tree (if needed) and open their panel. */
  onSelectPerson: (treeId: string, personId: string) => void;
  /** Open the AI narrative report modal (active tree). */
  onNarrative: () => void;
  /** Open the AI face-recognition photo analyzer. */
  onAnalyzePhoto: () => void;
}

/** Locale-aware coarse relative time (past only), e.g. "2 days ago" / "il y a 2 jours". */
function relativeTime(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const day = 86400000;
  const days = Math.floor(diff / day);
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'fr', { numeric: 'auto' });
  if (days <= 0) return rtf.format(0, 'day');
  if (days < 7) return rtf.format(-days, 'day');
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week');
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
  return rtf.format(-Math.floor(days / 365), 'year');
}

function firstNameOf(displayName?: string | null, email?: string | null): string {
  const src = (displayName || '').trim();
  if (src) return src.split(/\s+/)[0];
  const local = (email || '').split('@')[0] || '';
  if (!local) return '';
  const token = local.split(/[._-]+/)[0] || local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function earliestYear(tree?: FamilyTree | null): number | null {
  if (!tree) return null;
  let min = Infinity;
  for (const p of tree.persons) {
    const y = p.birthDate ? new Date(p.birthDate).getFullYear() : NaN;
    if (!Number.isNaN(y) && y < min) min = y;
  }
  return Number.isFinite(min) ? min : null;
}

// ---------- shared card chrome ----------

function Card({ children, eyebrow, title, Icon, full, delay, warm }: {
  children: ReactNode; eyebrow?: string; title?: string; Icon?: typeof Home; full?: boolean; delay: number; warm?: boolean;
}) {
  return (
    <section
      className={`dash-card animate-fade-in ${warm ? 'dash-card-warm' : ''}`}
      style={{ animationDelay: `${delay}s`, gridColumn: full ? '1 / -1' : undefined }}
    >
      {(title || eyebrow) && (
        <header style={{ marginBottom: '14px' }}>
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--accent-text)', marginBottom: '5px' }}>
            {Icon && <Icon size={14} aria-hidden="true" />}
            {eyebrow}
          </div>
          {title && <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</h3>}
        </header>
      )}
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{children}</p>;
}

export default function DashboardView({ trees, activeTree, canEdit = true, displayName, userEmail, onNavigate, onNewTree, onAddPerson, onSelectPerson, onNarrative, onAnalyzePhoto }: Props) {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const tp = useTranslations('photoAnalyzer');
  const locale = useLocale();
  const en = locale === 'en';
  const firstName = firstNameOf(displayName, userEmail);
  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(en ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [en]);

  // Active-tree figures drive the hero + the big stat row.
  const stats = useMemo(() => {
    if (!activeTree || activeTree.persons.length === 0) return null;
    const s = computeTreeStats(activeTree);
    const aged = activeTree.persons
      .map(p => ({ name: getDisplayName(p), age: getAge(p.birthDate, p.deathDate) ?? -1, alive: p.isAlive }))
      .filter(x => x.age >= 0);
    const elder = aged.sort((a, b) => b.age - a.age)[0] ?? null;
    return { members: activeTree.persons.length, generations: s.totalGenerations, since: earliestYear(activeTree), elder };
  }, [activeTree]);

  // Birthdays within the next 30 days, all trees, soonest first.
  const birthdays = useMemo(() => {
    const all = trees.flatMap(tr => getUpcomingAnniversaries(tr.persons, tr.relationships, 30).filter(a => a.type === 'birthday'));
    return all.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
  }, [trees]);

  // 5 most recently created/edited persons, all trees.
  const recent = useMemo(() => {
    const all = trees.flatMap(tr => tr.persons.map(p => ({ person: p, treeId: tr.id, treeName: tr.name })));
    return all
      .filter(x => x.person.updatedAt)
      .sort((a, b) => new Date(b.person.updatedAt).getTime() - new Date(a.person.updatedAt).getTime())
      .slice(0, 5);
  }, [trees]);

  const hasTree = !!stats;

  // Quick access kept to 4 essentials (the rest live in the sidebar nav).
  const QUICK: { view: ViewMode; Icon: typeof Home; navKey: string }[] = [
    { view: 'tree', Icon: TreePine, navKey: 'tree' },
    { view: 'list', Icon: Users, navKey: 'persons' },
    { view: 'timeline', Icon: Calendar, navKey: 'timeline' },
    { view: 'journal', Icon: BookOpen, navKey: 'journal' },
  ];

  const heroTitle = activeTree?.name || (firstName ? t('greeting', { name: firstName }) : t('greetingGeneric'));
  const subtitle = stats
    ? (en
        ? `Your lineage holds ${stats.members} members across ${stats.generations} generations${stats.since ? ` — since ~${stats.since}` : ''}`
        : `Votre lignée compte ${stats.members} membres sur ${stats.generations} générations${stats.since ? ` — depuis ~${stats.since}` : ''}`)
    : null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'radial-gradient(130% 80% at 50% -5%, rgba(201,168,76,0.05), transparent 58%), var(--bg)' }}>
      <div className="dash-wrap">

        {/* HERO — the active tree's name dominates the view. */}
        <header className="dash-hero animate-fade-in">
          <div className="label" style={{ color: 'var(--accent-text)', marginBottom: '14px' }}>
            {today}{firstName ? `  ·  ${t('greeting', { name: firstName }).replace(/\s*!\s*$/, '')}` : ''}
          </div>
          <h1 className="display-xxl">{heroTitle}</h1>
          <hr className="rule-accent" style={{ marginTop: '18px', width: '80px' }} />
          {subtitle ? (
            <p className="dash-subtitle mono">{subtitle}</p>
          ) : (
            <p style={{ margin: '18px 0 0', color: 'var(--text-muted)', fontSize: '16px', fontStyle: 'italic', maxWidth: '46ch' }}>{t('noTree')}</p>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
            {hasTree && canEdit && (
              <button onClick={onAddPerson} className="btn btn-primary"><Plus size={16} aria-hidden="true" /> {ts('addPerson')}</button>
            )}
            {hasTree && (
              <button onClick={() => onNavigate('tree')} className="btn btn-secondary"><TreePine size={16} aria-hidden="true" /> {tn('tree')}</button>
            )}
            {!hasTree && (
              <button onClick={onNewTree} className="btn btn-primary btn-lg" style={{ gap: '8px' }}>
                <Sprout size={18} aria-hidden="true" /> {t('createFirst')}
              </button>
            )}
          </div>
        </header>

        {/* BIG STATS — three horizontal cards, massive figures, terracotta edge. */}
        {stats && (
          <div className="dash-stats">
            <BigStat value={stats.members} label={en ? 'Members' : 'Membres'} delay={0.05} />
            <BigStat value={stats.generations} label={en ? 'Generations' : 'Générations'} delay={0.1} />
            <BigStat
              value={stats.elder ? stats.elder.age : '·'}
              label={en ? 'Eldest' : 'Doyen·ne'}
              sublabel={stats.elder ? stats.elder.name : undefined}
              delay={0.15}
            />
          </div>
        )}

        {/* SECONDARY — birthdays, activity, quick access, AI. */}
        <div className="dash-grid">
          <Card eyebrow={t('birthdaysEyebrow')} title={t('birthdays')} Icon={Cake} delay={0.2} warm>
            {birthdays.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {birthdays.map((a, i) => {
                  const d = new Date(a.date);
                  const when = d.toLocaleDateString(en ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' });
                  return (
                    <li key={`${a.person.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Cake size={15} aria-hidden="true" style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                      <span className="mono" style={{ width: '40px', textAlign: 'right', flexShrink: 0, fontWeight: 700, color: 'var(--accent-text)', fontSize: '13px' }}>{a.daysUntil === 0 ? t('todayShort') : t('daysShort', { days: a.daysUntil })}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(a.person)}</div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{when} · {t('birthdayTurning', { age: a.age ?? 0 })}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyLine>{t('noBirthdays')}</EmptyLine>
            )}
          </Card>

          <Card eyebrow={t('activityEyebrow')} title={t('activity')} Icon={Clock} delay={0.25}>
            {recent.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {recent.map(({ person, treeId, treeName }) => (
                  <li key={person.id}>
                    <button onClick={() => onSelectPerson(treeId, person.id)} className="dash-recent">
                      <PersonAvatar person={person} size={36} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(person)}</span>
                        <span className="mono" style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{treeName} · {relativeTime(person.updatedAt, locale)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t('noPersons')}</EmptyLine>
            )}
          </Card>

          <Card eyebrow={t('quickAccessEyebrow')} title={t('quickAccess')} Icon={Home} delay={0.3}>
            <div className="dash-quick">
              {QUICK.map(q => (
                <button key={q.view} onClick={() => onNavigate(q.view)} className="dash-quick-btn">
                  <q.Icon size={18} aria-hidden="true" />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{tn(q.navKey)}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card eyebrow={t('narrativeEyebrow')} title={t('narrative')} Icon={Sparkles} delay={0.35}>
            <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '13px' }}>{t('narrativeIntro')}</p>
            <button onClick={onNarrative} disabled={!stats} title={!stats ? t('narrativeNeedsTree') : undefined} className="btn btn-primary btn-sm" style={{ gap: '7px' }}>
              <Sparkles size={15} aria-hidden="true" /> {t('generate')}
            </button>
          </Card>

          <Card eyebrow={tp('cardTitle')} title={tp('title')} Icon={ScanFace} delay={0.4}>
            <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '13px' }}>{tp('subtitle')}</p>
            <button onClick={onAnalyzePhoto} className="btn btn-primary btn-sm" style={{ gap: '7px' }}>
              <ScanFace size={15} aria-hidden="true" /> {tp('analyzeAPhoto')}
            </button>
          </Card>
        </div>
      </div>

      <style>{`
        .dash-wrap { padding: 40px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
        .dash-hero { padding: 8px 0 4px; }
        .dash-subtitle { margin: 16px 0 0; font-size: 13px; color: var(--accent-text); opacity: 0.82; letter-spacing: 0.04em; }

        .dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        .dash-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-content: start; }
        .dash-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 24px 26px;
          box-shadow: var(--shadow-sm);
          display: flex; flex-direction: column;
        }
        .dash-card-warm {
          background: linear-gradient(150% 120% at 0% 0%, rgba(201,168,76,0.07), transparent 55%), var(--bg-card);
          border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
        }

        .dash-recent { width: 100%; display: flex; align-items: center; gap: 11px; padding: 8px; border: none; background: transparent; cursor: pointer; text-align: left; transition: background var(--t-fast); }
        .dash-recent:hover { background: var(--bg-muted); }
        .dash-recent-av { width: 34px; height: 34px; flex-shrink: 0; background: var(--accent-light); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border); }

        .dash-quick { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .dash-quick-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
          padding: 14px 6px; min-height: 64px; cursor: pointer;
          background: var(--bg); border: var(--bw) solid var(--border); color: var(--text-muted);
          transition: transform var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out), color var(--t-fast), border-color var(--t-fast);
        }
        .dash-quick-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-accent); background: var(--accent); color: #0d0d0d; border-color: var(--accent); }
        @media (prefers-reduced-motion: reduce) { .dash-quick-btn:hover { transform: none; } }

        @media (max-width: 1000px) {
          .dash-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 720px) {
          .dash-wrap { padding: 20px; gap: 20px; }
          .dash-stats { grid-template-columns: 1fr; }
          .dash-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

/** Massive terracotta figure on a card with a left terracotta edge. */
function BigStat({ value, label, sublabel, delay }: { value: string | number; label: string; sublabel?: string; delay: number }) {
  return (
    <div className="dash-bigstat animate-fade-in" style={{ animationDelay: `${delay}s` }}>
      <div className="dash-bigstat-num">{value}</div>
      <div className="label dash-bigstat-label" style={{ marginTop: '8px' }}>{label}</div>
      {sublabel && (
        <div title={sublabel} style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{sublabel}</div>
      )}
      <style>{`
        .dash-bigstat {
          background: var(--bg-card); border: 1px solid var(--border);
          border-left: 3px solid var(--accent); padding: 26px 28px 24px;
          box-shadow: var(--shadow-sm);
          display: flex; flex-direction: column;
          transition: box-shadow var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out);
        }
        .dash-bigstat:hover { box-shadow: var(--shadow-accent); border-left-color: var(--accent-hover); transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) { .dash-bigstat:hover { transform: none; } }
        .dash-bigstat-num {
          font-family: var(--font-display); font-weight: 700; line-height: 0.92;
          font-size: clamp(3.2rem, 6vw, 4rem); color: var(--accent);
          letter-spacing: -0.015em;
        }
        .dash-bigstat-label { color: var(--accent-text); opacity: 0.72; }
      `}</style>
    </div>
  );
}
