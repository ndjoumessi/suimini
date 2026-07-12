'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Move, RotateCcw } from 'lucide-react';

/* =====================================================================
   PhotoPositionControl — recadrage léger d'une photo de profil.
   Aperçu CIRCULAIRE (mêmes proportions que PersonAvatar) : on glisse la
   photo pour la recentrer (pointer events, sans dépendance), on ajuste
   au clavier (flèches), on remet au centre d'un clic. Émet un
   { x, y } en % (0–100 ; 50/50 = centré) via `onChange` — la source unique
   stockée dans person.profilePhotoPosition (cf. PersonAvatar).
   Partagé entre PersonPanel (upload direct) et PersonForm (section Avancé).
   ===================================================================== */

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export interface PhotoPosition { x: number; y: number }

export default function PhotoPositionControl({
  src, position, onChange, size = 112,
}: {
  src: string;
  position?: PhotoPosition;
  onChange: (pos: PhotoPosition) => void;
  size?: number;
}) {
  const t = useTranslations('personPanel');
  const pos = position ?? { x: 50, y: 50 };
  // Ancre de départ du drag (position au pointerdown) — la position vit dans le
  // parent (contrôlé), on ne garde ici que l'état transitoire du geste.
  const dragRef = useRef<{ px: number; py: number; baseX: number; baseY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, baseX: pos.x, baseY: pos.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Glisser la photo d'une largeur de contrôle déplace le cadrage de 100 %.
    // Glisser vers la droite montre la partie GAUCHE → x diminue (la photo suit
    // le doigt), miroir pour l'axe vertical → geste « naturel ».
    const nx = clampPct(d.baseX - ((e.clientX - d.px) / size) * 100);
    const ny = clampPct(d.baseY - ((e.clientY - d.py) / size) * 100);
    onChange({ x: Math.round(nx), y: Math.round(ny) });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const STEP = 5;
    let { x, y } = pos;
    if (e.key === 'ArrowLeft') x = clampPct(x - STEP);
    else if (e.key === 'ArrowRight') x = clampPct(x + STEP);
    else if (e.key === 'ArrowUp') y = clampPct(y - STEP);
    else if (e.key === 'ArrowDown') y = clampPct(y + STEP);
    else return;
    e.preventDefault();
    onChange({ x: Math.round(x), y: Math.round(y) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('recenterPhoto')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos.x)}
        aria-valuetext={t('recenterPhotoValue', { x: Math.round(pos.x), y: Math.round(pos.y) })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative', width: size, height: size, flexShrink: 0,
          borderRadius: '50%', overflow: 'hidden',
          border: '1.5px solid var(--border-strong)', background: '#1c1c1c',
          cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none',
          outlineOffset: '2px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, pointerEvents: 'none', userSelect: 'none' }} />
        {/* Repère de manipulation — s'efface pendant le glissé pour dégager la vue. */}
        <span aria-hidden="true" style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.9)', pointerEvents: 'none',
          opacity: dragging ? 0 : 0.85, transition: 'opacity 150ms ease',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        }}>
          <Move size={Math.round(size * 0.18)} />
        </span>
      </div>
      <button type="button" onClick={() => onChange({ x: 50, y: 50 })} className="btn btn-ghost btn-sm" style={{ gap: '5px' }}>
        <RotateCcw size={13} aria-hidden="true" /> {t('recenterReset')}
      </button>
    </div>
  );
}
