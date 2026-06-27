'use client';
import { useTranslations } from 'next-intl';
import { Person } from '@/types';
import { getAge, formatYear, getDisplayName } from '@/lib/treeUtils';
import { MapPin } from 'lucide-react';
import PersonAvatar from './PersonAvatar';

interface Props {
  person: Person;
  onSelect: (id: string) => void;
}

/** A single person card in the ListView grid. Presentational: the `.lv-*` layout
 *  classes are owned by ListView's <style> block (the grid container), so this
 *  card stays a thin, reusable unit. */
export default function PersonCard({ person, onSelect }: Props) {
  const t = useTranslations('list');
  const age = getAge(person.birthDate, person.deathDate);
  const dates = [
    person.birthDate ? formatYear(person.birthDate) : null,
    !person.isAlive && person.deathDate ? `† ${formatYear(person.deathDate)}` : null,
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={() => onSelect(person.id)}
      className="lv-card"
      style={{ opacity: person.isAlive ? 1 : 0.82 }}
    >
      <div className="lv-card-top">
        <PersonAvatar person={person} size={56} />
        <div className="lv-tags">
          <span className={`badge badge-${person.gender === 'male' ? 'male' : person.gender === 'female' ? 'female' : 'accent'}`}>
            {person.gender === 'male' ? t('genderMale') : person.gender === 'female' ? t('genderFemale') : t('genderOther')}
          </span>
          <span className={`badge badge-${person.isAlive ? 'alive' : 'deceased'}`}>
            {person.isAlive ? t('alive') : t('deceased')}
          </span>
        </div>
      </div>

      <div className="lv-name">
        {getDisplayName(person)}
        {person.maidenName && <span className="lv-maiden"> ({person.maidenName})</span>}
      </div>

      {dates && (
        <div className="lv-dates">
          {dates}{age !== null && <span className="lv-age"> · {t('years', { age })}</span>}
        </div>
      )}

      {person.occupation && <div className="lv-occ">{person.occupation}</div>}

      {person.birthPlace?.city && (
        <div className="lv-place"><MapPin size={12} aria-hidden="true" /> {person.birthPlace.city}</div>
      )}
    </button>
  );
}
