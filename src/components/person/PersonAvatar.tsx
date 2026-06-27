'use client';
import { useState } from 'react';
import { Person } from '@/types';

/* =====================================================================
   PersonAvatar — élégant, Modern Heritage. Photo réelle si présente,
   sinon initiales en Spectral sur fond coloré par genre :
     homme  → or #C9A84C (initiales encre)
     femme  → rose-muted #8A5B6E (initiales encre)
     inconnu→ #2A2A2A (initiales crème)
   Pas d'avatar cartoon. Carré (zéro border-radius) ou rond via `round`.
   ===================================================================== */

function initials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
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
  const bg = gender === 'male' ? '#c9a84c' : gender === 'female' ? '#8a5b6e' : '#2a2a2a';
  const fg = gender === 'male' || gender === 'female' ? '#0d0d0d' : '#f5f0e8';

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
        ? <img src={person.profilePhoto} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(person)}
    </span>
  );
}
