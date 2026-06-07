'use client';
import { useMemo, type ReactNode } from 'react';
import {
  Home, Cake, Clock, Sparkles, Sprout, ArrowRight, User, Smile,
  TreePine, Users, Map, Calendar, BookOpen, BarChart2,
} from 'lucide-react';
import { FamilyTree, ViewMode } from '@/types';
import {
  computeTreeStats, getUpcomingAnniversaries, getAge, getDisplayName,
} from '@/lib/treeUtils';

interface Props {
  trees: FamilyTree[];
  displayName?: string | null;
  userEmail?: string | null;
  onNavigate: (v: ViewMode) => void;
  /** Open the tree selector / creation flow. */
  onNewTree: () => void;
  /** Switch to a person's tree (if needed) and open their panel. */
  onSelectPerson: (treeId: string, personId: string) => void;
  /** Open the AI narrative report modal (active tree). */
  onNarrative: () => void;
}

const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "il y a 2 jours" — coarse French relative time, past only. */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) { const w = Math.floor(days / 7); return `il y a ${w} semaine${w > 1 ? 's' : ''}`; }
  if (days < 365) { const m = Math.floor(days / 30); return `il y a ${m} mois`; }
  const y = Math.floor(days / 365); return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

function firstNameOf(displayName?: string | null, email?: string | null): string {
  const src = (displayName || '').trim();
  if (src) return src.split(/\s+/)[0];
  const local = (email || '').split('@')[0] || '';
  if (!local) return '';
  const token = local.split(/[._-]+/)[0] || local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

// ---------- shared card chrome ----------

function Card({ children, eyebrow, title, Icon, full, delay }: {
  children: ReactNode; eyebrow?: string; title?: string; Icon?: typeof Home; full?: boolean; delay: number;
}) {
  return (
    <section
      className="dash-card animate-fade-in"
      style={{ animationDelay: `${delay}s`, gridColumn: full ? '1 / -1' : undefined }}
    >
      {(title || eyebrow) && (
        <header style={{ marginBottom: '14px' }}>
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--accent)', marginBottom: '5px' }}>
            {Icon && <Icon size={14} aria-hidden="true" />}
            {eyebrow}
          </div>
          {title && <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{title}</h3>}
        </header>
      )}
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{children}</p>;
}

export default function DashboardView({ trees, displayName, userEmail, onNavigate, onNewTree, onSelectPerson, onNarrative }: Props) {
  const firstName = firstNameOf(displayName, userEmail);
  const today = useMemo(() => {
    const d = new Date();
    return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  // Aggregate figures across every tree the user owns.
  const summary = useMemo(() => {
    const totalPersons = trees.reduce((acc, t) => acc + t.persons.length, 0);
    const oldestGeneration = trees.reduce((max, t) => Math.max(max, t.persons.length ? computeTreeStats(t).totalGenerations : 0), 0);

    // Oldest living person across all trees (by age).
    const living = trees.flatMap(t => t.persons
      .filter(p => p.isAlive && p.birthDate)
      .map(p => ({ name: getDisplayName(p), age: getAge(p.birthDate) ?? -1, tree: t.name }))
      .filter(x => x.age >= 0));
    const oldest = living.sort((a, b) => b.age - a.age)[0] ?? null;

    return { totalPersons, totalTrees: trees.length, oldestGeneration, oldest };
  }, [trees]);

  // Birthdays within the next 30 days, all trees, soonest first.
  const birthdays = useMemo(() => {
    const all = trees.flatMap(t => getUpcomingAnniversaries(t.persons, t.relationships, 30).filter(a => a.type === 'birthday'));
    return all.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
  }, [trees]);

  // 5 most recently created/edited persons, all trees.
  const recent = useMemo(() => {
    const all = trees.flatMap(t => t.persons.map(p => ({ person: p, treeId: t.id, treeName: t.name })));
    return all
      .filter(x => x.person.updatedAt)
      .sort((a, b) => new Date(b.person.updatedAt).getTime() - new Date(a.person.updatedAt).getTime())
      .slice(0, 5);
  }, [trees]);

  const hasTrees = trees.length > 0;

  const QUICK: { view: ViewMode; Icon: typeof Home; label: string }[] = [
    { view: 'tree', Icon: TreePine, label: 'Arbre' },
    { view: 'list', Icon: Users, label: 'Personnes' },
    { view: 'map', Icon: Map, label: 'Carte' },
    { view: 'timeline', Icon: Calendar, label: 'Chronologie' },
    { view: 'journal', Icon: BookOpen, label: 'Journal' },
    { view: 'statistics', Icon: BarChart2, label: 'Statistiques' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div className="dash-grid" style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto' }}>

        {/* A — Welcome (full width) */}
        <Card full delay={0}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>{today}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                  Bonjour, {firstName || 'bienvenue'}
                </h2>
                <Smile size={32} strokeWidth={1.75} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
              </div>
              <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: '15px', maxWidth: '46ch' }}>
                {hasTrees
                  ? <>Vous avez <strong style={{ color: 'var(--text)' }}>{summary.totalTrees}</strong> arbre{summary.totalTrees > 1 ? 's' : ''}, <strong style={{ color: 'var(--text)' }}>{summary.totalPersons}</strong> personne{summary.totalPersons > 1 ? 's' : ''} au total.</>
                  : <>Commencez à bâtir votre histoire familiale. Créez votre premier arbre pour rassembler les vôtres.</>}
              </p>
            </div>
            {!hasTrees && (
              <button onClick={onNewTree} className="btn btn-primary btn-lg" style={{ gap: '8px' }}>
                <Sprout size={18} aria-hidden="true" /> Créer mon premier arbre
              </button>
            )}
          </div>
        </Card>

        {/* B — Anniversaires ce mois-ci */}
        <Card eyebrow="Ce mois-ci" title="Anniversaires" Icon={Cake} delay={0.1}>
          {birthdays.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {birthdays.map((a, i) => {
                const d = new Date(a.date);
                const when = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
                return (
                  <li key={`${a.person.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '34px', textAlign: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{a.daysUntil === 0 ? "Auj." : `J-${a.daysUntil}`}</span>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(a.person)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{when} · va avoir {a.age} ans</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyLine>Aucun anniversaire ce mois.</EmptyLine>
          )}
        </Card>

        {/* C — Dernières modifications */}
        <Card eyebrow="Activité" title="Dernières modifications" Icon={Clock} delay={0.2}>
          {recent.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recent.map(({ person, treeId, treeName }) => (
                <li key={person.id}>
                  <button
                    onClick={() => onSelectPerson(treeId, person.id)}
                    className="dash-recent"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '11px', padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius)' }}
                  >
                    <span style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {person.profilePhoto
                        ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <User size={16} style={{ color: 'var(--text-light)' }} aria-hidden="true" />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(person)}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{treeName} · {relativeTime(person.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>Aucune personne pour l&apos;instant.</EmptyLine>
          )}
        </Card>

        {/* D — Statistiques rapides */}
        <Card eyebrow="En un coup d'œil" title="Statistiques" Icon={BarChart2} delay={0.3}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 12px' }}>
            <Stat value={summary.totalPersons} label="Personnes" />
            <Stat value={summary.totalTrees} label="Arbres" />
            <Stat value={summary.oldestGeneration || '—'} label="Générations" />
            <Stat
              value={summary.oldest ? summary.oldest.age : '—'}
              label={summary.oldest ? `Doyen·ne · ${summary.oldest.name}` : 'Doyen·ne'}
            />
          </div>
        </Card>

        {/* E — Accès rapide */}
        <Card eyebrow="Navigation" title="Accès rapide" Icon={Home} delay={0.4}>
          <div className="dash-quick" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {QUICK.map(q => (
              <button key={q.view} onClick={() => onNavigate(q.view)} className="btn btn-secondary btn-sm" style={{ flexDirection: 'column', gap: '6px', padding: '12px 6px', height: 'auto' }}>
                <q.Icon size={18} aria-hidden="true" />
                <span style={{ fontSize: '12px' }}>{q.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* F — Rapport IA */}
        <Card eyebrow="Intelligence" title="Récit familial" Icon={Sparkles} delay={0.5}>
          <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Laissez l&apos;IA composer le récit de votre famille à partir de vos données.
          </p>
          <button
            onClick={onNarrative}
            disabled={summary.totalPersons === 0}
            title={summary.totalPersons === 0 ? "Créez d'abord un arbre pour générer un récit" : undefined}
            className="btn btn-primary btn-sm"
            style={{ gap: '7px' }}
          >
            <Sparkles size={15} aria-hidden="true" /> Générer <ArrowRight size={15} aria-hidden="true" />
          </button>
          {summary.totalPersons === 0 && (
            <p style={{ margin: '8px 0 0', color: 'var(--text-light)', fontSize: '12px' }}>
              Créez d&apos;abord un arbre pour générer un récit.
            </p>
          )}
        </Card>
      </div>

      <style>{`
        .dash-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          align-content: start;
        }
        .dash-card {
          background: var(--bg-card);
          border: var(--bw) solid var(--border-strong);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
        }
        .dash-recent:hover { background: var(--interactive) !important; }
        @media (max-width: 900px) {
          .dash-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .dash-grid { grid-template-columns: 1fr; padding: 16px !important; }
          .dash-quick { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/** Big terracotta figure + mono caption. */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 700, lineHeight: 1, color: 'var(--accent)' }}>
        {value}
      </div>
      <div className="label" style={{ marginTop: '6px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}
