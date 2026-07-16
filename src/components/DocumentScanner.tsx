'use client';
import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, X as XIcon, ScanText, FileText, ArrowRight, ChevronDown } from 'lucide-react';
import type { FamilyTree } from '@/types';
import { getDisplayName } from '@/lib/treeUtils';
import { uploadAvatar } from '@/lib/media/uploadImage';
import { useOverlay } from '@/hooks/useOverlay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

/** A row built from the edited OCR fields + the chosen assignment, handed to the parent. */
export interface ImportItem {
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  occupation?: string;
  role: string;
  /** 'new' | 'ignore' | an existing personId */
  assignment: 'new' | 'ignore' | string;
}

interface Props {
  tree: FamilyTree;
  preselectPersonId?: string;
  onClose: () => void;
  /** Parent applies the items to the store + shows toasts; this component just closes after. */
  onImport: (items: ImportItem[]) => void;
}

/** Selectable document types (sent to the API; 'auto' lets the model decide). */
type DocumentType = 'auto' | 'birth' | 'marriage' | 'death' | 'census';

/** One person extracted from the civil record (all fields nullable). */
interface OcrPerson {
  role: string;
  firstName: string | null;
  lastName: string | null;
  gender: 'male' | 'female' | 'unknown' | null;
  birthDate: string | null;
  birthPlace: string | null;
  occupation: string | null;
  notes: string | null;
  /** Set by the server's Bamiléké-name normalization. */
  lastNameOriginal: string | null;
  lastNameIsVariant: boolean;
}

/** Shape returned by POST /api/ocr-document. */
interface OcrResponse {
  type: string;
  documentType: string;
  persons: OcrPerson[];
  acteNumber: string | null;
  commune: string | null;
  date: string | null;
  place: string | null;
  confidence: number | null;
  notes: string | null;
  rawText: string | null;
}

/** Locally-editable copy of a detected person + its assignment target. */
interface EditPerson {
  role: string;
  firstName: string;
  lastName: string;
  /** 'male' | 'female' | 'unknown' — stored loosely so the generic editor stays simple. */
  gender: string;
  birthDate: string;
  birthPlace: string;
  occupation: string;
  /** Written form of the surname when it was normalized to a canonical variant (else null). */
  variantOriginal: string | null;
  /** 'new' | 'ignore' | a personId */
  assignment: string;
}

/** Role options offered in the per-person editor (French civil-registry tokens). */
const ROLE_OPTIONS = ['sujet', 'pere', 'mere', 'epoux', 'epouse', 'temoin'] as const;
const GENDER_OPTIONS = ['male', 'female', 'unknown'] as const;

type ConfidenceLevel = 'high' | 'medium' | 'low';
function confidenceLevel(c: number): ConfidenceLevel {
  return c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low';
}

const MAX_BYTES = 8 * 1024 * 1024;
const ACCENT = 'var(--accent)';

