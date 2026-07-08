'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { ScrollText, Copy, Download, RefreshCw, X, Check, Search } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useOverlay } from '@/hooks/useOverlay';
import { getDisplayName, normalizeText } from '@/lib/treeUtils';
import {
  buildGenerationMembers,
  buildBranchMembers,
  generationValues,
  narrativeCacheKey,
  narrativeSignature,
  type NarrativeMode,
} from '@/lib/narrativeContext';

type State = 'idle' | 'loading' | 'result' | 'error';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

interface CacheEntry { text: string; signature: string; ts: number }

function cacheStorageKey(treeId: string, keySuffix: string): string {
  return `suimini_narrative_${treeId}_${keySuffix}`;
}
function readCache(treeId: string, keySuffix: string, signature: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheStorageKey(treeId, keySuffix));
    if (!raw) return null;
    const obj = JSON.parse(raw) as CacheEntry;
    if (obj.signature !== signature) return null;      // membres modifiés → invalide
    if (Date.now() - obj.ts > CACHE_TTL) return null;  // périmé (> 24 h)
    return typeof obj.text === 'string' ? obj.text : null;
  } catch { return null; }
}
function writeCache(treeId: string, keySuffix: string, text: string, signature: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheStorageKey(treeId, keySuffix), JSON.stringify({ text, signature, ts: Date.now() }));
  } catch { /* quota / private mode : le cache est best-effort */ }
}

export default function NarrativeModal({ tree, onClose }: { tree: FamilyTree; onClose: () => void }) {
  const t = useTranslations('narrative');
  const locale = useLocale() === 'en' ? 'en' : 'fr';

  const [mode, setMode] = useState<NarrativeMode>('full');
  const [gen, setGen] = useState<number | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState('');

  const [state, setState] = useState<State>('idle');
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // useOverlay = trap Tab + Esc + scroll-lock + restauration du focus.
  const dialogRef = useOverlay<HTMLDivElement>(onClose);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const genValues = useMemo(() => generationValues(tree), [tree]);
  const defaultRoot = useMemo(() => {
    if (tree.rootPersonId && tree.persons.some(p => p.id === tree.rootPersonId)) return tree.rootPersonId;
    return tree.persons[0]?.id ?? null;
  }, [tree]);

  const branchResults = useMemo(() => {
    const q = normalizeText(branchQuery);
    const list = q
      ? tree.persons.filter(p => normalizeText(getDisplayName(p)).includes(q))
      : tree.persons;
    return list.slice(0, 60);
  }, [tree.persons, branchQuery]);

  const rootPerson: Person | undefined = useMemo(
    () => tree.persons.find(p => p.id === rootId),
    [tree.persons, rootId],
  );

  const generate = useCallback(async (opts?: { force?: boolean }) => {
    let members: Person[];
    let keySuffix: string;

    if (mode === 'generation') {
      if (gen == null) return;
      members = buildGenerationMembers(tree, gen);
      keySuffix = narrativeCacheKey('generation', gen);
      if (members.length === 0) { setError(t('emptyGeneration')); setState('error'); return; }
    } else if (mode === 'branch') {
      if (!rootId) return;
      const branch = buildBranchMembers(tree, rootId);
      if (!branch) return;
      members = branch.members;
      keySuffix = narrativeCacheKey('branch', undefined, rootId);
    } else {
      members = tree.persons;
      keySuffix = narrativeCacheKey('full');
    }

    const signature = narrativeSignature(members);
    if (!opts?.force) {
      const cached = readCache(tree.id, keySuffix, signature);
      if (cached) { setNarrative(cached); setState('result'); setCopied(false); return; }
    }

    setState('loading');
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tree,
          mode,
          generation: mode === 'generation' ? gen : undefined,
          rootPersonId: mode === 'branch' ? rootId : undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('errStatus', { status: res.status }));
        setState('error');
        return;
      }
      const text = data.narrative || '';
      setNarrative(text);
      setState('result');
      writeCache(tree.id, keySuffix, text, signature);
    } catch {
      setError(t('errNetwork'));
      setState('error');
    }
  }, [tree, mode, gen, rootId, locale, t]);

  // (Re)génère sur ouverture ET à chaque changement de mode / génération / branche.
  useEffect(() => { generate(); }, [generate]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const onModeChange = useCallback((next: NarrativeMode) => {
    if (next === 'generation' && gen == null) setGen(genValues[0] ?? 0);
    if (next === 'branch' && rootId == null) setRootId(defaultRoot);
    setMode(next);
  }, [gen, rootId, genValues, defaultRoot]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }, [narrative]);

  const download = useCallback(() => {
    const base = (tree.name || 'famille').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const suffix = mode === 'generation' ? `-generation-${gen}` : mode === 'branch' && rootPerson ? `-branche-${normalizeText(getDisplayName(rootPerson)).replace(/\s+/g, '-')}` : '';
    const blob = new Blob([narrative], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suimini-recit-${base || 'famille'}${suffix}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [narrative, tree.name, mode, gen, rootPerson]);

  // Sous-titre selon le mode.
  const subtitle =
    mode === 'generation' ? t('headingGeneration', { n: gen ?? 0 })
    : mode === 'branch' && rootPerson ? t('headingBranch', { name: getDisplayName(rootPerson) })
    : t('subtitle', { name: tree.name });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal" style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('title')} aria-busy={state === 'loading'}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <ScrollText size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.25rem' }}>{t('title')}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={t('close')}><X size={18} aria-hidden="true" /></button>
        </div>

        {/* Contrôles : mode + cible (génération / branche) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
            <span className="label">{t('modeLabel')}</span>
            <select className="input" value={mode} onChange={(e) => onModeChange(e.target.value as NarrativeMode)}>
              <option value="full">{t('modeFull')}</option>
              <option value="generation">{t('modeGeneration')}</option>
              <option value="branch">{t('modeBranch')}</option>
            </select>
          </label>

          {mode === 'generation' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
              <span className="label">{t('generationLabel')}</span>
              <select className="input" value={gen ?? ''} onChange={(e) => setGen(Number(e.target.value))}>
                {genValues.map((g) => (
                  <option key={g} value={g}>{t('generationOption', { n: g, count: buildGenerationMembers(tree, g).length })}</option>
                ))}
              </select>
            </label>
          )}

          {mode === 'branch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
              <span className="label">{t('branchLabel')}</span>
              <div style={{ position: 'relative' }}>
                <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: '30px' }}
                  type="text"
                  value={branchQuery}
                  onChange={(e) => setBranchQuery(e.target.value)}
                  placeholder={t('branchSearch')}
                  aria-label={t('branchSearch')}
                />
              </div>
              <div role="listbox" aria-label={t('branchLabel')} style={{ maxHeight: '148px', overflowY: 'auto', border: '1px solid var(--border)', marginTop: '2px' }}>
                {branchResults.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>{t('branchNoMatch')}</div>
                )}
                {branchResults.map((p) => {
                  const selected = p.id === rootId;
                  return (
                    <button
                      key={p.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => setRootId(p.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                        fontSize: '14px', cursor: 'pointer', border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: selected ? 'var(--accent)' : 'transparent',
                        color: selected ? '#111118' : 'var(--text)',
                      }}
                    >
                      {getDisplayName(p) || t('noName')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
              <ErrorMessage message={error || t('errGenerate')} onRetry={() => generate({ force: true })} />
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
            <button onClick={() => generate({ force: true })} className="btn btn-ghost btn-sm" style={{ gap: '6px', marginLeft: 'auto' }}>
              <RefreshCw size={14} aria-hidden="true" /> {t('regenerate')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
