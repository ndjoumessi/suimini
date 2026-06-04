'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { Cake, Flame, Heart, CalendarDays, User } from 'lucide-react';
import { FamilyTree } from '@/types';
import { getUpcomingAnniversaries } from '@/lib/treeUtils';
import { getDisplayName } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function BirthdaysView({ tree, onSelectPerson }: Props) {
  const [filter, setFilter] = useState<'all' | 'birthday' | 'deathday' | 'wedding'>('all');
  const [daysAhead, setDaysAhead] = useState(90);

  const anniversaries = useMemo(
    () => getUpcomingAnniversaries(tree.persons, tree.relationships, daysAhead),
    [tree, daysAhead]
  );

  const filtered = filter === 'all' ? anniversaries : anniversaries.filter(a => a.type === filter);

  // Today's events
  const today = filtered.filter(a => a.daysUntil === 0);
  const upcoming = filtered.filter(a => a.daysUntil > 0);

  // Group upcoming by month
  const byMonth: Record<number, typeof upcoming> = {};
  upcoming.forEach(a => {
    const birth = new Date(a.date);
    const d = new Date();
    d.setDate(d.getDate() + a.daysUntil);
    const month = d.getMonth();
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(a);
  });

  const typeIcon = (type: string, size = 14): ReactNode => {
    const props = { size, style: { flexShrink: 0 }, 'aria-hidden': true } as const;
    if (type === 'birthday') return <Cake {...props} />;
    if (type === 'deathday') return <Flame {...props} />;
    if (type === 'wedding') return <Heart {...props} />;
    return <CalendarDays {...props} />;
  };
  const typeLabel = (type: string) => ({ birthday: 'Anniversaire', deathday: 'Commémoration', wedding: 'Noces' }[type] || '');
  const typeColor = (type: string) => ({
    birthday: 'var(--success)',
    deathday: 'var(--deceased)',
    wedding: 'var(--accent)',
  }[type] || 'var(--accent)');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cake size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
            Anniversaires &amp; Commémorations
          </h2>
          <select value={daysAhead} onChange={e => setDaysAhead(+e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value={30}>30 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
            <option value={180}>6 mois</option>
            <option value={365}>1 an</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all','birthday','deathday','wedding'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className="btn btn-sm"
              style={{
                background: filter === f ? 'var(--accent-light)' : 'var(--bg-muted)',
                color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                fontWeight: filter === f ? 700 : 400,
                gap: '6px',
              }}
            >
              {f === 'all' ? 'Tout' : <>{typeIcon(f)}{{ birthday: 'Anniversaires', deathday: 'Commémorations', wedding: 'Noces' }[f]}</>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '420px', margin: '0 auto' }}>
            <CalendarDays size={44} strokeWidth={1.25} style={{ color: 'var(--text-light)', marginBottom: '12px' }} aria-hidden="true" />
            <p style={{ fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>Rien à fêter pour l'instant</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {filter !== 'all'
                ? `Aucune ${({ birthday: 'date d\'anniversaire', deathday: 'commémoration', wedding: 'noces' }[filter] || 'date')} dans les ${daysAhead} prochains jours.`
                : `Aucun événement dans les ${daysAhead} prochains jours.`}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {filter !== 'all' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setFilter('all')}>Tous les types</button>
              )}
              {daysAhead < 365 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setDaysAhead(365)}>Élargir à 1 an</button>
              )}
            </div>
          </div>
        )}

        {/* TODAY */}
        {today.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div className="label" style={{
                background: 'var(--accent)',
                color: 'white', padding: '4px 14px', borderRadius: '100px',
              }}>
                Aujourd'hui
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {today.map((a, i) => (
                <AnniversaryCard key={i} a={a} onSelect={onSelectPerson} typeIcon={typeIcon} typeLabel={typeLabel} typeColor={typeColor} highlight />
              ))}
            </div>
          </div>
        )}

        {/* BY MONTH */}
        {Object.keys(byMonth).map(monthStr => {
          const month = +monthStr;
          const items = byMonth[month];
          return (
            <div key={month} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div className="label" style={{ fontSize: '12px', color: 'var(--text-light)', minWidth: '80px' }}>
                  {MONTH_NAMES[month]}
                </div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{items.length}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((a, i) => (
                  <AnniversaryCard key={i} a={a} onSelect={onSelectPerson} typeIcon={typeIcon} typeLabel={typeLabel} typeColor={typeColor} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnniversaryCard({ a, onSelect, typeIcon, typeLabel, typeColor, highlight }: {
  a: ReturnType<typeof getUpcomingAnniversaries>[0];
  onSelect: (id: string) => void;
  typeIcon: (t: string, size?: number) => ReactNode;
  typeLabel: (t: string) => string;
  typeColor: (t: string) => string;
  highlight?: boolean;
}) {
  const dateObj = new Date(a.date);
  const dayMonth = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  return (
    <button
      onClick={() => onSelect(a.person.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '12px 14px', border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', background: highlight ? 'var(--accent-light)' : 'var(--bg-card)',
        cursor: 'pointer', textAlign: 'left', transition: 'border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)', width: '100%',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = typeColor(a.type); e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = highlight ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Avatar */}
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {a.person.profilePhoto
          ? <img src={a.person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <User size={18} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>
          {getDisplayName(a.person)}
          {a.type === 'wedding' && a.relatedPerson && (
            <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}> & {getDisplayName(a.relatedPerson)}</span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ color: typeColor(a.type), fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>{typeIcon(a.type)} {typeLabel(a.type)}</span>
          {' · '}{dayMonth}
          {a.age !== undefined && (
            <span style={{ marginLeft: '6px', color: 'var(--text-light)' }}>
              ({a.type === 'birthday' ? `${a.age} ans` : a.type === 'wedding' ? `${a.age} ans de mariage` : ''})
            </span>
          )}
        </div>
      </div>

      {/* Days until */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        {a.daysUntil === 0 ? (
          <div style={{
            background: 'var(--accent)', color: 'white',
            borderRadius: '100px', padding: '4px 10px',
            fontSize: '11px', fontWeight: '700'
          }}>Aujourd'hui !</div>
        ) : a.daysUntil === 1 ? (
          <div style={{ color: 'var(--text)', fontWeight: '700', fontSize: '13px' }}>Demain</div>
        ) : (
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {a.daysUntil}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>jours</div>
          </div>
        )}
      </div>
    </button>
  );
}