/** Downscale to a bounded JPEG data URL for the OCR request (keeps payload small, text legible). */
function resizeForAnalysis(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type Step = 'upload' | 'scanning' | 'extracted';

export default function DocumentScanner({ tree, preselectPersonId, onClose, onImport }: Props) {
  const t = useTranslations('ocr');
  const overlayRef = useOverlay<HTMLDivElement>(onClose);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [docType, setDocType] = useState<DocumentType>('auto');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [people, setPeople] = useState<EditPerson[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [acteNumber, setActeNumber] = useState('');
  const [commune, setCommune] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [importing, setImporting] = useState(false);

  // Existing tree members, alphabetised, for the assignment dropdowns.
  const members = useMemo(
    () => [...tree.persons].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
    [tree.persons],
  );

  const docTypes: DocumentType[] = ['auto', 'birth', 'marriage', 'death', 'census'];

  const pickFile = useCallback((f: File | undefined | null) => {
    setError('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError(t('notImage')); return; }
    if (f.size > MAX_BYTES) { setError(t('tooLarge')); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, [t]);

  const scan = useCallback(async () => {
    if (!file) return;
    setStep('scanning');
    setError('');
    try {
      const imageBase64 = await resizeForAnalysis(file);
      const res = await fetch('/api/ocr-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64, documentType: docType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data?.error || t('error'));
      }
      const data = await res.json() as OcrResponse;
      const detected = data.persons || [];
      const edits: EditPerson[] = detected.map((p, i) => ({
        role: p.role || 'sujet',
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        gender: p.gender ?? 'unknown',
        birthDate: p.birthDate ?? '',
        birthPlace: p.birthPlace ?? '',
        occupation: p.occupation ?? '',
        variantOriginal: p.lastNameIsVariant ? (p.lastNameOriginal ?? null) : null,
        // First person defaults to the preselected member when opened from a profile.
        assignment: i === 0 && preselectPersonId ? preselectPersonId : 'new',
      }));
      setPeople(edits);
      setConfidence(data.confidence ?? null);
      setActeNumber(data.acteNumber ?? '');
      setCommune(data.commune ?? '');
      setDocNotes(data.notes ?? '');
      setRawText(data.rawText ?? '');
      setStep('extracted');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setStep('upload');
    }
  }, [file, docType, preselectPersonId, t]);

  const updateField = useCallback((index: number, field: keyof EditPerson, value: string) => {
    setPeople(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }, []);

  const runImport = useCallback(async () => {
    setImporting(true);
    try {
      // Persist the source document (best-effort; failure shouldn't block the import).
      if (file) {
        try { await uploadAvatar(file, preselectPersonId || tree.id || 'document'); } catch { /* ignore */ }
      }
      const items: ImportItem[] = people.map(p => ({
        firstName: p.firstName || undefined,
        lastName: p.lastName || undefined,
        gender: p.gender || undefined,
        birthDate: p.birthDate || undefined,
        birthPlace: p.birthPlace || undefined,
        occupation: p.occupation || undefined,
        role: p.role,
        assignment: p.assignment,
      }));
      onImport(items);
      onClose();
    } catch {
      setError(t('error'));
      setImporting(false);
    }
  }, [file, people, preselectPersonId, tree.id, onImport, onClose, t]);

  const roleLabel = useCallback((role: string): string => {
    switch (role) {
      case 'subject': case 'sujet': return t('subject');
      case 'father': case 'pere': return t('father');
      case 'mother': case 'mere': return t('mother');
      case 'parent': return t('parent');
      case 'spouse': return t('spouse');
      case 'epoux': return t('husband');
      case 'epouse': return t('wife');
      case 'witness': case 'temoin': return t('witness');
      default: return t('person');
    }
  }, [t]);

  const genderLabel = useCallback((g: string): string => {
    switch (g) {
      case 'male': return t('genderMale');
      case 'female': return t('genderFemale');
      default: return t('genderUnknown');
    }
  }, [t]);

  return (
    <div className="ds-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('title')} className="ds-modal">
        {/* Header */}
        <div className="ds-head">
          <div>
            <h2 className="serif ds-title"><ScanText size={20} aria-hidden="true" /> {t('title')}</h2>
            <p className="ds-sub">{t('subtitle')}</p>
          </div>
          <button onClick={onClose} aria-label={t('cancel')} className="ds-x"><XIcon size={18} /></button>
        </div>

        <div className="ds-body">
          {/* ---------- STEP 1 — UPLOAD ---------- */}
          {step === 'upload' && (
            <div className="animate-fade-in">
              {!preview ? (
                <div
                  className={`ds-drop${dragOver ? ' ds-drop-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
                >
                  <FileText size={34} aria-hidden="true" style={{ color: 'var(--text-light)' }} />
                  <p className="ds-drop-text">{t('dropZone')}</p>
                  <span className="label" style={{ color: ACCENT }}>{t('choose')}</span>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="ds-preview-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={t('title')} loading="lazy" decoding="async" className="ds-preview-img" />
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />

              <div className="ds-doctype">
                <label htmlFor="ds-doctype-select" className="label ds-field-label">{t('docType')}</label>
                <select
                  id="ds-doctype-select"
                  className="input ds-select"
                  value={docType}
                  onChange={e => setDocType(e.target.value as DocumentType)}
                >
                  {docTypes.map(d => <option key={d} value={d}>{t(d)}</option>)}
                </select>
              </div>

              {preview && (
                <div className="ds-actions ds-actions-end">
                  <button onClick={() => { setFile(null); setPreview(''); }} className="btn btn-secondary btn-sm">{t('back')}</button>
                  <button onClick={scan} className="btn btn-primary"><Sparkles size={16} aria-hidden="true" /> {t('scan')}</button>
                </div>
              )}

              {error && (
                <div style={{ marginTop: '12px' }}>
                  <ErrorMessage message={error} onRetry={file ? scan : undefined} />
                </div>
              )}
            </div>
          )}

          {/* ---------- STEP 2 — SCANNING ---------- */}
          {step === 'scanning' && (
            <div className="animate-fade-in">
              <div className="ds-scan-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={t('title')} loading="lazy" decoding="async" className="ds-preview-img" />
                <div className="ds-scan-line" aria-hidden="true" />
                <div className="ds-scan-grid" aria-hidden="true" />
              </div>
              <div className="ds-scanning">
                <span className="spinner ds-spinner" aria-hidden="true" />
                <div>
                  <p className="ds-scanning-main">{t('scanning')}</p>
                  <p className="ds-scanning-sub label">{t('scanningSub')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ---------- STEP 3 — EXTRACTED ---------- */}
          {step === 'extracted' && (
            <div className="animate-fade-in">
              <div className="ds-result-head">
                <span className="label" style={{ color: ACCENT }}>{t('extracted', { count: people.length })}</span>
                {confidence != null && (
                  <span
                    className={`ds-conf ds-conf-${confidenceLevel(confidence)}`}
                    role="status"
                    aria-label={t('confidence', { value: Math.round(confidence * 100) })}
                  >
                    <span className="ds-conf-dot" aria-hidden="true" />
                    {t(`confidence_${confidenceLevel(confidence)}`)}
                    <span className="mono ds-conf-pct">{Math.round(confidence * 100)}%</span>
                  </span>
                )}
              </div>

              {confidence != null && confidenceLevel(confidence) !== 'high' && (
                <p className="ds-conf-hint">{t('lowConfidenceHint')}</p>
              )}

              {/* Document-level metadata — editable before import. */}
              <div className="ds-doc card">
                <h3 className="serif ds-doc-title">{t('documentInfo')}</h3>
                <div className="ds-grid">
                  <div className="ds-field">
                    <label htmlFor="ds-acte" className="label ds-field-label">{t('acteNumber')}</label>
                    <input id="ds-acte" className="input" value={acteNumber} onChange={e => setActeNumber(e.target.value)} />
                  </div>
                  <div className="ds-field">
                    <label htmlFor="ds-commune" className="label ds-field-label">{t('commune')}</label>
                    <input id="ds-commune" className="input" value={commune} onChange={e => setCommune(e.target.value)} />
                  </div>
                </div>
                {docNotes && <p className="ds-doc-notes">{docNotes}</p>}
              </div>

              {people.length === 0 ? (
                <p className="ds-empty">{t('noPersons')}</p>
              ) : (
                <ul className="ds-list">
                  {people.map((p, i) => (
                    <li key={i} className="card ds-person">
                      <div className="ds-person-head">
                        <span className="serif ds-person-role">{roleLabel(p.role)}</span>
                      </div>

                      <div className="ds-grid">
                        <div className="ds-field">
                          <label htmlFor={`ds-role-${i}`} className="label ds-field-label">{t('role')}</label>
                          <select
                            id={`ds-role-${i}`}
                            className="input ds-select"
                            value={ROLE_OPTIONS.includes(p.role as typeof ROLE_OPTIONS[number]) ? p.role : 'sujet'}
                            onChange={e => updateField(i, 'role', e.target.value)}
                          >
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                          </select>
                        </div>
                        <div className="ds-field">
                          <label htmlFor={`ds-gender-${i}`} className="label ds-field-label">{t('gender')}</label>
                          <select
                            id={`ds-gender-${i}`}
                            className="input ds-select"
                            value={GENDER_OPTIONS.includes(p.gender as typeof GENDER_OPTIONS[number]) ? p.gender : 'unknown'}
                            onChange={e => updateField(i, 'gender', e.target.value)}
                          >
                            {GENDER_OPTIONS.map(g => <option key={g} value={g}>{genderLabel(g)}</option>)}
                          </select>
                        </div>
                        <div className="ds-field">
                          <label htmlFor={`ds-fn-${i}`} className="label ds-field-label">{t('firstName')}</label>
                          <input
                            id={`ds-fn-${i}`}
                            className="input"
                            value={p.firstName}
                            onChange={e => updateField(i, 'firstName', e.target.value)}
                          />
                        </div>
                        <div className="ds-field">
                          <label htmlFor={`ds-ln-${i}`} className="label ds-field-label">{t('lastName')}</label>
                          <input
                            id={`ds-ln-${i}`}
                            className="input"
                            value={p.lastName}
                            onChange={e => updateField(i, 'lastName', e.target.value)}
                            aria-describedby={p.variantOriginal ? `ds-ln-hint-${i}` : undefined}
                          />
                          {p.variantOriginal && p.variantOriginal.toUpperCase() !== p.lastName.trim().toUpperCase() && (
                            <p id={`ds-ln-hint-${i}`} className="ds-variant-hint">
                              {t('variantNote', { original: p.variantOriginal, canonical: p.lastName })}
                            </p>
                          )}
                        </div>
                        <div className="ds-field">
                          <label htmlFor={`ds-bd-${i}`} className="label ds-field-label">{t('birthDate')}</label>
                          <input
                            id={`ds-bd-${i}`}
                            className="input"
                            value={p.birthDate}
                            onChange={e => updateField(i, 'birthDate', e.target.value)}
                          />
                        </div>
                        <div className="ds-field">
                          <label htmlFor={`ds-bp-${i}`} className="label ds-field-label">{t('birthPlace')}</label>
                          <input
                            id={`ds-bp-${i}`}
                            className="input"
                            value={p.birthPlace}
                            onChange={e => updateField(i, 'birthPlace', e.target.value)}
                          />
                        </div>
                        <div className="ds-field ds-field-wide">
                          <label htmlFor={`ds-oc-${i}`} className="label ds-field-label">{t('occupation')}</label>
                          <input
                            id={`ds-oc-${i}`}
                            className="input"
                            value={p.occupation}
                            onChange={e => updateField(i, 'occupation', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="ds-assign">
                        <label htmlFor={`ds-assign-${i}`} className="label ds-field-label">{t('assign')}</label>
                        <select
                          id={`ds-assign-${i}`}
                          aria-label={`${t('assign')} — ${roleLabel(p.role)}`}
                          className="input ds-select"
                          value={p.assignment}
                          onChange={e => updateField(i, 'assignment', e.target.value)}
                        >
                          <option value="new">{t('newPerson')}</option>
                          <option value="ignore">{t('ignore')}</option>
                          {members.length > 0 && (
                            <optgroup label={t('choosePerson')}>
                              {members.map(m => <option key={m.id} value={m.id}>{getDisplayName(m)}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {rawText && (
                <div className="ds-raw">
                  <button
                    type="button"
                    className="ds-raw-toggle label"
                    aria-expanded={showRaw}
                    onClick={() => setShowRaw(s => !s)}
                  >
                    <ChevronDown size={14} aria-hidden="true" style={{ transform: showRaw ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
                    {t('rawText')}
                  </button>
                  {showRaw && (
                    <pre className="mono ds-raw-text" aria-label={t('rawText')}>{rawText}</pre>
                  )}
                </div>
              )}

              <div className="ds-actions ds-actions-end">
                <button onClick={() => { setStep('upload'); setPeople([]); setRawText(''); setShowRaw(false); setActeNumber(''); setCommune(''); setDocNotes(''); }} className="btn btn-ghost btn-sm">{t('back')}</button>
                <button onClick={runImport} disabled={importing || people.length === 0} className="btn btn-primary" style={{ opacity: importing ? 0.7 : undefined }}>
                  {importing ? <LoadingSpinner size={16} /> : <ArrowRight size={16} aria-hidden="true" />} {t('import')}
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{DS_CSS}</style>
      </div>
    </div>
  );
}

const DS_CSS = `
.ds-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: var(--scrim, rgba(27,22,18,0.55)); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px 40px; overflow-y: auto; }
.ds-modal { position: relative; width: 100%; max-width: 680px; background: var(--bg-card); border: var(--bw) solid var(--border-strong); box-shadow: var(--shadow-xl); border-radius: var(--radius-xl); }
.ds-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: var(--bw) solid var(--border-strong); }
.ds-title { margin: 0 0 3px; font-size: 1.3rem; display: flex; align-items: center; gap: 9px; }
.ds-title svg { color: var(--accent); }
.ds-sub { margin: 0; font-size: 13px; color: var(--text-muted); }
.ds-x { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; flex-shrink: 0; transition: background 200ms ease, color 200ms ease; }
.ds-x:hover { background: var(--interactive); color: var(--text); }
.ds-body { padding: 20px 22px 24px; max-height: 72vh; overflow-y: auto; }

.ds-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; min-height: 220px; padding: 32px; border: 2px dashed var(--border-strong); border-radius: var(--radius); background: var(--bg-muted); cursor: pointer; transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
.ds-drop:hover, .ds-drop-over { border-color: var(--accent); background: var(--accent-light); transform: translate(-2px,-2px); box-shadow: var(--shadow); }
.ds-drop-text { margin: 0; font-size: 14px; color: var(--text); max-width: 280px; }

.ds-preview-wrap, .ds-scan-wrap { position: relative; border: var(--bw) solid var(--border-strong); border-radius: var(--radius); overflow: hidden; background: var(--bg-muted); max-height: 50vh; }
.ds-preview-img { display: block; width: 100%; height: auto; }

.ds-doctype { margin-top: 16px; }
.ds-field-label { display: block; margin: 0 0 5px; color: var(--text-muted); }
.ds-select { width: 100%; }

.ds-actions { display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
.ds-actions-end { justify-content: space-between; }
.ds-error { margin: 12px 0 0; font-size: 13px; font-weight: 600; color: var(--danger); }

/* Scan animation — thin accent band sweeping top→bottom via transform. */
.ds-scan-line { position: absolute; left: 0; right: 0; top: 0; height: 100%; pointer-events: none; will-change: transform;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--accent) 55%, transparent) 0, var(--accent) 2px, color-mix(in srgb, var(--accent) 35%, transparent) 5px, transparent 9px);
  animation: dsScan 1.8s cubic-bezier(0.45,0,0.55,1) infinite; }
.ds-scan-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px); background-size: 28px 28px; opacity: 0.12; pointer-events: none; }
@keyframes dsScan { from { transform: translateY(0); } to { transform: translateY(100%); } }
@media (prefers-reduced-motion: reduce) {
  .ds-scan-line { display: none; }
  .ds-scan-grid { opacity: 0.3; animation: none; }
}
.ds-scanning { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
.ds-spinner { width: 22px; height: 22px; border-width: 3px; border-color: var(--accent); border-right-color: transparent; flex-shrink: 0; }
.ds-scanning-main { margin: 0; font-weight: 700; font-size: 15px; }
.ds-scanning-sub { margin: 3px 0 0; color: var(--text-muted); }

/* Extracted */
.ds-result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.ds-empty { margin: 16px 0; font-size: 14px; color: var(--text-muted); text-align: center; }

/* Confidence badge */
.ds-conf { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border: var(--bw) solid; border-radius: var(--radius-full); }
.ds-conf-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ds-conf-pct { font-weight: 600; letter-spacing: 0; text-transform: none; opacity: 0.85; }
.ds-conf-high { color: #4a9d6e; border-color: #4a9d6e; background: rgba(74,157,110,0.10); }
.ds-conf-high .ds-conf-dot { background: #4a9d6e; }
.ds-conf-medium { color: var(--accent); border-color: var(--accent); background: var(--accent-light, rgba(201,168,76,0.10)); }
.ds-conf-medium .ds-conf-dot { background: var(--accent); }
.ds-conf-low { color: #c96a4a; border-color: #c96a4a; background: rgba(201,106,74,0.10); }
.ds-conf-low .ds-conf-dot { background: #c96a4a; }
.ds-conf-hint { margin: 0 0 14px; font-size: 12.5px; color: var(--text-muted); }

/* Document-level metadata */
.ds-doc { padding: 14px 16px; margin-bottom: 14px; }
.ds-doc-title { margin: 0 0 12px; font-size: 0.98rem; color: var(--text-muted); }
.ds-doc-notes { margin: 12px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); font-style: italic; }

.ds-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.ds-person { padding: 16px; }
.ds-person-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 12px; }
.ds-person-role { font-size: 1.05rem; color: var(--accent); }
.ds-variant-hint { margin: 5px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--accent); }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ds-field { min-width: 0; }
.ds-field-wide { grid-column: 1 / -1; }
.ds-assign { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border-strong); }
@media (max-width: 480px) { .ds-grid { grid-template-columns: 1fr; } }

/* Raw transcription */
.ds-raw { margin-top: 16px; }
.ds-raw-toggle { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 10px 0; min-height: 44px; }
.ds-raw-toggle:hover { color: var(--accent); }
.ds-raw-text { margin: 8px 0 0; padding: 12px; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-strong); background: var(--bg-muted); color: var(--text-muted); border-radius: var(--radius); }
.ds-modal .btn-primary svg.animate-spin { color: var(--ink-on-accent) !important; }
`;
