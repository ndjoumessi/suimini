'use client';
import { useMemo } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { FamilyTree, EventType } from '@/types';
import { getDisplayName, formatDate } from '@/lib/treeUtils';

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

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

export default function TimelineView({ tree, onSelectPerson }: Props) {
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
          description: `Naissance de ${name}`,
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
          description: `Décès de ${name}`,
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
            description: event.description || `${event.type} de ${name}`,
            place: event.place?.city,
          });
        }
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [tree]);

  // Group by decade
  const byDecade = useMemo(() => {
    const groups: Record<number, TimelineEntry[]> = {};
    entries.forEach(e => {
      const decade = Math.floor(e.year / 10) * 10;
      if (!groups[decade]) groups[decade] = [];
      groups[decade].push(e);
    });
    return groups;
  }, [entries]);

  const decades = Object.keys(byDecade).map(Number).sort((a, b) => a - b);

  if (entries.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <CalendarDays size={44} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
        <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '32ch' }}>
          La chronologie se remplira dès que vos proches auront des dates de naissance, de décès ou d'autres événements.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>Chronologie — {tree.name}</h2>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entries.length} événements</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {decades.map(decade => (
          <div key={decade} style={{ marginBottom: '32px' }}>
            {/* Decade header */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'
            }}>
              <div className="label" style={{ fontSize: '13px', color: 'var(--text-light)', minWidth: '60px' }}>
                {decade}s
              </div>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                {byDecade[decade].length} événements
              </div>
            </div>

            {/* Events */}
            <div style={{ paddingLeft: '24px', borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0' }}>
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
    </div>
  );
}
