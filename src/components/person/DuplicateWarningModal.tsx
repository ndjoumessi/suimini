'use client';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useOverlay } from '@/hooks/useOverlay';
import { getDisplayName } from '@/lib/treeUtils';
import type { DuplicateMatch } from '@/lib/duplicateDetection';
import { isBlocking } from '@/lib/duplicateDetection';

interface Props {
  candidates: DuplicateMatch[];
  /** Annuler : ferme la modale et retourne au formulaire. */
  onCancel: () => void;
  /** WARN seulement : ajoute quand même la personne (poursuit la sauvegarde). */
  onAddAnyway: () => void;
  /** BLOQUANT seulement : ouvrir la fiche existante la plus probable. */
  onOpenExisting: (personId: string) => void;
}

/** Mappe un id de raison stable → clé i18n `duplicates.reason.*`. */
const REASON_KEY: Record<string, string> = {
  sameFirstName: 'reasonSameFirstName',
  sameLastName: 'reasonSameLastName',
  closeBirthYear: 'reasonCloseBirthYear',
  sameGender: 'reasonSameGender',
};

export default function DuplicateWarningModal({ candidates, onCancel, onAddAnyway, onOpenExisting }: Props) {
  const t = useTranslations('duplicates');
  const overlayRef = useOverlay(onCancel);

  const maxScore = candidates.reduce((m, c) => Math.max(m, c.score), 0);
  const blocking = isBlocking(maxScore);
  const top = candidates[0];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dup-title"
        aria-describedby="dup-desc"
        className="modal"
        style={{ maxWidth: '520px' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <h2 id="dup-title" className="serif" style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {blocking
              ? <ShieldAlert size={20} aria-hidden="true" style={{ color: 'var(--danger)' }} />
              : <AlertTriangle size={20} aria-hidden="true" style={{ color: 'var(--accent)' }} />}
            {blocking ? t('blockingTitle') : t('warnTitle')}
          </h2>
          <button onClick={onCancel} className="btn btn-ghost btn-sm btn-icon" aria-label={t('cancel')}><X size={16} aria-hidden="true" /></button>
        </div>

        <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
          <p id="dup-desc" style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {blocking ? t('blockingDesc') : t('warnDesc')}
          </p>

          {/* Liste des candidats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {candidates.map(({ person, score, reasons }) => (
              <div key={person.id} style={{ border: '1px solid var(--border-strong)', background: '#1A1A24', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                  <span className="serif" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {getDisplayName(person) || t('unnamed')}
                    {person.birthDate ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-light)', marginLeft: '8px' }}>{new Date(person.birthDate).getFullYear()}</span> : null}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: score >= 90 ? 'var(--danger)' : 'var(--accent)' }}>
                    {t('matchScore', { score })}
                  </span>
                </div>

                {/* Jauge de score */}
                <div aria-hidden="true" style={{ height: '4px', background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: score >= 90 ? 'var(--danger)' : 'var(--accent)' }} />
                </div>

                {/* Raisons */}
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {reasons.map(r => (
                    <li key={r} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '2px 7px' }}>
                      {t(REASON_KEY[r] ?? r)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onCancel} className="btn btn-ghost">{t('cancel')}</button>
            {blocking ? (
              <button type="button" onClick={() => top && onOpenExisting(top.person.id)} className="btn btn-primary">
                {t('openExisting')}
              </button>
            ) : (
              <button type="button" onClick={onAddAnyway} className="btn btn-primary">
                {t('addAnyway')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
