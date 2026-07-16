'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { useOverlay } from '@/hooks/useOverlay';
import type { Conflict } from '@/lib/sync/conflictQueue';

/**
 * Conflit multi-appareils (delete-vs-edit) : la fiche/relation qu'on éditait a été
 * supprimée sur un AUTRE appareil. Décision REQUISE (alertdialog) — pas de fermeture
 * au clic extérieur ni à Échap : l'utilisateur DOIT choisir entre garder la
 * suppression et restaurer. a11y : role="alertdialog", aria-modal, aria-labelledby
 * (titre) + aria-describedby (corps) ; trap de focus / scroll-lock via useOverlay.
 */
export default function ConflictModal({
  conflict, name, onKeepDeletion, onRestore,
}: {
  conflict: Conflict;
  name: string;
  onKeepDeletion: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations('conflicts');
  // Décision forcée : Échap ne ferme pas (onClose = no-op). Le trap de focus et le
  // verrou de scroll de useOverlay restent actifs.
  const noop = useCallback(() => {}, []);
  const dialogRef = useOverlay<HTMLDivElement>(noop);

  const isPerson = conflict.entityType === 'person';

  return (
    <div className="modal-overlay">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal"
        style={{ maxWidth: '460px', width: '100%' }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-body"
      >
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
            <h2 id="conflict-title" className="serif" style={{ margin: 0, fontSize: '1.2rem' }}>{t('title')}</h2>
          </div>
          <p id="conflict-body" style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            {t('body', { name })}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={onKeepDeletion} className="btn btn-secondary btn-sm">
              {t('keepDeletion')}
            </button>
            <button onClick={onRestore} className="btn btn-primary btn-sm">
              {isPerson ? t('restorePerson') : t('restoreRelationship')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
