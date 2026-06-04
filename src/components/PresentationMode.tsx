'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Person } from '@/types';
import { useOverlay } from '@/hooks/useOverlay';
import { getFullName, formatDate, getAge } from '@/lib/treeUtils';
import { X, ChevronLeft, ChevronRight, User, MapPin, Cross, Film } from 'lucide-react';

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
        <button onClick={onClose} aria-label="Quitter" style={closeStyle}><X size={20} /></button>
        <div style={{ color: '#d8d2c8', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Film size={48} strokeWidth={1.2} aria-hidden="true" />
          Aucun membre à présenter.
        </div>
      </div>
    );
  }

  const person = ordered[index];
  const age = getAge(person.birthDate, person.deathDate);
  const accent = person.gender === 'male' ? 'var(--male)' : person.gender === 'female' ? 'var(--female)' : '#e0623e';

  return (
    <div ref={overlayRef} tabIndex={-1} className="presentation-root" style={rootStyle}>
      <button onClick={onClose} style={closeStyle} aria-label="Quitter (Échap)" title="Quitter (Échap)"><X size={20} /></button>

      {/* Navigation arrows */}
      <button onClick={() => go(-1)} disabled={index === 0} style={{ ...arrowStyle, left: '24px', opacity: index === 0 ? 0.25 : 1 }} aria-label="Précédent" title="Précédent (←)"><ChevronLeft size={28} /></button>
      <button onClick={() => go(1)} disabled={index === ordered.length - 1} style={{ ...arrowStyle, right: '24px', opacity: index === ordered.length - 1 ? 0.25 : 1 }} aria-label="Suivant" title="Suivant (→)"><ChevronRight size={28} /></button>

      {/* Slide (fade transition on each change, retriggered via key) */}
      <div key={index} className="present-fade"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '760px', padding: '0 60px' }}
      >
        {/* Photo — square brutalist frame */}
        <div style={{
          width: 'min(320px, 40vh)', height: 'min(320px, 40vh)', overflow: 'hidden',
          border: `3px solid ${accent}`, boxShadow: '10px 10px 0 rgba(0,0,0,0.55)', marginBottom: '34px',
          background: '#2a2620', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6a62',
        }}>
          {person.profilePhoto
            ? <img src={person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <User size={120} strokeWidth={1} aria-hidden="true" />}
        </div>

        {/* Name */}
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 'clamp(2rem, 6vw, 52px)', color: '#f4f1ea', margin: '0 0 14px', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.03em' }}>
          {getFullName(person)}
        </h1>

        {/* Dates */}
        <div style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.05rem)', color: '#b8b2a6', marginBottom: '14px', fontFamily: "var(--font-mono)", letterSpacing: '1px', display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {person.birthDate ? <span>{formatDate(person.birthDate, person.birthDateApprox)}</span> : null}
          {!person.isAlive && person.deathDate ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>— <Cross size={13} aria-hidden="true" /> {formatDate(person.deathDate, person.deathDateApprox)}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          {age !== null && <span style={pillStyle}>{age} ans</span>}
          {person.occupation && <span style={pillStyle}>{person.occupation}</span>}
          {person.birthPlace?.city && <span style={{ ...pillStyle, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><MapPin size={12} aria-hidden="true" /> {person.birthPlace.city}</span>}
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
            <button key={i} onClick={() => setIndex(i)} aria-label={`Diapositive ${i + 1}`}
              style={{ width: i === index ? '24px' : '9px', height: '9px', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.25s', background: i === index ? accent : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
        <div className="mono" style={{ color: '#8a8276', fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {index + 1} / {ordered.length} · ← → naviguer · Échap quitter
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
  width: '44px', height: '44px', borderRadius: '2px', border: '1.5px solid rgba(244,241,234,0.4)',
  background: 'rgba(255,255,255,0.06)', color: '#f4f1ea', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const arrowStyle: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
  width: '56px', height: '56px', borderRadius: '2px', border: '1.5px solid rgba(244,241,234,0.3)',
  background: 'rgba(255,255,255,0.06)', color: '#f4f1ea', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};
const pillStyle: React.CSSProperties = {
  padding: '5px 14px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)',
  color: '#e8e0d0', fontSize: '0.8rem', fontFamily: "var(--font-mono)", border: '1px solid rgba(255,255,255,0.18)',
};
