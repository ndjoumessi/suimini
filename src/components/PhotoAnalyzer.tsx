'use client';
import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Upload, X as XIcon, ScanFace, ImageIcon, Check, ArrowRight } from 'lucide-react';
import ReactCrop, { convertToPixelCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { FamilyTree, Gender } from '@/types';
import { getDisplayName } from '@/lib/treeUtils';
import { uploadAvatar } from '@/lib/uploadImage';
import { cropToFile, isFullFrameCrop } from '@/lib/imageCrop';
import { useOverlay } from '@/hooks/useOverlay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PersonCombobox } from '@/components/ui/PersonCombobox';

/** One detected face plus the user's assignment. */
export interface FaceAssignment {
  faceId: number;
  /** personId | 'unknown' | 'new' */
  value: string;
  gender: Gender;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number | null;
}

interface DetectedFace {
  id: number;
  x: number; y: number; width: number; height: number;
  estimatedAge: string;
  gender: string;
  description: string;
}

interface Props {
  tree: FamilyTree;
  preselectPersonId?: string;
  onClose: () => void;
  /** Persist the photo + tags. Receives the stored URL and the per-face assignments. */
  onConfirm: (photoUrl: string, assignments: FaceAssignment[]) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

const ACCENT = 'var(--accent)';

/** Overlays a 10%-spaced coordinate grid (magenta lines + edge percentage labels) on the
 *  analysis image. Claude's own free-eyeballed bounding-box percentages are unreliable on
 *  cluttered photos (a real face got placed over background foliage in testing) — a labelled
 *  grid gives the model concrete tick marks to read the face edges off instead of guessing,
 *  the standard grounding aid for VLM spatial-coordinate tasks. Never shown to the user: `preview`
 *  (possibly the user's cropped framing, but never grid-marked) is the only thing rendered in the
 *  UI — this canvas only feeds the API. */
function drawAnalysisGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const STEP = 10;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 200, 0.5)';
  ctx.lineWidth = 1;
  for (let pct = STEP; pct < 100; pct += STEP) {
    const x = (pct / 100) * w;
    const y = (pct / 100) * h;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.font = 'bold 13px monospace';
  const chip = (text: string, x: number, y: number) => {
    const tw = ctx.measureText(text).width;
    const cx = Math.max(0, Math.min(x, w - tw - 4));
    const cy = Math.max(0, Math.min(y, h - 16));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx, cy, tw + 4, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, cx + 2, cy + 13);
  };
  for (let pct = 0; pct <= 100; pct += STEP) {
    chip(String(pct), (pct / 100) * w, 0); // top edge = x%
    chip(String(pct), 0, (pct / 100) * h - 8); // left edge = y%
  }
  ctx.restore();
}

/** Downscale to a bounded JPEG data URL for the vision request (keeps payload small, faces
 *  legible), with the reference grid burned in — see `drawAnalysisGrid`. */
