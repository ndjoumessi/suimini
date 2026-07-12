'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Person } from '@/types';
import { getDisplayName } from '@/lib/treeUtils';
import { GENDER_BAR } from '../tree/nodeStyle';

/**
 * Reusable searchable, alphabetically-sorted person picker.
 *
 * Replaces the non-sorted, non-searchable native `<select>` anti-pattern
 * (Exploration, Journal…). Behaviour mirrors the original Gallery="Associate
 * with" combobox: text search, alphabetical order (getDisplayName +
 * localeCompare 'fr'), gender dot, open on focus, close on blur/Escape, plus
 * full keyboard navigation (Arrow keys + Enter).
 *
 * Styling is self-contained (`.pc-*`, scoped `<style>`) to avoid a fragile CSS
 * coupling to any single view; the parent still owns its own visible label.
 */

function genderDot(p: Person): string {
  return p.gender === 'male' ? GENDER_BAR.male : p.gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
}

interface Props {
  /** Full pool of candidate persons (order irrelevant — sorted internally). */
  persons: Person[];
  /** Currently selected id ('' = none / empty option). */
  selectedId: string;
  /** Called with the chosen person id, or '' when the empty option is picked. */
  onSelect: (id: string) => void;
  /** Input placeholder (shown when nothing is selected). */
  placeholder: string;
  /** Text shown when a search yields no match. */
  emptySearchLabel: string;
  /** Ids to hide from the list (e.g. Person A when choosing Person B). */
  excludeIds?: string[];
  /** Optional "all / none" entry pinned at the top (selecting it calls onSelect('')). */
  emptyOption?: { label: string };
  /** Base id — the input gets `id`, the listbox `${id}-listbox`. */
  id: string;
  /** id of an external <label> element (preferred). */
  ariaLabelledBy?: string;
  /** aria-label fallback when there is no visible label. */
  ariaLabel?: string;
  /** Extra class on the wrapper (width control, etc.). */
  className?: string;
}

export function PersonCombobox({
  persons, selectedId, onSelect, placeholder, emptySearchLabel,
  excludeIds, emptyOption, id, ariaLabelledBy, ariaLabel, className,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const excluded = useMemo(() => new Set(excludeIds || []), [excludeIds]);

  const sorted = useMemo(
    () => persons
      .filter(p => !excluded.has(p.id))
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr', { sensitivity: 'base' })),
    [persons, excluded],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(p => getDisplayName(p).toLowerCase().includes(q));
  }, [sorted, query]);

  // Combined, navigable option list (empty option pinned first, only when not searching).
  const options = useMemo<{ id: string; label: string; person?: Person }[]>(() => {
    const opts: { id: string; label: string; person?: Person }[] = [];
    if (emptyOption && !query.trim()) opts.push({ id: '', label: emptyOption.label });
    filtered.forEach(p => opts.push({ id: p.id, label: getDisplayName(p), person: p }));
    return opts;
  }, [emptyOption, query, filtered]);

  const selectedPerson = selectedId ? persons.find(p => p.id === selectedId) : undefined;
  const displayValue = open
    ? query
    : selectedPerson ? getDisplayName(selectedPerson)
    : (selectedId === '' && emptyOption) ? emptyOption.label
    : '';

  // Clamp during render (the option list may have shrunk after filtering).
  const safeActive = Math.min(activeIndex, Math.max(0, options.length - 1));

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${safeActive}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [safeActive, open]);

  const commit = useCallback((optId: string) => {
    onSelect(optId);
    setQuery('');
    setOpen(false);
  }, [onSelect]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(0); return; }
      setActiveIndex(i => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return;
      setActiveIndex(i => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      if (open && options[safeActive]) { e.preventDefault(); commit(options[safeActive].id); }
      return;
    }
  };

  const activeId = open && options[safeActive] ? `${id}-opt-${safeActive}` : undefined;

  return (
    <div className={`pc-wrap ${className || ''}`}>
      <span className="pc-chevron" aria-hidden="true"><ChevronDown size={15} /></span>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setQuery(''); setActiveIndex(0); setOpen(true); }}
        onClick={() => { if (blurTimer.current) clearTimeout(blurTimer.current); if (!open) { setQuery(''); setActiveIndex(0); setOpen(true); } }}
        onChange={e => { setQuery(e.target.value); setActiveIndex(0); if (!open) setOpen(true); }}
        onKeyDown={onKeyDown}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        className="input pc-input"
      />
      {open && (
        <ul ref={listRef} id={`${id}-listbox`} role="listbox" aria-label={ariaLabel || placeholder} className="pc-listbox">
          {options.length === 0 ? (
            <li className="pc-empty" role="presentation">{emptySearchLabel}</li>
          ) : options.map((opt, idx) => (
            <li key={opt.id || '__none__'} role="option" aria-selected={opt.id === selectedId}>
              <button
                type="button"
                id={`${id}-opt-${idx}`}
                data-idx={idx}
                className={`pc-option ${idx === safeActive ? 'active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => commit(opt.id)}
              >
                {opt.person
                  ? <span className="pc-dot" style={{ background: genderDot(opt.person) }} aria-hidden="true" />
                  : <span className="pc-dot pc-dot-all" aria-hidden="true" />}
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .pc-wrap { position: relative; width: 100%; }
        .pc-chevron { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); display: inline-flex; color: var(--text-muted); pointer-events: none; }
        .pc-input { cursor: pointer; padding-right: 32px; text-overflow: ellipsis; }
        .pc-listbox { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 264px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: #1a1a24; border: 1px solid var(--border-strong); box-shadow: var(--shadow); }
        .pc-option { width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 9px; background: transparent; border: none; color: var(--text); font-family: var(--font-body); font-size: 13.5px; text-align: left; cursor: pointer; }
        .pc-option.active, .pc-option:hover { background: var(--bg-card); outline: none; }
        li[aria-selected="true"] .pc-option { color: var(--accent); font-weight: 600; }
        .pc-dot { width: 9px; height: 9px; flex-shrink: 0; background: var(--text-light); }
        .pc-dot-all { background: transparent; border: 1.5px solid var(--text-light); }
        .pc-empty { padding: 9px; font-size: 13px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
