'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree } from '@/types';
import { ScrollText, Copy, Download, RefreshCw, X, Check } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useOverlay } from '@/hooks/useOverlay';

type State = 'idle' | 'loading' | 'result' | 'error';

export default function NarrativeModal({ tree, onClose }: { tree: FamilyTree; onClose: () => void }) {
  const t = useTranslations('narrative');
  const [state, setState] = useState<State>('idle');
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // useOverlay = trap Tab + Esc + scroll-lock + restauration du focus. L'ancienne
  // gestion manuelle omettait le piège du Tab (le focus sortait de la modale).
  const dialogRef = useOverlay<HTMLDivElement>(onClose);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    setState('loading');
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('errStatus', { status: res.status }));
        setState('error');
        return;
      }
      setNarrative(data.narrative || '');
      setState('result');
    } catch {
      setError(t('errNetwork'));
      setState('error');
    }
  }, [tree, t]);

  // Auto-generate on open (Esc/focus/scroll-lock : gérés par useOverlay).
  useEffect(() => { generate(); }, [generate]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }, [narrative]);

  const download = useCallback(() => {
    const slug = (tree.name || 'famille').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const blob = new Blob([narrative], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suimini-rapport-${slug || 'famille'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [narrative, tree.name]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal" style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('title')} aria-busy={state === 'loading'}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <ScrollText size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.25rem' }}>{t('title')}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('subtitle', { name: tree.name })}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={t('close')}><X size={18} aria-hidden="true" /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {state === 'loading' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <LoadingSpinner size={22} />
              <p style={{ marginTop: '14px' }}>{t('composing')}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>{t('composingHint')}</p>
            </div>
          )}

          {state === 'error' && (
            <div style={{ padding: '32px 20px', maxWidth: '420px', margin: '0 auto' }}>
              <ErrorMessage message={error || t('errGenerate')} onRetry={generate} />
            </div>
          )}

          {state === 'result' && (
            <div
              className="serif present-fade"
              style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap', maxWidth: '62ch', margin: '0 auto' }}
            >
              {narrative}
            </div>
          )}
        </div>

        {/* Footer actions (result only) */}
        {state === 'result' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={copy} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              {copied ? <><Check size={14} aria-hidden="true" /> {t('copied')}</> : <><Copy size={14} aria-hidden="true" /> {t('copy')}</>}
            </button>
            <button onClick={download} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Download size={14} aria-hidden="true" /> {t('downloadTxt')}
            </button>
            <button onClick={generate} className="btn btn-ghost btn-sm" style={{ gap: '6px', marginLeft: 'auto' }}>
              <RefreshCw size={14} aria-hidden="true" /> {t('regenerate')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
