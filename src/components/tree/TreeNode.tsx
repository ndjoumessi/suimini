'use client';
import { Person } from '@/types';
import { Crown } from 'lucide-react';
import { nodeStyle, nameLines } from './nodeStyle';

interface Props {
  person: Person;
  role: 'focus' | 'spouse' | 'parent' | 'child';
  x: number; y: number; w: number; h: number;
  isPivot: boolean; isSpouse: boolean; isSelected: boolean; isFocus: boolean;
  /** Generation accent colour (top bar). */
  genColor: string;
  dateStr: string;
  displayName: string;
  unknownLabel: string;
  /** Genre en toutes lettres — la barre colorée seule ne suffit pas (WCAG 1.4.1). */
  genderLabel?: string;
  onClick: () => void;
  onDoubleClick: () => void;
}

/** One person node in the FocusTree. Gender (or gold pivot/spouse) drives the
 *  face tint, left bar and name colour via the shared palette; the `.ft-*`
 *  classes live in FocusTree's <style> block. */
export default function TreeNode({
  person: p, role, x, y, w, h, isPivot, isSpouse, isSelected, isFocus,
  genColor, dateStr, displayName, unknownLabel, genderLabel, onClick, onDoubleClick,
}: Props) {
  const st = nodeStyle(p, isPivot, isSpouse);
  const { primary, secondary } = nameLines(p, unknownLabel);
  const place = p.birthPlace?.city;
  // Atténuation par rôle : parents 0.75, enfants 0.85, focus/conjoint 1.0 — le nœud
  // focus ressort nettement (voir aussi .ft-node-focus : ring + scale).
  const opacity = role === 'parent' ? 0.75 : role === 'child' ? 0.85 : 1;
  return (
    <button
      className={`ft-node ${isFocus ? 'ft-node-focus' : ''} ${isSelected ? 'ft-node-sel' : ''}`}
      style={{ left: x, top: y, width: w, height: h, opacity, background: st.bg }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={`${displayName}${genderLabel ? `, ${genderLabel}` : ''}${dateStr ? `, ${dateStr}` : ''}`}
      title={`${displayName}${dateStr ? ` · ${dateStr}` : ''}`}
      data-role={role}
    >
      <span className="ft-edge" style={{ background: st.bar }} aria-hidden="true" />
      <span className="ft-gen" style={{ background: genColor }} aria-hidden="true" />
      {isPivot && <Crown size={11} className="ft-crown" aria-hidden="true" />}
      <span className="ft-body">
        <span className="ft-name" style={{ color: st.name }}>{primary}</span>
        {secondary && <span className="ft-surname">{secondary}</span>}
        {p.nickName?.trim() && <span className="ft-nickname">{p.nickName.trim()}</span>}
        {dateStr && <span className="ft-dates">{dateStr}</span>}
        {place && <span className="ft-place">{place}</span>}
      </span>
    </button>
  );
}
