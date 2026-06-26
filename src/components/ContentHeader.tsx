'use client';
import { useTranslations } from 'next-intl';
import { ViewMode } from '@/types';
import { Plus, Play, Share2, FolderOpen, Printer, FileDown, Search } from 'lucide-react';

interface Props {
  activeView: ViewMode;
  activeTreeName?: string | null;
  canEdit?: boolean;
  onAddPerson: () => void;
  onPresent: () => void;
  onShare: () => void;
  onShowImportExport: () => void;
  onPrint: () => void;
  onExportPdf?: () => void;
  onOpenSearch: () => void;
}

/**
 * Desktop content header — homes the tree-scoped actions that used to crowd the
 * sidebar (Atelier Noir audit: the sidebar was doing nav + toolbar + account at
 * once). One labelled primary CTA, the rest as quiet icon buttons with tooltips.
 * Hidden on mobile (the mobile header + bottom nav cover that case).
 */
export default function ContentHeader({ activeView, activeTreeName, canEdit = true, onAddPerson, onPresent, onShare, onShowImportExport, onPrint, onExportPdf, onOpenSearch }: Props) {
  const t = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const tPdf = useTranslations('pdf');

  const titleKey: Record<string, string> = {
    dashboard: 'home', tree: 'tree', list: 'persons', map: 'map', timeline: 'timeline',
    journal: 'journal', birthdays: 'birthdays', gallery: 'gallery', ancestors: 'exploration',
    statistics: 'statistics', settings: 'settings', admin: 'admin',
  };
  const title = t(titleKey[activeView] || 'home');

  return (
    <div className="content-header">
      <div className="ch-title">
        <span className="ch-eyebrow label">{activeTreeName || ''}</span>
        <h1 className="ch-view">{title}</h1>
      </div>
      <div className="ch-actions">
        <button onClick={onOpenSearch} className="icon-btn" aria-label="Rechercher" title="⌘K">
          <Search size={18} aria-hidden="true" />
        </button>
        <button onClick={onPresent} className="icon-btn" aria-label={ts('presentMode')} title={ts('presentMode')}>
          <Play size={18} aria-hidden="true" />
        </button>
        <button onClick={onShare} className="icon-btn" aria-label={ts('share')} title={ts('share')}>
          <Share2 size={18} aria-hidden="true" />
        </button>
        <button onClick={onShowImportExport} className="icon-btn" aria-label={ts('import')} title={ts('import')}>
          <FolderOpen size={18} aria-hidden="true" />
        </button>
        <button onClick={onPrint} className="icon-btn" aria-label={ts('print')} title={ts('print')}>
          <Printer size={18} aria-hidden="true" />
        </button>
        {onExportPdf && (
          <button onClick={onExportPdf} className="icon-btn" aria-label={tPdf('export')} title={tPdf('export')}>
            <FileDown size={18} aria-hidden="true" />
          </button>
        )}
        {canEdit && (
          <button onClick={onAddPerson} className="btn btn-primary btn-sm" style={{ marginLeft: '4px' }}>
            <Plus size={16} aria-hidden="true" /> {ts('addPerson')}
          </button>
        )}
      </div>

      <style>{`
        .content-header {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 24px; border-bottom: var(--bw) solid var(--border);
          background: var(--bg); flex-shrink: 0;
        }
        .ch-title { flex: 1; min-width: 0; }
        .ch-eyebrow { display: block; color: var(--accent-text); margin-bottom: 1px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ch-view { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.03em; text-transform: uppercase; line-height: 1; }
        .ch-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        @media (max-width: 768px) { .content-header { display: none; } }
      `}</style>
    </div>
  );
}
