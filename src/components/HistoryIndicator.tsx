'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
  nextAction: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

const DISMISS_MS = 4000;

export default function HistoryIndicator({ canUndo, canRedo, lastAction, nextAction, onUndo, onRedo }: Props) {
  const t = useTranslations('history');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sigRef = useRef<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Signature of the current history state — changes on every new action / undo / redo.
  const sig = `${lastAction}¦${nextAction}¦${canUndo}¦${canRedo}`;

  // Show + (re)arm the 4 s auto-dismiss ONLY when the history actually CHANGES (a new
  // action, an undo or a redo) — never on mount/return-to-view, so the bar doesn't
  // linger forever nor flash when you just navigate back with old history in the stack.
  useEffect(() => {
    if (sigRef.current === null) { sigRef.current = sig; return; }   // skip first (mount)
    if (sig === sigRef.current) return;
    sigRef.current = sig;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!canUndo && !canRedo) { setVisible(false); return; }
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS);
  }, [sig, canUndo, canRedo]);

  // Clear the timer on unmount (e.g. navigating away from the tree view).
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Dismiss on any click outside the bar.
  useEffect(() => {
    if (!visible) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setVisible(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [visible]);

  if ((!canUndo && !canRedo) || !visible) return null;

  return (
    // role="status" : l'apparition de la barre (« Annuler : … ») est annoncée aux
    // lecteurs d'écran — elle s'auto-efface après 4 s, sinon ils la manquaient.
    <div ref={boxRef} role="status" style={{
      position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
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
