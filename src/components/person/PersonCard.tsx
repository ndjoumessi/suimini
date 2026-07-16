'use client';
import { useTranslations } from 'next-intl';
import { Person } from '@/types';
import { formatYear } from '@/lib/treeUtils';
import { MapPin } from 'lucide-react';
import { GENDER_BAR, avatarColors } from '../tree/nodeStyle';

interface Props {
  person: Person;
  onSelect: (id: string) => void;
  variant?: 'row' | 'grid';
}

function initials(p: Person): string {
  return (((p.lastName?.[0] || '') + (p.firstName?.[0] || '')).toUpperCase()) || '?';
}

function genderColor(p: Person): string {
  return p.gender === 'male' ? GENDER_BAR.male : p.gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
}

function dateStr(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (!p.isAlive) return b && d ? `${b} – ${d}` : d ? `† ${d}` : b ? `${b} – ?` : '';
  return b || '';
}

/** A person in the répertoire — `row` (dense list) or `grid` (compact card).
 *  Gender drives the bar + avatar so it stays consistent with the tree. The
 *  `.lv-*` classes are owned by ListView's <style> block. */
export default function PersonCard({ person: p, onSelect, variant = 'row' }: Props) {
  const t = useTranslations('list');
  const bar = genderColor(p);
  const { bg: avatarBg, fg: avatarFg } = avatarColors(p.gender);
  const dates = dateStr(p);
  const city = p.birthPlace?.city;
  const firstName = (p.firstName || '').trim();
  const lastName = (p.lastName || '').trim();
  // "Prénom NOM" si prénom ; sinon "NOM" seul (pas de « — » disgracieux) ;
  // placeholder uniquement si les deux manquent.
  const fullName = firstName && lastName
    ? `${firstName} ${lastName}`
    : (lastName || firstName || t('noFirstName'));

  const avatar = (cls: string) => (
    <span className={cls} style={{ background: avatarBg, color: avatarFg }} aria-hidden="true">
      {p.profilePhoto ? <img src={p.profilePhoto} alt="" loading="lazy" decoding="async" /> : initials(p)}
    </span>
  );

  if (variant === 'grid') {
    return (
      <button className="lv-gcard" style={{ ['--bar' as string]: bar }} onClick={() => onSelect(p.id)}>
        <span className="lv-gbar" aria-hidden="true" />
        {avatar('lv-ava lv-ava-lg')}
        <span className="lv-gname">{fullName}</span>
        {dates && <span className="lv-dates">{dates}</span>}
        {city && <span className="lv-place"><MapPin size={11} aria-hidden="true" /> {city}</span>}
      </button>
    );
  }

  return (
    <button className="lv-row" style={{ ['--bar' as string]: bar }} onClick={() => onSelect(p.id)}>
      <span className="lv-rbar" aria-hidden="true" />
      {avatar('lv-ava')}
      <span className="lv-rname">{fullName}</span>
      {dates && <span className="lv-rdates">{dates}</span>}
      <span className="lv-rtags">
        {/* Le glyphe † est décoratif ; l'état « décédé » est porté par le texte sr-only (1.3.1). */}
        {!p.isAlive && <span className="lv-dagger" title={t('deceased')}><span aria-hidden="true">†</span><span className="sr-only">{t('deceased')}</span></span>}
        {city && <span className="lv-place"><MapPin size={11} aria-hidden="true" /> {city}</span>}
      </span>
    </button>
  );
}
