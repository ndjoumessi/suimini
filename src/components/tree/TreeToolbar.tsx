'use client';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';
import { Search, ZoomIn, ZoomOut, Crosshair, Info, Plus, Aperture, Printer, Maximize2 } from 'lucide-react';

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
}

/** The tree-view control bar: Focus/Complète toggle, root picker (with search
 *  dropdown), pan/zoom + fan + legend controls, export/add. Extracted from
 *  TreeView so the canvas component stays focused on layout + rendering. */
export default function TreeToolbar({
  isMobile, treeName, treeMode, setTreeMode, showSearch, setShowSearch, searchQ, setSearchQ,
  persons, filteredPersons, onPickRoot, layoutMode, setLayoutMode, onRecenter, onFitToScreen,
  scale, setScale, showLegend, setShowLegend, readOnly, onExport, onAddPerson,
}: Props) {
  const t = useTranslations('tree');
  const sep = <div aria-hidden="true" style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />;

  return (
    <div style={{ minHeight: '44px', padding: '5px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px', rowGap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
      {/* Tree name: spacer that pushes controls right on desktop. Hidden on phones
          (the name already shows in the mobile header). */}
      {!isMobile && (
        <h2 className="serif" style={{ margin: 0, fontSize: '1rem', color: 'var(--text)', flex: 1, minWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {treeName}
        </h2>
      )}

      {/* View toggle: Focus (3 generations) vs Complète (full pan/zoom tree) */}
      <div role="group" aria-label={t('displayMode')} style={{ display: 'inline-flex', border: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setTreeMode('focus')} aria-pressed={treeMode === 'focus'}
          style={{ appearance: 'none', cursor: 'pointer', border: 'none', padding: '7px 12px', minHeight: '32px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
            background: treeMode === 'focus' ? 'var(--accent)' : 'transparent', color: treeMode === 'focus' ? '#0d0d0d' : 'var(--text-muted)' }}>
          {t('modeFocus')}
        </button>
        <button onClick={() => setTreeMode('full')} aria-pressed={treeMode === 'full'}
          style={{ appearance: 'none', cursor: 'pointer', border: 'none', borderLeft: '1px solid var(--border)', padding: '7px 12px', minHeight: '32px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
            background: treeMode === 'full' ? 'var(--accent)' : 'transparent', color: treeMode === 'full' ? '#0d0d0d' : 'var(--text-muted)' }}>
          {t('modeFull')}
        </button>
      </div>

      {sep}

      {/* Change root */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowSearch(!showSearch)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }} title={t('changeRoot')} aria-label={t('changeRoot')} aria-expanded={showSearch}>
          <Search size={14} aria-hidden="true" /> {!isMobile && t('root')}
        </button>
        {showSearch && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px', width: '240px', boxShadow: 'var(--shadow-lg)' }}>
            <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t('personNamePlaceholder')} className="input" style={{ marginBottom: '6px' }} />
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
        <button onClick={onRecenter} className="btn btn-secondary btn-sm btn-icon" title={t('centerOnRoot')} aria-label={t('center')}><Crosshair size={14} aria-hidden="true" /></button>
        <button onClick={onFitToScreen} className="btn btn-secondary btn-sm btn-icon" title={t('fitToScreen')} aria-label={t('fitToScreen')}><Maximize2 size={14} aria-hidden="true" /></button>
        <button onClick={() => setScale(s => Math.max(0.25, s * 0.8))} className="btn btn-secondary btn-sm btn-icon" title={t('zoomOut')} aria-label={t('zoomOut')}><ZoomOut size={14} aria-hidden="true" /></button>
        <button onClick={() => setScale(1)} className="btn btn-secondary btn-sm" style={{ minWidth: '46px' }} title={t('resetZoom')} aria-label={t('resetZoom')}>{Math.round(scale * 100)}%</button>
        <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))} className="btn btn-secondary btn-sm btn-icon" title={t('zoomIn')} aria-label={t('zoomIn')}><ZoomIn size={14} aria-hidden="true" /></button>
      </>}

      {treeMode === 'full' && <>
        {sep}
        <button onClick={() => setLayoutMode(m => m === 'fan' ? 'vertical' : 'fan')} className="btn btn-sm" style={{ gap: '6px', background: layoutMode === 'fan' ? 'var(--accent)' : 'var(--bg-muted)', color: layoutMode === 'fan' ? '#0d0d0d' : 'var(--text-muted)', border: '1px solid var(--border)' }} title={t('toggleFan')} aria-label={t('fan')} aria-pressed={layoutMode === 'fan'}>
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
