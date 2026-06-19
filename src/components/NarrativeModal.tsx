'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FamilyTree } from '@/types';
import { ScrollText, Copy, Download, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';

type State = 'idle' | 'loading' | 'result' | 'error';

export default function NarrativeModal({ tree, onClose }: { tree: FamilyTree; onClose: () => void }) {
  const [state, setState] = useState<State>('idle');
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
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
        setError(data?.error || `Erreur (${res.status}).`);
        setState('error');
        return;
      }
      setNarrative(data.narrative || '');
      setState('result');
    } catch {
      setError('Connexion au serveur impossible. Vérifiez votre réseau et réessayez.');
      setState('error');
    }
  }, [tree]);

  // Auto-generate on open; Esc closes; lock body scroll (matches the app's modal pattern).
  useEffect(() => { generate(); }, [generate]);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add('modal-open');
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      previouslyFocused?.focus?.();   // restore focus to the trigger on close
    };
  }, [onClose]);

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
      <div ref={dialogRef} tabIndex={-1} className="modal" style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Rapport narratif" aria-busy={state === 'loading'}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <ScrollText size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.25rem' }}>Rapport narratif</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Le récit de « {tree.name} », écrit par l&apos;IA</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fermer"><X size={18} aria-hidden="true" /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {state === 'loading' && (
            <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: '22px', height: '22px', color: 'var(--accent)' }} />
              <p style={{ marginTop: '14px' }}>Composition du récit familial…</p>
              <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>Cela prend généralement quelques secondes.</p>
            </div>
          )}

          {state === 'error' && (
            <div role="alert" style={{ textAlign: 'center', padding: '32px 20px', maxWidth: '420px', margin: '0 auto' }}>
              <AlertTriangle size={40} strokeWidth={1.4} style={{ color: 'var(--danger)', marginBottom: '12px' }} aria-hidden="true" />
              <h3 style={{ margin: '0 0 6px' }}>Génération impossible</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
              <button onClick={generate} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                <RefreshCw size={14} aria-hidden="true" /> Réessayer
              </button>
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
              {copied ? <><Check size={14} aria-hidden="true" /> Copié</> : <><Copy size={14} aria-hidden="true" /> Copier</>}
            </button>
            <button onClick={download} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Download size={14} aria-hidden="true" /> Télécharger (.txt)
            </button>
            <button onClick={generate} className="btn btn-ghost btn-sm" style={{ gap: '6px', marginLeft: 'auto' }}>
              <RefreshCw size={14} aria-hidden="true" /> Régénérer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
