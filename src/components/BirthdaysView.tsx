'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Cake, Flame, Heart, CalendarDays } from 'lucide-react';
import { FamilyTree } from '@/types';
import PersonAvatar from './PersonAvatar';
import { getUpcomingAnniversaries } from '@/lib/treeUtils';
import { getDisplayName } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

export default function BirthdaysView({ tree, onSelectPerson }: Props) {
  const t = useTranslations('birthdays');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR';
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
  const typeLabel = (type: string) => ({ birthday: t('typeBirthday'), deathday: t('typeDeathday'), wedding: t('typeWedding') }[type] || '');
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
          <div style={{ flex: 1 }} />{/* title lives in ContentHeader (no double header) */}
          <select value={daysAhead} onChange={e => setDaysAhead(+e.target.value)} className="input" style={{ width: 'auto' }} aria-label={t('rangeLabel')}>
            <option value={30}>{t('range30')}</option>
            <option value={60}>{t('range60')}</option>
            <option value={90}>{t('range90')}</option>
            <option value={180}>{t('range6months')}</option>
            <option value={365}>{t('range1year')}</option>
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
              {f === 'all' ? t('filterAll') : <>{typeIcon(f)}{{ birthday: t('filterBirthday'), deathday: t('filterDeathday'), wedding: t('filterWedding') }[f]}</>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '420px', margin: '0 auto' }}>
            <CalendarDays size={44} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} aria-hidden="true" />
            <p style={{ fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>{t('emptyTitle')}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {filter !== 'all'
                ? t('emptyFiltered', { kind: ({ birthday: t('kindBirthday'), deathday: t('kindDeathday'), wedding: t('kindWedding') }[filter] || ''), days: daysAhead })
                : t('emptyAll', { days: daysAhead })}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {filter !== 'all' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setFilter('all')}>{t('showAllTypes')}</button>
              )}
              {daysAhead < 365 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setDaysAhead(365)}>{t('expandToYear')}</button>
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
                {t('todaySection')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {today.map((a, i) => (
                <AnniversaryCard key={i} a={a} onSelect={onSelectPerson} typeIcon={typeIcon} typeLabel={typeLabel} typeColor={typeColor} t={t} dateLocale={dateLocale} highlight />
              ))}
            </div>
          </div>
        )}

        {/* BY MONTH */}
        {Object.keys(byMonth).map(monthStr => {
          const month = +monthStr;
          const items = byMonth[month];
          const monthLabel = new Date(2000, month, 1).toLocaleDateString(dateLocale, { month: 'long' });
          return (
            <div key={month} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div className="label" style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '80px' }}>
                  {monthLabel}
                </div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('count', { count: items.length })}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((a, i) => (
                  <AnniversaryCard key={i} a={a} onSelect={onSelectPerson} typeIcon={typeIcon} typeLabel={typeLabel} typeColor={typeColor} t={t} dateLocale={dateLocale} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnniversaryCard({ a, onSelect, typeIcon, typeLabel, typeColor, t, dateLocale, highlight }: {
  a: ReturnType<typeof getUpcomingAnniversaries>[0];
  onSelect: (id: string) => void;
  typeIcon: (type: string, size?: number) => ReactNode;
  typeLabel: (type: string) => string;
  typeColor: (type: string) => string;
  t: ReturnType<typeof useTranslations>;
  dateLocale: string;
  highlight?: boolean;
}) {
  const dateObj = new Date(a.date);
  const dayMonth = dateObj.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });

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
      <PersonAvatar person={a.person} size={44} />

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
            <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
              ({a.type === 'birthday' ? t('turning', { age: a.age }) : a.type === 'wedding' ? t('weddingYears', { age: a.age }) : ''})
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
          }}>{t('todayBadge')}</div>
        ) : a.daysUntil === 1 ? (
          <div style={{ color: 'var(--text)', fontWeight: '700', fontSize: '13px' }}>{t('tomorrow')}</div>
        ) : (
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-text)', fontFamily: 'var(--font-display)' }}>
              {a.daysUntil}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('daysUnit', { count: a.daysUntil })}</div>
          </div>
        )}
      </div>
    </button>
  );
}
