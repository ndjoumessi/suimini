'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Person } from '@/types';
import { useOverlay } from '@/hooks/useOverlay';
import { getFullName, formatDate, getAge } from '@/lib/treeUtils';

interface Props {
  persons: Person[];
  onClose: () => void;
}

export default function PresentationMode({ persons, onClose }: Props) {
  // Chronological order for a coherent family narrative; undated members last.
  const ordered = useMemo(() => {
    return [...persons].sort((a, b) => {
      if (!a.birthDate && !b.birthDate) return 0;
      if (!a.birthDate) return 1;
      if (!b.birthDate) return -1;
      return a.birthDate.localeCompare(b.birthDate);
    });
  }, [persons]);

  const overlayRef = useOverlay<HTMLDivElement>(onClose);
  const [index, setIndex] = useState(0);

  const go = useCallback((delta: number) => {
    setIndex(i => Math.max(0, Math.min(ordered.length - 1, i + delta)));
  }, [ordered.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (ordered.length === 0) {
    return (
      <div ref={overlayRef} tabIndex={-1} className="presentation-root" style={rootStyle}>
        <button onClick={onClose} style={closeStyle}>✕</button>
        <div style={{ color: '#d8d2c8', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎬</div>
          Aucun membre à présenter.
        </div>
      </div>
    );
  }

  const person = ordered[index];
  const age = getAge(person.birthDate, person.deathDate);
  const accent = person.gender === 'male' ? 'var(--male)' : person.gender === 'female' ? 'var(--female)' : 'var(--accent)';

  return (
    <div ref={overlayRef} tabIndex={-1} className="presentation-root" style={rootStyle}>
      <button onClick={onClose} style={closeStyle} title="Quitter (Échap)">✕</button>

      {/* Navigation arrows */}
      <button onClick={() => go(-1)} disabled={index === 0} style={{ ...arrowStyle, left: '24px', opacity: index === 0 ? 0.25 : 1 }} title="Précédent (←)">‹</button>
      <button onClick={() => go(1)} disabled={index === ordered.length - 1} style={{ ...arrowStyle, right: '24px', opacity: index === ordered.length - 1 ? 0.25 : 1 }} title="Suivant (→)">›</button>

      {/* Slide (fade transition on each change, retriggered via key) */}
      <div key={index} className="present-fade"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '760px', padding: '0 60px' }}
      >
        {/* Photo */}
        <div style={{
          width: 'min(320px, 40vh)', height: 'min(320px, 40vh)', borderRadius: '50%', overflow: 'hidden',
          border: `5px solid ${accent}`, boxShadow: '0 12px 48px rgba(0,0,0,0.5)', marginBottom: '32px',
          background: '#2a2620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px',
        }}>
          {person.profilePhoto
            ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (person.gender === 'male' ? '👨' : person.gender === 'female' ? '👩' : '🧑')}
        </div>

        {/* Name — Playfair Display 48px */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 6vw, 48px)', color: '#f5f0e8', margin: '0 0 12px', fontWeight: 600, lineHeight: 1.1 }}>
          {getFullName(person)}
        </h1>

        {/* Dates */}
        <div style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#c4b89a', marginBottom: '8px', fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>
          {person.birthDate ? `✦ ${formatDate(person.birthDate, person.birthDateApprox)}` : ''}
          {!person.isAlive && person.deathDate ? `  —  ✝ ${formatDate(person.deathDate, person.deathDateApprox)}` : ''}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          {age !== null && <span style={pillStyle}>{person.isAlive ? `${age} ans` : `${age} ans`}</span>}
          {person.occupation && <span style={pillStyle}>{person.occupation}</span>}
          {person.birthPlace?.city && <span style={pillStyle}>📍 {person.birthPlace.city}</span>}
        </div>

        {/* Bio */}
        {person.bio && (
          <p style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)', color: '#ddd6c8', lineHeight: 1.8, maxWidth: '620px', margin: 0, fontWeight: 300 }}>
            {person.bio}
          </p>
        )}
      </div>

      {/* Progress */}
      <div style={{ position: 'absolute', bottom: '28px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '60%' }}>
          {ordered.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)}
              style={{ width: i === index ? '22px' : '8px', height: '8px', borderRadius: '100px', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.25s', background: i === index ? accent : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
        <div style={{ color: '#8a8278', fontSize: '13px', letterSpacing: '0.5px' }}>
          {index + 1} / {ordered.length} · ← → pour naviguer · Échap pour quitter
        </div>
      </div>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 3000,
  background: 'radial-gradient(ellipse at center, #1f1b16 0%, #0c0a08 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'fadeIn 0.3s ease-out',
};
const closeStyle: React.CSSProperties = {
  position: 'absolute', top: '20px', right: '24px', zIndex: 10,
  width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.06)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer',
};
const arrowStyle: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
  width: '56px', height: '56px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)', color: '#f5f0e8', fontSize: '32px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};
const pillStyle: React.CSSProperties = {
  padding: '5px 14px', borderRadius: '100px', background: 'rgba(255,255,255,0.08)',
  color: '#e8e0d0', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.12)',
};
