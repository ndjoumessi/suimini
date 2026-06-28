'use client';
import { useTranslations } from 'next-intl';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
  nextAction: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

export default function HistoryIndicator({ canUndo, canRedo, lastAction, nextAction, onUndo, onRedo }: Props) {
  const t = useTranslations('history');
  if (!canUndo && !canRedo) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 0,
      boxShadow: 'var(--shadow)', padding: '5px 8px', fontSize: '12px',
    }}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? t('undoTooltip', { action: lastAction ?? '' }) : t('nothingUndo')}
        className="btn btn-ghost btn-sm"
        style={{ opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'default' }}
      >
        ↩ {t('undo')}
      </button>

      {canUndo && lastAction && (
        <span style={{ color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastAction}
        </span>
      )}

      <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

      <button
        onClick={onRedo}
        disabled={!canRedo}
        title={canRedo ? t('redoTooltip', { action: nextAction ?? '' }) : t('nothingRedo')}
        className="btn btn-ghost btn-sm"
        style={{ opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'default' }}
      >
        ↪ {t('redo')}
      </button>
    </div>
  );
}
