'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';
import { Search, ZoomIn, ZoomOut, Crosshair, Info, Plus, Aperture, Printer, Maximize2, Route, Highlighter } from 'lucide-react';

function initials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}

interface Props {
  isMobile: boolean;
  treeName: string;
  treeMode: 'focus' | 'full';
  setTreeMode: (m: 'focus' | 'full') => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchQ: string;
  setSearchQ: (v: string) => void;
  /** Full person list (shown, capped, when the search box is empty). */
  persons: Person[];
  /** Search results for the current query. */
  filteredPersons: Person[];
  /** Re-root + re-focus + recenter on the chosen person. */
  onPickRoot: (id: string) => void;
  layoutMode: 'vertical' | 'fan';
  setLayoutMode: Dispatch<SetStateAction<'vertical' | 'fan'>>;
  onRecenter: () => void;
  onFitToScreen: () => void;
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;
  showLegend: boolean;
  setShowLegend: Dispatch<SetStateAction<boolean>>;
  readOnly: boolean;
  onExport?: () => void;
  onAddPerson: () => void;
  /** Chemin de parenté « Comment X est lié à Y ? » (vue Complète verticale). */
  onComputePath: (aId: string, bId: string) => void;
  onClearPath: () => void;
  pathActive: boolean;
  pathNotFound: boolean;
  /** Surligne les correspondances de la requête dans l'arbre SANS re-centrer. */
  onHighlight: (q: string) => void;
  highlightActive: boolean;
}

/** The tree-view control bar: Focus/Complète toggle, root picker (with search
 *  dropdown), pan/zoom + fan + legend controls, export/add. Extracted from
 *  TreeView so the canvas component stays focused on layout + rendering. */