function resizeForAnalysis(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
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
        drawAnalysisGrid(ctx, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function mapGender(g: string): Gender {
  return g === 'male' ? 'male' : g === 'female' ? 'female' : 'unknown';
}

type Step = 'upload' | 'analyzing' | 'results';

export default function PhotoAnalyzer({ tree, preselectPersonId, onClose, onConfirm }: Props) {
  const t = useTranslations('photoAnalyzer');
  const overlayRef = useOverlay<HTMLDivElement>(onClose);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  // Free-form crop (no forced aspect — unlike GalleryView's 1:1 avatar crop, a family
  // photo can hold any number of faces in any composition). Defaults to the full frame
  // on load (see `onPreviewImageLoad`), so anyone who doesn't touch it gets the exact
  // previous behaviour (whole photo analyzed, original file uploaded untouched).
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  const people = useMemo(
    () => [...tree.persons].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
    [tree.persons],
  );

  // Two fixed, non-person entries pinned above the tree members in each face's
  // picker (was previously an <optgroup>-less pair of <option>s before the
  // native <select>'s "Membres de l'arbre" optgroup).
  const faceExtraOptions = useMemo(
    () => [{ id: 'unknown', label: t('unknown') }, { id: 'new', label: t('newMember') }],
    [t],
  );

  const pickFile = useCallback((f: File | undefined | null) => {
    setError('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError(t('notImage')); return; }
    if (f.size > MAX_BYTES) { setError(t('tooLarge')); return; }
    setFile(f);
    setCrop(undefined);
    setCompletedCrop(undefined);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, [t]);

  // Seed a full-frame crop once the image's rendered dimensions are known — the crop
  // starts as a no-op (whole photo selected) and the user narrows it from there.
  const onPreviewImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const full: Crop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    setCrop(full);
    setCompletedCrop(convertToPixelCrop(full, width, height));
  }, []);

  const analyze = useCallback(async () => {
    if (!file) return;
    setStep('analyzing');
    setError('');
    try {
      // Apply the user's crop (if they narrowed it past the full-frame default) before
      // analyzing — the cropped image becomes BOTH what's analyzed and what's finally
      // saved/tagged in `confirm()`, so the face-box overlays (percentages relative to
      // whatever was analyzed) always line up with what's shown afterwards.
      let effectiveFile = file;
      if (imgRef.current && completedCrop?.width && completedCrop.height
          && !isFullFrameCrop(completedCrop, imgRef.current.width, imgRef.current.height)) {
        const cropped = await cropToFile(imgRef.current, completedCrop, file.name);
        if (cropped) {
          effectiveFile = cropped;
          setFile(cropped);
          const reader = new FileReader();
          reader.onload = () => setPreview(reader.result as string);
          reader.readAsDataURL(cropped);
        }
      }
      const imageBase64 = await resizeForAnalysis(effectiveFile);
      const res = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || t('error'));
      }
      const data = await res.json() as { faces: DetectedFace[]; confidence: number | null; photoDescription?: string };
      const detected = data.faces || [];
      setFaces(detected);
      setConfidence(data.confidence ?? null);
      setPhotoDescription(data.photoDescription || '');
      // Pre-assign to the current person ONLY when there's exactly one detected
      // face — an unambiguous solo portrait (the common case when opened from a
      // profile, or from a gallery filtered/limited to a single person). On a
      // group photo, "face #1" is just whichever face Claude happened to list
      // first (no relation to the preselected person) — auto-assigning it would
      // create a WRONG family-tree association that's easy to miss and confirm
      // by accident. Multiple faces always start on "unknown".
      const init: Record<number, string> = {};
      const soleFace = detected.length === 1 ? detected[0] : null;
      detected.forEach((f) => { init[f.id] = f === soleFace && preselectPersonId ? preselectPersonId : 'unknown'; });
      setAssignments(init);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setStep('upload');
    }
  }, [file, completedCrop, preselectPersonId, t]);

  const confirm = useCallback(async () => {
    if (!file) return;
    setSaving(true);
    try {
      const tagged = faces.filter(f => assignments[f.id] && assignments[f.id] !== 'unknown');
      const { url } = await uploadAvatar(file, preselectPersonId || tree.id || 'photo');
      const result: FaceAssignment[] = tagged.map(f => ({
        faceId: f.id,
        value: assignments[f.id],
        gender: mapGender(f.gender),
        boundingBox: { x: f.x, y: f.y, width: f.width, height: f.height },
        confidence,
      }));
      onConfirm(url, result);
      onClose();
    } catch {
      setError(t('error'));
      setSaving(false);
    }
  }, [file, faces, assignments, confidence, preselectPersonId, tree.id, onConfirm, onClose, t]);

  const ageLabel = (a: string) => t(a === 'child' ? 'ageChild' : a === 'young' ? 'ageYoung' : a === 'senior' ? 'ageSenior' : 'ageAdult');
  const genderLabel = (g: string) => t(g === 'male' ? 'genderMale' : g === 'female' ? 'genderFemale' : 'genderUnknown');

  const taggedCount = useMemo(
    () => new Set(faces.filter(f => assignments[f.id] && assignments[f.id] !== 'unknown').map(f => assignments[f.id])).size,
    [faces, assignments],
  );

  return (
    <div className="pa-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('title')} className="pa-modal">
        {/* Header */}
        <div className="pa-head">
          <div>
            <h2 className="serif pa-title"><ScanFace size={20} aria-hidden="true" /> {t('title')}</h2>
            <p className="pa-sub">{t('subtitle')}</p>
          </div>
          <button onClick={onClose} aria-label={t('cancel')} className="pa-x"><XIcon size={18} /></button>
        </div>

        <div className="pa-body">
          {/* ---------- STEP 1 — UPLOAD ---------- */}
          {step === 'upload' && (
            <div className="animate-fade-in">
              {!preview ? (
                <div
                  className={`pa-drop${dragOver ? ' pa-drop-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
                >
                  <ImageIcon size={34} aria-hidden="true" style={{ color: 'var(--text-light)' }} />
                  <p className="pa-drop-text">{t('dropZone')}</p>
                  <span className="label" style={{ color: ACCENT }}>{t('choosePhoto')}</span>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percent) => setCrop(percent)}
                    onComplete={c => setCompletedCrop(c)}
                    keepSelection
                    className="pa-reactcrop"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img ref={imgRef} src={preview} alt={t('photoAlt')} onLoad={onPreviewImageLoad} className="pa-preview-img" />
                  </ReactCrop>
                  <p className="pa-cropinstr">{t('cropInstruction')}</p>
                  <div className="pa-actions">
                    <button onClick={() => { setFile(null); setPreview(''); setCrop(undefined); setCompletedCrop(undefined); }} className="btn btn-secondary btn-sm">{t('changePhoto')}</button>
                    <button onClick={analyze} className="btn btn-primary"><Sparkles size={16} aria-hidden="true" /> {t('analyzeButton')}</button>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              {error && (
                <div style={{ marginTop: '12px' }}>
                  <ErrorMessage message={error} onRetry={file ? analyze : undefined} />
                </div>
              )}
            </div>
          )}

          {/* ---------- STEP 2 — ANALYZING ---------- */}
          {step === 'analyzing' && (
            <div className="animate-fade-in">
              <div className="pa-scan-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={t('photoAlt')} className="pa-preview-img" />
                <div className="pa-scan-line" aria-hidden="true" />
                <div className="pa-scan-grid" aria-hidden="true" />
              </div>
              <div className="pa-analyzing">
                <span className="spinner pa-spinner" aria-hidden="true" />
                <div>
                  <p className="pa-analyzing-main">{t('analyzing')}</p>
                  <p className="pa-analyzing-sub label">{t('analyzingSub')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ---------- STEP 3 — RESULTS ---------- */}
          {step === 'results' && (
            <div className="animate-fade-in">
              <div className="pa-result-head">
                <span className="label" style={{ color: ACCENT }}>{t('facesFound', { count: faces.length })}</span>
                {confidence != null && <span className="label" style={{ color: 'var(--text-muted)' }}>{t('confidence', { value: Math.round(confidence * 100) })}</span>}
              </div>
              {faces.length > 0 && <p className="pa-identify-hint">{t('identifyHint')}</p>}

              <div className="pa-canvas-scroll">
                <div className="pa-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={photoDescription || t('photoAlt')} className="pa-preview-img" />
                  {faces.map((f, i) => (
                    <div
                      key={f.id}
                      className="pa-face"
                      style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.width}%`, height: `${f.height}%` }}
                    >
                      <span className="pa-face-tag">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {faces.length === 0 ? (
                <p className="pa-empty">{t('noFaces')}</p>
              ) : (
                <ul className="pa-list">
                  {faces.map((f, i) => (
                    <li key={f.id} className="pa-row">
                      <span className="pa-row-num">{i + 1}</span>
                      <div className="pa-row-info">
                        <div className="pa-row-badges">
                          <span className="pa-badge">{ageLabel(f.estimatedAge)}</span>
                          <span className="pa-badge pa-badge-g">{genderLabel(f.gender)}</span>
                        </div>
                        {f.description && <p className="pa-row-desc">{f.description}</p>}
                        <label htmlFor={`pa-face-select-${f.id}`} className="pa-assign-label label">{t('assignPerson')} #{i + 1}</label>
                        <PersonCombobox
                          id={`pa-face-select-${f.id}`}
                          persons={people}
                          selectedId={assignments[f.id] ?? 'unknown'}
                          onSelect={val => setAssignments(a => ({ ...a, [f.id]: val }))}
                          placeholder={t('searchPlaceholder')}
                          ariaLabel={`${t('assignPerson')} ${f.description || i + 1}`}
                          emptySearchLabel={t('noPersonFound')}
                          extraOptions={faceExtraOptions}
                          className="pa-select"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pa-actions pa-actions-end">
                <button onClick={() => { setStep('upload'); setFaces([]); }} className="btn btn-ghost btn-sm">{t('back')}</button>
                <button onClick={confirm} disabled={saving || taggedCount === 0} className="btn btn-primary" style={{ opacity: saving ? 0.7 : undefined }}>
                  {saving ? <LoadingSpinner size={16} /> : <Check size={16} aria-hidden="true" />} {t('confirm')}
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{PA_CSS}</style>
      </div>
    </div>
  );
}

const PA_CSS = `
.pa-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: var(--scrim, rgba(27,22,18,0.55)); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px 40px; overflow-y: auto; }
.pa-modal { position: relative; width: 100%; max-width: 680px; background: var(--bg-card); border: var(--bw) solid var(--border-strong); box-shadow: var(--shadow-xl); border-radius: var(--radius-xl); }
.pa-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: var(--bw) solid var(--border-strong); }
.pa-title { margin: 0 0 3px; font-size: 1.3rem; display: flex; align-items: center; gap: 9px; }
.pa-title svg { color: var(--accent); }
.pa-sub { margin: 0; font-size: 13px; color: var(--text-muted); }
.pa-x { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; flex-shrink: 0; transition: background 200ms ease, color 200ms ease; }
.pa-x:hover { background: var(--interactive); color: var(--text); }
.pa-body { padding: 20px 22px 24px; max-height: 72vh; overflow-y: auto; }

.pa-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; min-height: 240px; padding: 32px; border: 2px dashed var(--border-strong); border-radius: var(--radius); background: var(--bg-muted); cursor: pointer; transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
.pa-drop:hover, .pa-drop-over { border-color: var(--accent); background: var(--accent-light); transform: translate(-2px,-2px); box-shadow: var(--shadow); }
.pa-drop-text { margin: 0; font-size: 14px; color: var(--text); max-width: 280px; }

.pa-scan-wrap, .pa-canvas-scroll { position: relative; border: var(--bw) solid var(--border-strong); border-radius: var(--radius); overflow: auto; background: var(--bg-muted); max-height: 60vh; }
/* The canvas sizes itself to the rendered image so face overlays map 1:1 (no object-fit letterbox). */
.pa-canvas { position: relative; line-height: 0; }
.pa-preview-img { display: block; width: 100%; height: auto; }

/* Crop UI (step 1 only) — free-form, no forced aspect (unlike GalleryView's 1:1 avatar
   crop): a family photo can hold any composition/number of faces. Same gold-handle theming. */
.pa-reactcrop { display: block; width: 100%; background: var(--ink-on-accent); border: var(--bw) solid var(--border-strong); border-radius: var(--radius);
  --rc-drag-handle-size: 14px; --rc-drag-handle-bg-colour: var(--accent); --rc-border-color: var(--accent); --rc-focus-color: var(--accent); }
.pa-reactcrop .ReactCrop__child-wrapper { max-height: 60vh; overflow: hidden; }
/* width:auto (NOT 100%) is the point: a forced 100% width on a portrait photo computes a
   height that overflows 60vh, and the wrapper's overflow:hidden silently clips the bottom of
   the photo before the user ever gets to adjust anything — the exact bug being fixed here.
   max-width + max-height with auto width/height instead shrinks the image to fit BOTH bounds
   (no forced box for object-fit to act on, so it's not used — this is the plain "letterbox,
   never crop" sizing that a forced width defeats). */
.pa-reactcrop img.pa-preview-img { display: block; width: auto; height: auto; max-width: 100%; max-height: 60vh; margin: 0 auto; }
.pa-reactcrop .ReactCrop__crop-selection { box-shadow: 0 0 0 9999px rgba(13,13,13,0.64); }
.pa-reactcrop .ReactCrop__drag-handle { background-color: var(--accent); border-color: var(--ink-on-accent); }
.pa-cropinstr { margin: 8px 0 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em; color: var(--text-muted); }
@media (prefers-reduced-motion: reduce) {
  .pa-reactcrop .ReactCrop__crop-selection { animation: none; }
}
.pa-actions { display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
.pa-actions-end { justify-content: space-between; }
.pa-error { margin: 12px 0 0; font-size: 13px; font-weight: 600; color: var(--danger); }

/* Scan animation */
/* Full-height element with a thin accent band at its top; translateY sweeps it the
   full container height (transform, not the layout 'top' property). */
.pa-scan-line { position: absolute; left: 0; right: 0; top: 0; height: 100%; pointer-events: none; will-change: transform;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--accent) 55%, transparent) 0, var(--accent) 2px, color-mix(in srgb, var(--accent) 35%, transparent) 5px, transparent 9px);
  animation: paScan 1.8s cubic-bezier(0.45,0,0.55,1) infinite; }
.pa-scan-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px); background-size: 28px 28px; opacity: 0.12; pointer-events: none; }
@keyframes paScan { from { transform: translateY(0); } to { transform: translateY(100%); } }
@media (prefers-reduced-motion: reduce) {
  .pa-scan-line { display: none; }
  .pa-scan-grid { opacity: 0.3; animation: none; }
}
.pa-analyzing { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
.pa-spinner { width: 22px; height: 22px; border-width: 3px; border-color: var(--accent); border-right-color: transparent; flex-shrink: 0; }
.pa-analyzing-main { margin: 0; font-weight: 700; font-size: 15px; }
.pa-analyzing-sub { margin: 3px 0 0; color: var(--text-muted); }

/* Result face frames */
.pa-result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.pa-identify-hint { margin: -6px 0 12px; font-size: 12px; line-height: 1.5; color: var(--text-muted); }
.pa-face { position: absolute; border: 2px solid var(--accent); box-shadow: 0 0 0 1.5px rgba(0,0,0,0.45); border-radius: 0; pointer-events: none; }
.pa-face-tag { position: absolute; top: -11px; left: -2px; min-width: 20px; height: 20px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: var(--ink-on-accent); font-family: var(--font-mono); font-size: 11px; font-weight: 700; border: 1.5px solid var(--ink); border-radius: var(--radius-sm); }
.pa-empty { margin: 16px 0 0; font-size: 14px; color: var(--text-muted); text-align: center; }

.pa-list { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.pa-row { display: flex; gap: 12px; padding: 12px; border: var(--bw) solid var(--border-strong); border-radius: var(--radius); background: var(--bg-card); }
.pa-row-num { flex-shrink: 0; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: var(--ink-on-accent); font-family: var(--font-mono); font-weight: 700; font-size: 12px; border: 1.5px solid var(--ink); border-radius: var(--radius-sm); }
.pa-row-info { flex: 1; min-width: 0; }
.pa-row-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.pa-badge { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; font-weight: 700; padding: 2px 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-full); background: var(--bg-muted); color: var(--text); }
.pa-badge-g { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.pa-row-desc { margin: 7px 0 0; font-size: 13px; color: var(--text-muted); }
.pa-assign-label { display: block; margin: 10px 0 5px; color: var(--text-muted); }
.pa-select { width: 100%; }
.pa-modal .btn-primary svg.animate-spin { color: var(--ink-on-accent) !important; }
`;
