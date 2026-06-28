'use client';
import { useTranslations } from 'next-intl';
import { ViewMode } from '@/types';
import { Play, Search } from 'lucide-react';

interface Props {
  activeView: ViewMode;
  activeTreeName?: string | null;
  onPresent: () => void;
  onOpenSearch: () => void;
}

/**
 * Desktop content header — title + the two actions that are NOT in the sidebar:
 * global search (⌘K) and presentation mode. The tree-scoped actions (add, share,
 * import/export, print, PDF) now live in the sidebar's quick-actions block, so
 * they were removed here to avoid duplication. Hidden on mobile (header + bottom
 * nav cover that case).
 */
export default function ContentHeader({ activeView, activeTreeName, onPresent, onOpenSearch }: Props) {
  const t = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const tcom = useTranslations('common');

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
        <button onClick={onOpenSearch} className="icon-btn" aria-label={tcom('search')} title="⌘K">
          <Search size={18} aria-hidden="true" />
        </button>
        <button onClick={onPresent} className="icon-btn" aria-label={ts('presentMode')} title={ts('presentMode')}>
          <Play size={18} aria-hidden="true" />
        </button>
      </div>

      <style>{`
        .content-header {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 24px; border-bottom: var(--bw) solid var(--border);
          background: var(--bg); flex-shrink: 0;
        }
        .ch-title { flex: 1; min-width: 0; }
        .ch-eyebrow { display: block; color: var(--accent-text); margin-bottom: 1px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ch-view { font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; letter-spacing: -0.005em; line-height: 1.05; }
        .ch-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        @media (max-width: 768px) { .content-header { display: none; } }
      `}</style>
    </div>
  );
}