export default function TreeToolbar({
  isMobile, treeName, treeMode, setTreeMode, showSearch, setShowSearch, searchQ, setSearchQ,
  persons, filteredPersons, onPickRoot, layoutMode, setLayoutMode, onRecenter, onFitToScreen,
  scale, setScale, showLegend, setShowLegend, readOnly, onExport, onAddPerson,
  onComputePath, onClearPath, pathActive, pathNotFound, onHighlight, highlightActive,
}: Props) {
  const t = useTranslations('tree');
  const sep = <div aria-hidden="true" style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />;
  // Panneau « chemin de parenté » : deux personnes à relier.
  const [showPath, setShowPath] = useState(false);
  const [pathA, setPathA] = useState('');
  const [pathB, setPathB] = useState('');
  const sortedPersons = [...persons].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

  return (
    <div style={{ minHeight: '44px', padding: '5px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px', rowGap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
      {/* Nom d'arbre : sur DESKTOP la sidebar l'affiche déjà (« Arbre actif ») → on
          évite le doublon avec un simple spacer flex neutre qui pousse les contrôles
          à droite. Sur MOBILE (pas de sidebar visible) on garde le nom comme titre. */}
      {isMobile ? (
        <h2 className="serif" style={{ margin: 0, fontSize: '1rem', color: 'var(--text)', flex: 1, minWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {treeName}
        </h2>
      ) : (
        <div aria-hidden="true" style={{ flex: 1, minWidth: '8px' }} />
      )}

      {/* View toggle: Focus (3 generations) vs Complète (full pan/zoom tree) */}
      <div role="group" aria-label={t('displayMode')} style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0 }}>
        <button onClick={() => setTreeMode('focus')} aria-pressed={treeMode === 'focus'}
          style={{ appearance: 'none', cursor: 'pointer', border: 'none', padding: '7px 12px', minHeight: '32px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
            background: treeMode === 'focus' ? 'var(--accent)' : 'transparent', color: treeMode === 'focus' ? 'var(--ink-on-accent)' : 'var(--text-muted)' }}>
          {t('modeFocus')}
        </button>
        <button onClick={() => setTreeMode('full')} aria-pressed={treeMode === 'full'}
          style={{ appearance: 'none', cursor: 'pointer', border: 'none', borderLeft: '1px solid var(--border)', padding: '7px 12px', minHeight: '32px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
            background: treeMode === 'full' ? 'var(--accent)' : 'transparent', color: treeMode === 'full' ? 'var(--ink-on-accent)' : 'var(--text-muted)' }}>
          {t('modeFull')}
        </button>
      </div>

      {sep}

      {/* Change root */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowSearch(!showSearch)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }} title={t('originTooltip')} aria-label={t('originTooltip')} aria-expanded={showSearch}>
          <Search size={14} aria-hidden="true" /> {!isMobile && t('origin')}
        </button>
        {showSearch && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px', width: '240px', boxShadow: 'var(--shadow-lg)' }}>
            <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t('personNamePlaceholder')} className="input" style={{ marginBottom: '6px' }} />
            {/* Surligner sans re-centrer — n'a de sens qu'en vue Complète (canvas). */}
            {treeMode === 'full' && layoutMode === 'vertical' && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!searchQ}
                aria-pressed={highlightActive}
                style={{ width: '100%', marginBottom: '6px', gap: '6px' }}
                onClick={() => { onHighlight(searchQ); setShowSearch(false); }}
              >
                <Highlighter size={13} aria-hidden="true" /> {t('highlightBtn')}
              </button>
            )}
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {(searchQ ? filteredPersons : persons.slice(0, 20)).map(p => (
                <button key={p.id} onClick={() => onPickRoot(p.id)}
                  style={{ width: '100%', padding: '7px 8px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ width: '22px', height: '22px', flexShrink: 0, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{initials(p)}</span>
                  <span style={{ flex: 1 }}>{getDisplayName(p)}</span>
                  <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>{formatYear(p.birthDate)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {treeMode === 'full' && layoutMode === 'vertical' && <>
        {sep}
        {/* Chemin de parenté — « Comment X est lié à Y ? » */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowPath(v => !v)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}
            title={t('pathTitle')} aria-label={t('pathTitle')} aria-expanded={showPath} aria-pressed={pathActive}>
            <Route size={14} aria-hidden="true" /> {!isMobile && t('pathBtn')}
          </button>
          {showPath && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', width: '260px', boxShadow: 'var(--shadow-lg)' }}>
              <div className="label" style={{ marginBottom: '8px' }}>{t('pathTitle')}</div>
              <label htmlFor="kin-person-a" className="sr-only">{t('pathPersonA')}</label>
              <select id="kin-person-a" className="input" value={pathA} onChange={e => setPathA(e.target.value)} style={{ marginBottom: '6px' }}>
                <option value="">{t('pathPersonA')}</option>
                {sortedPersons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
              </select>
              <label htmlFor="kin-person-b" className="sr-only">{t('pathPersonB')}</label>
              <select id="kin-person-b" className="input" value={pathB} onChange={e => setPathB(e.target.value)}>
                <option value="">{t('pathPersonB')}</option>
                {sortedPersons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button className="btn btn-primary btn-sm" disabled={!pathA || !pathB || pathA === pathB}
                  onClick={() => { onComputePath(pathA, pathB); }}>
                  {t('pathCompute')}
                </button>
                {pathActive && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { onClearPath(); setShowPath(false); }}>
                    {t('pathClear')}
                  </button>
                )}
              </div>
              {pathNotFound && (
                <div role="alert" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{t('pathNone')}</div>
              )}
            </div>
          )}
        </div>
        {sep}
        <button onClick={onRecenter} className="btn btn-secondary btn-sm btn-icon" title={t('centerOnRoot')} aria-label={t('center')}><Crosshair size={14} aria-hidden="true" /></button>
        <button onClick={onFitToScreen} className="btn btn-secondary btn-sm btn-icon" title={t('fitToScreen')} aria-label={t('fitToScreen')}><Maximize2 size={14} aria-hidden="true" /></button>
        <button onClick={() => setScale(s => Math.max(0.25, s * 0.8))} className="btn btn-secondary btn-sm btn-icon" title={t('zoomOut')} aria-label={t('zoomOut')}><ZoomOut size={14} aria-hidden="true" /></button>
        <button onClick={() => setScale(1)} className="btn btn-secondary btn-sm" style={{ minWidth: '46px' }} title={t('resetZoom')} aria-label={t('resetZoom')}>{Math.round(scale * 100)}%</button>
        <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))} className="btn btn-secondary btn-sm btn-icon" title={t('zoomIn')} aria-label={t('zoomIn')}><ZoomIn size={14} aria-hidden="true" /></button>
      </>}

      {treeMode === 'full' && <>
        {sep}
        <button onClick={() => setLayoutMode(m => m === 'fan' ? 'vertical' : 'fan')} className="btn btn-sm" style={{ gap: '6px', background: layoutMode === 'fan' ? 'var(--accent)' : 'var(--bg-muted)', color: layoutMode === 'fan' ? 'var(--ink-on-accent)' : 'var(--text-muted)', border: '1px solid var(--border)' }} title={t('toggleFan')} aria-label={t('fan')} aria-pressed={layoutMode === 'fan'}>
          <Aperture size={14} aria-hidden="true" /> {!isMobile && t('fan')}
        </button>
        <button onClick={() => setShowLegend(l => !l)} className="btn btn-secondary btn-sm btn-icon" title={t('legend')} aria-label={t('legend')} aria-pressed={showLegend}>
          <Info size={14} aria-hidden="true" />
        </button>
      </>}

      {!readOnly && (
        <>
          {sep}
          {onExport && (
            <button onClick={onExport} className="btn btn-secondary btn-sm btn-icon" title={t('exportPdf')} aria-label={t('exportPdf')}><Printer size={14} aria-hidden="true" /></button>
          )}
          <button onClick={onAddPerson} className="btn btn-primary btn-sm" style={{ gap: '6px' }} title={t('add')} aria-label={t('add')}><Plus size={14} aria-hidden="true" /> {!isMobile && t('add')}</button>
        </>
      )}
    </div>
  );
}
