'use client';
import { Person } from '@/types';
import { Crown } from 'lucide-react';

interface Props {
  person: Person;
  role: 'focus' | 'spouse' | 'parent' | 'child';
  x: number; y: number; w: number; h: number;
  isPivot: boolean; isSelected: boolean; isFocus: boolean; dim: boolean;
  /** Gender (or gold pivot) bar colour. */
  edge: string;
  /** Generation accent colour (top bar + GÉN tag). */
  genColor: string;
  gen: number;
  dateStr: string;
  displayName: string;
  onClick: () => void;
  onDoubleClick: () => void;
}

/** One person node in the FocusTree (parents · focus couple · children rows).
 *  Presentational: positions, colours and labels are computed by FocusTree; the
 *  `.ft-*` classes live in FocusTree's <style> block. */
export default function TreeNode({
  person: p, role, x, y, w, h, isPivot, isSelected, isFocus, dim,
  edge, genColor, gen, dateStr, displayName, onClick, onDoubleClick,
}: Props) {
  const place = p.birthPlace?.city;
  return (
    <button
      className={`ft-node ${isFocus ? 'ft-node-focus' : ''} ${isSelected ? 'ft-node-sel' : ''}`}
      style={{ left: x, top: y, width: w, height: h, opacity: dim ? 0.82 : 1 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={displayName}
      title={`${displayName}${dateStr ? ` · ${dateStr}` : ''}`}
      data-role={role}
    >
      <span className="ft-edge" style={{ background: edge }} aria-hidden="true" />
      <span className="ft-gen" style={{ background: genColor }} aria-hidden="true" />
      {isPivot && <Crown size={11} className="ft-crown" aria-hidden="true" />}
      <span className="ft-gen-tag" style={{ color: genColor }} aria-hidden="true">GÉN.&nbsp;{gen + 1}</span>
      <span className="ft-body">
        <span className="ft-name">{p.firstName}</span>
        <span className="ft-surname">{p.lastName}</span>
        <span className="ft-dates">{dateStr}</span>
        {place && <span className="ft-place">{place}</span>}
      </span>
    </button>
  );
}
