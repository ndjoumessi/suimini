'use client';
import { ViewMode } from '@/types';
import { useTranslations } from 'next-intl';
import { TreePine, Users, Map, BookOpen, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  activeView: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onOpenMenu: () => void;
}

const ITEMS: { view: ViewMode; Icon: LucideIcon; navKey: string }[] = [
  { view: 'tree', Icon: TreePine, navKey: 'tree' },
  { view: 'list', Icon: Users, navKey: 'persons' },
  { view: 'map', Icon: Map, navKey: 'map' },
  { view: 'journal', Icon: BookOpen, navKey: 'journal' },
];

export default function BottomNav({ activeView, onViewChange, onOpenMenu }: Props) {
  const tn = useTranslations('nav');
  return (
    <nav className="bottom-nav" aria-label={tn('mobileNav')}>
      {ITEMS.map(item => {
        const active = activeView === item.view;
        const label = tn(item.navKey);
        return (
          <button key={item.view} onClick={() => onViewChange(item.view)} aria-current={active ? 'page' : undefined} aria-label={label}
            className={`bn-item ${active ? 'bn-item-active' : ''}`} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
            {active && <span className="bn-active" aria-hidden="true" />}
            <item.Icon size={20} aria-hidden="true" />
            <span className="bn-label">{label}</span>
          </button>
        );
      })}
      <button onClick={onOpenMenu} className="bn-item" aria-label={tn('openMenu')} style={{ color: 'var(--text-muted)' }}>
        <Menu size={20} aria-hidden="true" />
        <span className="bn-label">{tn('menu')}</span>
      </button>

      <style>{`
        .bottom-nav { display: none; }
        @media (max-width: 768px) {
          .bottom-nav {
            display: flex; position: fixed; left: 0; bottom: 0; z-index: var(--z-sticky);
            width: 100vw; max-width: 100vw; box-sizing: border-box;
            background: var(--bg-card); border-top: var(--bw) solid var(--border-strong);
            padding: 4px 0 calc(4px + env(safe-area-inset-bottom, 0px));
          }
          .bn-item {
            position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;
            background: none; border: none; cursor: pointer; padding: 8px 2px; min-height: 52px;
            font-family: var(--font-body); touch-action: manipulation; transition: color var(--t-fast);
          }
          .bn-item-active { background: var(--accent-light); }
          .bn-label { font-size: 10px; font-weight: 700; letter-spacing: 0.2px; }
          .bn-active { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 30px; height: 3px; background: var(--accent); }
        }
      `}</style>
    </nav>
  );
}
