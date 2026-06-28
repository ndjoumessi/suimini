'use client';
import { useMemo, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Cake, Clock, Sparkles, Sprout, Plus, ScanFace,
  TreePine, Users, Calendar, BookOpen, BarChart3, Layers, Crown, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PersonAvatar from '../person/PersonAvatar';
import { FamilyTree, Person, ViewMode } from '@/types';
import {
  computeTreeStats, getUpcomingAnniversaries, getAge, getDisplayName, formatYear,
  getSpouses, getParents, getGeneration,
} from '@/lib/treeUtils';

interface Props {
  trees: FamilyTree[];
  activeTree?: FamilyTree | null;
  canEdit?: boolean;
  displayName?: string | null;
  userEmail?: string | null;
  onNavigate: (v: ViewMode) => void;
  onNewTree: () => void;
  onAddPerson: () => void;
  onSelectPerson: (treeId: string, personId: string) => void;
  onNarrative: () => void;
  onAnalyzePhoto: () => void;
}

/** Locale-aware coarse relative time (past only). */
function relativeTime(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = 60000, hour = 3600000, day = 86400000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'fr', { numeric: 'auto' });
  if (diff < hour) return rtf.format(-Math.max(1, Math.floor(diff / min)), 'minute');
  if (diff < day) return rtf.format(-Math.floor(diff / hour), 'hour');
  const days = Math.floor(diff / day);
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

/** Earliest real birth year across the tree's people. Extracts a plausible 4-digit
 *  year straight from the stored value (handles partial/approx strings and avoids
 *  new Date() timezone quirks on very old dates), ignores implausible years, and
 *  returns null when NO person has a usable birth date (so the UI shows nothing
 *  rather than a bogus default). */
function earliestYear(tree?: FamilyTree | null): number | null {
  if (!tree) return null;
  const nowYear = new Date().getFullYear();
  let min = Infinity;
  for (const p of tree.persons) {
    if (!p.birthDate) continue;
    const m = String(p.birthDate).match(/\d{4}/);
    const y = m ? Number(m[0]) : NaN;
    if (Number.isFinite(y) && y >= 1000 && y <= nowYear && y < min) min = y;
  }
  return Number.isFinite(min) ? min : null;
}

function memberDates(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (!p.isAlive) return b && d ? `${b} – ${d}` : d ? `† ${d}` : b ? `${b} – ?` : '';
  return b || '';
}

export default function DashboardView({ trees, activeTree, canEdit = true, displayName, userEmail, onNavigate, onNewTree, onAddPerson, onSelectPerson, onNarrative, onAnalyzePhoto }: Props) {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const locale = useLocale();
  const en = locale === 'en';
  const firstName = firstNameOf(displayName, userEmail);

  const today = useMemo(
    () => new Date().toLocaleDateString(en ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [en],
  );

  // Active-tree figures. DOYEN·NE = oldest LIVING person (fixes the 176 bug from
  // deceased people without a death date); falls back to the oldest deceased with
  // both dates (age at death) only when nobody living has a birth date.
  const stats = useMemo(() => {
    if (!activeTree || activeTree.persons.length === 0) return null;
    const s = computeTreeStats(activeTree);
    const living = activeTree.persons
      .filter(p => p.isAlive && p.birthDate)
      .map(p => ({ person: p, age: getAge(p.birthDate) ?? -1 }))
      .filter(x => x.age >= 0)
      .sort((a, b) => b.age - a.age);
    let elder = living[0] ?? null;
    if (!elder) {
      elder = activeTree.persons
        .filter(p => !p.isAlive && p.birthDate && p.deathDate)
        .map(p => ({ person: p, age: getAge(p.birthDate, p.deathDate) ?? -1 }))
        .filter(x => x.age >= 0)
        .sort((a, b) => b.age - a.age)[0] ?? null;
    }
    return { members: activeTree.persons.length, generations: s.totalGenerations, since: earliestYear(activeTree), elder };
  }, [activeTree]);

  // Birthdays: this month (30d). If none, fall back to the next 3 within 90 days.
  const birthdays = useMemo(() => {
    const within = (days: number) => trees
      .flatMap(tr => getUpcomingAnniversaries(tr.persons, tr.relationships, days).filter(a => a.type === 'birthday'))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    const month = within(30);
    if (month.length > 0) return { items: month.slice(0, 6), upcoming: false };
    return { items: within(90).slice(0, 3), upcoming: true };
  }, [trees]);

  // Recent activity with family context (kinship + generation).
  const recent = useMemo(() => {
    const all = trees.flatMap(tr => tr.persons.map(p => ({ person: p, tree: tr })));
    return all
      .filter(x => x.person.updatedAt)
      .sort((a, b) => new Date(b.person.updatedAt).getTime() - new Date(a.person.updatedAt).getTime())
      .slice(0, 5);
  }, [trees]);

  // Latest 4 members by creation date (active tree first, else all).
  const latest = useMemo(() => {
    const pool = activeTree ? activeTree.persons.map(p => ({ person: p, tree: activeTree })) : trees.flatMap(tr => tr.persons.map(p => ({ person: p, tree: tr })));
    return [...pool]
      .filter(x => x.person.createdAt)
      .sort((a, b) => new Date(b.person.createdAt).getTime() - new Date(a.person.createdAt).getTime())
      .slice(0, 4);
  }, [activeTree, trees]);

  const hasTree = !!stats;

  // Recent-activity sub-line: kinship + generation.
  const contextLine = (p: Person, tree: FamilyTree): string => {
    const sp = getSpouses(p.id, tree.relationships, tree.persons)[0];
    let ctx: string | null = null;
    if (sp) ctx = p.gender === 'female' ? t('spouseOfF', { name: getDisplayName(sp) }) : t('spouseOfM', { name: getDisplayName(sp) });
    else {
      const par = getParents(p.id, tree.relationships, tree.persons)[0];
      if (par) ctx = t('childOf', { name: getDisplayName(par) });
    }
    const gen = getGeneration(p.id, tree.relationships, tree.persons);
    return [ctx, t('generationLabel', { n: gen + 1 })].filter(Boolean).join('  ·  ');
  };

  const isAdded = (p: Person): boolean => {
    const created = new Date(p.createdAt).getTime();
    const updated = new Date(p.updatedAt).getTime();
    return Number.isFinite(created) && Number.isFinite(updated) && Math.abs(updated - created) < 60000;
  };
  const actionOf = (p: Person): string => (isAdded(p) ? t('actionAdded') : t('actionUpdated'));

  const QUICK: { view: ViewMode; Icon: typeof TreePine; navKey: string }[] = [
    { view: 'tree', Icon: TreePine, navKey: 'tree' },
    { view: 'list', Icon: Users, navKey: 'persons' },
    { view: 'timeline', Icon: Calendar, navKey: 'timeline' },
    { view: 'journal', Icon: BookOpen, navKey: 'journal' },
    { view: 'birthdays', Icon: Cake, navKey: 'birthdays' },
    { view: 'statistics', Icon: BarChart3, navKey: 'statistics' },
  ];

  return (
    <div className="dash-root" style={{ flex: 1, overflowY: 'auto', background: 'radial-gradient(130% 80% at 50% -5%, rgba(201,168,76,0.06), transparent 58%), var(--bg)' }}>
      <div className="dash-wrap">

        {/* ===== HERO ===== */}
        <header className="dash-hero">
          <div className="dash-hero-top">
            <span className="dash-date">{today}</span>
            {firstName && (
              <span className="dash-user">
                <span className="dash-user-ava">{firstName.charAt(0).toUpperCase()}</span>
                {firstName}
              </span>
            )}
          </div>
          <h1 className="dash-title">{hasTree ? activeTree!.name : (firstName ? t('greeting', { name: firstName }) : t('greetingGeneric'))}</h1>
          <span className="dash-rule" aria-hidden="true" />
          {hasTree ? (
            <p className="dash-sub">
              {t.rich('generationsCount', { count: stats!.generations, b: (c) => <b className="dash-fig">{c}</b> })}<span className="dash-dot">·</span>
              {t.rich('peopleCountInline', { count: stats!.members, b: (c) => <b className="dash-fig">{c}</b> })}
              {stats!.since ? <><span className="dash-dot">·</span>{t.rich('since', { year: stats!.since, b: (c) => <b className="dash-fig">{c}</b> })}</> : null}
            </p>
          ) : (
            <p className="dash-empty-sub">{t('noTree')}</p>
          )}
          <div className="dash-hero-actions">
            {hasTree && canEdit && (
              <button onClick={onAddPerson} className="btn btn-primary"><Plus size={16} aria-hidden="true" /> {ts('addPerson')}</button>
            )}
            {hasTree && (
              <button onClick={() => onNavigate('tree')} className="btn btn-secondary"><TreePine size={16} aria-hidden="true" /> {tn('tree')}</button>
            )}
            {!hasTree && (
              <button onClick={onNewTree} className="btn btn-primary btn-lg" style={{ gap: '8px' }}><Sprout size={18} aria-hidden="true" /> {t('createFirst')}</button>
            )}
          </div>
        </header>

        {/* ===== STATS ===== */}
        {stats && (
          <div className="dash-stats">
            <StatCard Icon={Users} value={stats.members} label={t('statMembers')} />
            <StatCard Icon={Layers} value={stats.generations} label={t('statGenerations')} />
            <StatCard
              Icon={Crown}
              value={stats.elder ? stats.elder.age : '·'}
              unit={stats.elder ? t('yearsUnit') : undefined}
              label={t('statEldest')}
              sublabel={stats.elder ? getDisplayName(stats.elder.person) : undefined}
            />
          </div>
        )}

        {/* ===== BIRTHDAYS + ACTIVITY ===== */}
        <div className="dash-two">
          <section className="dash-card dash-card-warm">
            <Head Icon={Cake} eyebrow={t('birthdaysEyebrow')} title={t('birthdaysFull')} />
            {birthdays.items.length > 0 ? (
              <>
                {birthdays.upcoming && <p className="dash-note">{t('upcomingBirthdays')}</p>}
                <ul className="dash-rows">
                  {birthdays.items.map((a, i) => {
                    const when = new Date(a.date).toLocaleDateString(en ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' });
                    return (
                      <li key={`${a.person.id}-${i}`}>
                        <button className="dash-row" onClick={() => onSelectPerson(trees.find(tr => tr.persons.some(p => p.id === a.person.id))?.id || '', a.person.id)}>
                          <PersonAvatar person={a.person} size={32} round={false} />
                          <span className="dash-row-body">
                            <span className="dash-row-name">{getDisplayName(a.person)}</span>
                            <span className="dash-row-sub">{when}</span>
                          </span>
                          <span className="dash-when">{a.daysUntil === 0 ? t('birthdayToday') : t('inDays', { days: a.daysUntil })}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="dash-empty">{t('noBirthdays')}</p>
            )}
          </section>

          <section className="dash-card">
            <Head Icon={Clock} eyebrow={t('activityEyebrow')} title={t('activity')} />
            {recent.length > 0 ? (
              <ul className="dash-rows">
                {recent.map(({ person, tree }) => (
                  <li key={person.id}>
                    <button className="dash-row" onClick={() => onSelectPerson(tree.id, person.id)}>
                      <PersonAvatar person={person} size={32} round={false} />
                      <span className="dash-row-body">
                        <span className="dash-row-name">
                          {getDisplayName(person)} <span className={`dash-action ${isAdded(person) ? 'dash-action-new' : ''}`}>{actionOf(person)}</span>
                          <span className="dash-row-time"> · {relativeTime(person.updatedAt, locale)}</span>
                        </span>
                        <span className="dash-row-sub dash-ctx">{contextLine(person, tree)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-empty">{t('noPersons')}</p>
            )}
          </section>
        </div>

        {/* ===== QUICK ACCESS (3×2) ===== */}
        <section className="dash-card">
          <Head eyebrow={t('quickAccessEyebrow')} title={t('quickAccess')} />
          <div className="dash-quick">
            {QUICK.map(q => (
              <button key={q.view} onClick={() => onNavigate(q.view)} className="dash-quick-btn">
                <q.Icon size={18} aria-hidden="true" />
                <span>{tn(q.navKey)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ===== AI — two compact cards ===== */}
        <section className="dash-ai">
          <div className="dash-ai-head">
            <Sparkles size={15} aria-hidden="true" style={{ color: 'var(--accent)' }} />
            <span className="dash-ai-title">{t('aiTitle')}</span>
          </div>
          <div className="dash-ai-grid">
            <button onClick={onNarrative} disabled={!stats} title={!stats ? t('narrativeNeedsTree') : undefined} className="dash-ai-card">
              <span className="dash-ai-card-icon"><Sparkles size={20} aria-hidden="true" /></span>
              <span className="dash-ai-card-t">{t('narrativeTitle')}</span>
              <span className="dash-ai-card-d">{t('narrativeDesc')}</span>
              <ArrowRight className="dash-ai-card-go" size={16} aria-hidden="true" />
            </button>
            <button onClick={onAnalyzePhoto} className="dash-ai-card">
              <span className="dash-ai-card-icon"><ScanFace size={20} aria-hidden="true" /></span>
              <span className="dash-ai-card-t">{t('photoTitle')}</span>
              <span className="dash-ai-card-d">{t('photoDesc')}</span>
              <ArrowRight className="dash-ai-card-go" size={16} aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* ===== LATEST MEMBERS ===== */}
        {latest.length > 0 && (
          <section className="dash-card">
            <Head Icon={Users} title={t('latestMembers')} action={{ label: t('viewAllMembers'), onClick: () => onNavigate('list') }} />
            <ul className="dash-rows">
              {latest.map(({ person, tree }) => (
                <li key={person.id}>
                  <button className="dash-row" onClick={() => onSelectPerson(tree.id, person.id)}>
                    <PersonAvatar person={person} size={32} />
                    <span className="dash-row-body">
                      <span className="dash-row-name">{getDisplayName(person)}</span>
                      <span className="dash-row-sub">{[memberDates(person), person.birthPlace?.city].filter(Boolean).join('  ·  ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <style>{`
        .dash-wrap { padding: 36px 40px 56px; max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 26px; }

        /* Hero */
        .dash-hero { padding: 4px 0 2px; }
        .dash-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
        .dash-date { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); }
        .dash-user { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
        .dash-user-ava { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #12131a; font-family: var(--font-display); font-weight: 700; font-size: 12px; }
        .dash-title { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.5rem, 6vw, 4rem); line-height: 1; letter-spacing: -0.03em; color: var(--accent); margin: 0; text-wrap: balance; overflow-wrap: break-word; }
        .dash-rule { display: block; width: 60px; height: 2px; background: var(--accent); margin: 18px 0 0; }
        .dash-sub { font-family: var(--font-mono); font-size: 13px; color: var(--text-muted); margin: 16px 0 0; letter-spacing: 0.02em; }
        .dash-fig { color: var(--accent); font-weight: 700; }
        .dash-dot { margin: 0 10px; opacity: 0.5; }
        .dash-empty-sub { margin: 16px 0 0; color: var(--text-muted); font-size: 16px; font-style: italic; max-width: 46ch; }
        .dash-hero-actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }

        /* Stats */
        .dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .dash-stat { position: relative; background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--accent);
          padding: 20px 24px 20px; display: flex; flex-direction: column;
          transition: box-shadow var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out), background var(--t-base) var(--ease-out); }
        .dash-stat:hover { background: #252535; box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .dash-stat-icon { color: #a98f4e; margin-bottom: 13px; }
        .dash-stat-num { font-family: var(--font-display); font-weight: 700; line-height: 0.95; font-size: clamp(2.6rem, 5vw, 3.5rem); color: var(--accent); letter-spacing: -0.02em; }
        .dash-stat-num small { font-size: 1.1rem; color: var(--text-muted); font-weight: 600; margin-left: 5px; }
        .dash-stat-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-muted); margin-top: 10px; }
        .dash-stat-sub { font-family: var(--font-body); font-size: 12px; color: var(--ink); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Cards */
        .dash-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        .dash-card { background: var(--bg-card); border: 1px solid var(--border); padding: 22px 24px; display: flex; flex-direction: column; }
        .dash-card-warm { background: linear-gradient(150% 120% at 0% 0%, rgba(201,168,76,0.07), transparent 55%), var(--bg-card); border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); }
        .dash-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .dash-eyebrow { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 5px; }
        .dash-h { margin: 0; font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; letter-spacing: -0.005em; }
        .dash-head-link { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); background: none; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .dash-head-link:hover { color: var(--accent); }
        .dash-note { margin: 0 0 10px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }

        .dash-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .dash-row { width: 100%; display: flex; align-items: center; gap: 11px; padding: 8px; border: none; background: transparent; cursor: pointer; text-align: left; transition: background var(--t-fast); }
        .dash-row:hover { background: var(--bg-muted); }
        .dash-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .dash-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .dash-row-name { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-action { font-weight: 400; color: var(--text-muted); }
        .dash-action-new { color: var(--accent-text); font-weight: 600; }
        .dash-ctx { font-style: italic; }
        .dash-row-time { font-family: var(--font-mono); font-size: 11px; font-weight: 400; color: var(--text-light); }
        .dash-row-sub { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-when { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-text); flex-shrink: 0; }
        .dash-empty { color: var(--text-muted); font-size: 13px; margin: 4px 0 0; }

        /* Quick access 3×2 */
        .dash-quick { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .dash-quick-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px 6px; min-height: 72px; cursor: pointer; background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); font-family: var(--font-body); font-size: 12px; font-weight: 600; transition: transform var(--t-fast) var(--ease-out), box-shadow var(--t-fast), color var(--t-fast), border-color var(--t-fast), background var(--t-fast); }
        .dash-quick-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-accent); background: #1E1E28; color: var(--accent-text); border-color: var(--accent); }

        /* AI — two compact cards */
        .dash-ai { display: flex; flex-direction: column; gap: 14px; }
        .dash-ai-head { display: flex; align-items: center; gap: 9px; }
        .dash-ai-title { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink); }
        .dash-ai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .dash-ai-card { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; text-align: left; cursor: pointer; padding: 20px 22px; background: #1A1A24; border: 1px solid #2D2D3A; transition: border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-fast), transform var(--t-base) var(--ease-out); }
        .dash-ai-card:hover { border-color: var(--accent); background: #1E1E28; box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .dash-ai-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .dash-ai-card:disabled { opacity: 0.45; cursor: not-allowed; }
        .dash-ai-card:disabled:hover { border-color: #2D2D3A; background: #1A1A24; box-shadow: none; transform: none; }
        .dash-ai-card-icon { display: inline-flex; color: var(--accent); margin-bottom: 4px; }
        .dash-ai-card-t { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; color: var(--ink); }
        .dash-ai-card-d { font-family: var(--font-body); font-size: 12.5px; line-height: 1.5; color: var(--text-muted); max-width: 36ch; }
        .dash-ai-card-go { position: absolute; top: 18px; right: 18px; color: var(--text-light); transition: color var(--t-fast), transform var(--t-fast) var(--ease-out); }
        .dash-ai-card:hover .dash-ai-card-go { color: var(--accent-text); transform: translateX(3px); }

        @media (prefers-reduced-motion: reduce) {
          .dash-stat:hover, .dash-quick-btn:hover, .dash-ai-card:hover { transform: none; }
          .dash-ai-card:hover .dash-ai-card-go { transform: none; }
        }
        @media (max-width: 880px) {
          .dash-two { grid-template-columns: 1fr; }
          .dash-stats { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .dash-wrap { padding: 22px 18px 44px; gap: 20px; }
          .dash-quick { grid-template-columns: repeat(2, 1fr); }
          .dash-ai-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function Head({ Icon, eyebrow, title, action }: { Icon?: typeof Cake; eyebrow?: string; title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <header className="dash-head">
      <div>
        {eyebrow && <div className="dash-eyebrow">{Icon && <Icon size={13} aria-hidden="true" />}{eyebrow}</div>}
        <h3 className="dash-h">{title}</h3>
      </div>
      {action && (
        <button className="dash-head-link" onClick={action.onClick}>{action.label}</button>
      )}
    </header>
  );
}

function StatCard({ Icon, value, unit, label, sublabel }: { Icon: LucideIcon; value: string | number; unit?: string; label: string; sublabel?: string }) {
  return (
    <div className="dash-stat">
      <Icon className="dash-stat-icon" size={17} aria-hidden="true" />
      <div className="dash-stat-num">{value}{unit && <small>{unit}</small>}</div>
      <div className="dash-stat-label">{label}</div>
      {sublabel && <div className="dash-stat-sub" title={sublabel}>{sublabel}</div>}
    </div>
  );
}
