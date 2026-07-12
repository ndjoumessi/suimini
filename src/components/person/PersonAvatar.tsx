'use client';
import { useState } from 'react';
import { Person } from '@/types';
import { GENDER_BAR } from '../tree/nodeStyle';

/* =====================================================================
   PersonAvatar — élégant, Modern Heritage. Photo réelle si présente,
   sinon initiales en Spectral sur fond coloré par genre. Le genre suit
   la SOURCE UNIQUE GENDER_BAR (comme l'arbre, la liste, l'exploration) :
     homme  → bleu  #4A90D9 (initiales encre)
     femme  → rose  #C47BA0 (initiales encre)
     inconnu→ #2A2A2A (initiales crème)
   L'or reste réservé au pivot/fondateur — l'avatar ne l'utilise plus.
   Pas d'avatar cartoon. Carré (zéro border-radius) ou rond via `round`.
   ===================================================================== */

function initials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/** object-position (%) de la photo — cadrage stocké dans `profilePhotoPosition`,
 *  50/50 (centré) par défaut → rétro-compatible avec les photos existantes. */
export function photoObjectPosition(p: Person): string {
  const pos = p.profilePhotoPosition;
  return pos ? `${clampPct(pos.x)}% ${clampPct(pos.y)}%` : '50% 50%';
}

export default function PersonAvatar({ person, size = 44, round = true, style }: {
  person: Person;
  size?: number;
  round?: boolean;
  style?: React.CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = !!person.profilePhoto && !broken;
  const gender = person.gender;
  const bg = gender === 'male' ? GENDER_BAR.male : gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
  const fg = gender === 'male' || gender === 'female' ? 'var(--ink-on-accent)' : 'var(--ink)';

  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: round ? '50%' : 0,
        background: showPhoto ? '#1c1c1c' : bg,
        color: fg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: Math.round(size * 0.4), lineHeight: 1, letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {showPhoto
        ? <img src={person.profilePhoto} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: photoObjectPosition(person) }} />
        : initials(person)}
    </span>
  );
}
