'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3, ImagePlus, X, Plus, ScanFace, UploadCloud } from 'lucide-react';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';
import { uploadAvatar } from '@/lib/uploadImage';
import { GENDER_BAR } from '../tree/nodeStyle';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  /** Open the AI face-recognition analyzer. */
  onAnalyzePhoto?: () => void;
}

interface PhotoItem {
  url: string;
  person: Person;
  isProfile: boolean;
}

function genderDot(p: Person): string {
  return p.gender === 'male' ? GENDER_BAR.male : p.gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
}

function lifeLine(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (!p.isAlive) return b && d ? `${b} – ${d}` : d ? `† ${d}` : b ? `${b} – ?` : '';
  return b || '';
}

export default function GalleryView({ tree, onSelectPerson, onUpdatePerson, onAnalyzePhoto }: Props) {
  const t = useTranslations('gallery');
  const tp = useTranslations('photoAnalyzer');
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const [filterPersonId, setFilterPersonId] = useState<string>('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  // Upload modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addPersonId, setAddPersonId] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAdd = !!onUpdatePerson && tree.persons.length > 0;

  const openModal = () => { setAddPersonId(''); setPendingFile(null); setPreviewUrl(''); setDragOver(false); setShowAdd(true); };
  const closeModal = () => { setShowAdd(false); setPendingFile(null); setPreviewUrl(''); };

  // Esc closes the modal / lightbox.
  useEffect(() => {
    if (!showAdd && !selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeModal(); setSelected(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdd, selected]);

  // Revoke object URLs to avoid leaks.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!pendingFile || !addPersonId || !onUpdatePerson) return;
    setUploading(true);
    try {
      const res = await uploadAvatar(pendingFile, addPersonId);
      const person = tree.persons.find(p => p.id === addPersonId);
      onUpdatePerson(addPersonId, { photos: [...(person?.photos || []), res.url] });
      closeModal();
      setFilterPersonId('');
    } catch { /* uploadAvatar already falls back to a data URL; only a hard failure lands here */ }
    finally { setUploading(false); }
  };

  const photos = useMemo<PhotoItem[]>(() => {
    const items: PhotoItem[] = [];
    tree.persons.forEach(person => {
      if (person.profilePhoto) items.push({ url: person.profilePhoto, person, isProfile: true });
      (person.photos || []).forEach(url => items.push({ url, person, isProfile: false }));
    });
    return filterPersonId ? items.filter(i => i.person.id === filterPersonId) : items;
  }, [tree, filterPersonId]);

  const personsWithPhotos = useMemo(
    () => tree.persons.filter(p => p.profilePhoto || (p.photos && p.photos.length > 0)),
    [tree],
  );

  const FALLBACK_IMG = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='160' height='120' fill='%231a1a24'/><g transform='translate(60,40) scale(1.7)' fill='none' stroke='%236c6c82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/><circle cx='12' cy='13' r='3'/></g></svg>";

  return (
    <div className="gv-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar — only when there are photos (empty state carries its own CTA) */}
      {photos.length > 0 && (
        <div className="gv-toolbar">
          <span className="gv-count">{t('photoCount', { count: photos.length })}</span>
          <div className="gv-toolbar-controls">
            <select
              value={filterPersonId}
              onChange={e => setFilterPersonId(e.target.value)}
              className="gv-select"
              aria-label={t('filterByPersonLabel')}
            >
              <option value="">{t('allPeople')}</option>
              {personsWithPhotos.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
            </select>
            <div className="gv-viewtoggle" role="group" aria-label={t('layoutGrid')}>
              <button onClick={() => setLayout('grid')} aria-pressed={layout === 'grid'} aria-label={t('layoutGrid')} title={t('layoutGrid')} className={layout === 'grid' ? 'on' : ''}><LayoutGrid size={15} aria-hidden="true" /></button>
              <button onClick={() => setLayout('list')} aria-pressed={layout === 'list'} aria-label={t('layoutMasonry')} title={t('layoutMasonry')} className={layout === 'list' ? 'on' : ''}><Rows3 size={15} aria-hidden="true" /></button>
            </div>
            {onAnalyzePhoto && (
              <button onClick={onAnalyzePhoto} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
                <ScanFace size={14} aria-hidden="true" /> {tp('galleryButton')}
              </button>
            )}
            {canAdd && (
              <button onClick={openModal} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                <Plus size={14} aria-hidden="true" /> {t('addPhoto')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="gv-body">
        {photos.length === 0 ? (
          <div className="gv-empty">
            <ImagePlus size={48} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--accent)' }} />
            <h2 className="serif gv-empty-title">{filterPersonId ? t('emptyFilteredTitle') : t('galleryTitle')}</h2>
            <p className="gv-empty-sub">{filterPersonId ? t('emptyFilteredText') : t('emptySubtitle')}</p>
            {filterPersonId ? (
              <button onClick={() => setFilterPersonId('')} className="btn btn-secondary">{t('seeAllPeople')}</button>
            ) : canAdd ? (
              <button onClick={openModal} className="btn btn-primary" style={{ gap: '7px' }}>
                <ImagePlus size={16} aria-hidden="true" /> {t('addFirst')}
              </button>
            ) : null}
          </div>
        ) : layout === 'grid' ? (
          <div className="gv-grid">
            {photos.map((photo, i) => (
              <button key={i} type="button" onClick={() => setSelected(photo)} className="gv-tile"
                aria-label={t('viewPhotoOf', { name: getDisplayName(photo.person) })}>
                <img src={photo.url} alt={t('photoAlt', { name: getDisplayName(photo.person), n: i + 1 })}
                  loading="lazy" decoding="async"
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                <span className="gv-dot" style={{ background: genderDot(photo.person) }} aria-hidden="true" />
                {photo.isProfile && <span className="gv-profile badge badge-accent">{t('profileBadge')}</span>}
                <span className="gv-overlay">
                  <span className="serif gv-ov-name">{getDisplayName(photo.person)}</span>
                  {lifeLine(photo.person) && <span className="gv-ov-dates">{lifeLine(photo.person)}</span>}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="gv-list">
            {photos.map((photo, i) => (
              <button key={i} type="button" onClick={() => setSelected(photo)} className="gv-row"
                aria-label={t('viewPhotoOf', { name: getDisplayName(photo.person) })}>
                <img src={photo.url} alt="" loading="lazy" decoding="async"
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                <span className="gv-row-body">
                  <span className="serif gv-row-name">{getDisplayName(photo.person)}</span>
                  {lifeLine(photo.person) && <span className="gv-row-dates">{lifeLine(photo.person)}</span>}
                </span>
                <span className="gv-dot gv-dot-static" style={{ background: genderDot(photo.person) }} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showAdd && onUpdatePerson && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div role="dialog" aria-modal="true" aria-label={t('modalTitle')} className="modal" style={{ maxWidth: '440px' }}>
            <div className="gv-modal-head">
              <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                <ImagePlus size={18} aria-hidden="true" style={{ color: 'var(--accent)' }} /> {t('modalTitle')}
              </h2>
              <button onClick={closeModal} aria-label={t('cancel')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Person selector */}
              <label className="gv-field">
                <span className="label">{t('associateWith')}</span>
                <select value={addPersonId} onChange={e => setAddPersonId(e.target.value)} className="gv-select gv-select-full">
                  <option value="">{t('choosePerson')}</option>
                  {tree.persons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
                </select>
              </label>

              {/* 2. Drop zone / preview */}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { acceptFile(e.target.files?.[0]); e.target.value = ''; }} />
              {previewUrl ? (
                <div className="gv-preview">
                  <img src={previewUrl} alt={t('previewAlt')} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm gv-preview-change">
                    {t('changeImage')}
                  </button>
                </div>
              ) : (
                <button type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                  className={`gv-drop ${dragOver ? 'over' : ''}`}>
                  <UploadCloud size={28} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  <span>{t('dropHint')}</span>
                </button>
              )}

              {/* 3. Save */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button onClick={closeModal} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                <button onClick={handleSave} disabled={!pendingFile || !addPersonId || uploading} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                  {uploading ? <span className="spinner" /> : null}
                  {uploading ? t('uploadingLabel') : t('save')}
                </button>
              </div>
              {!addPersonId && pendingFile && <p className="gv-hint">{t('needPerson')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div className="gv-lightbox" onClick={() => setSelected(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <img src={selected.url} alt={t('lightboxAlt', { name: getDisplayName(selected.person) })}
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
            <button onClick={() => setSelected(null)} aria-label={t('close')} className="gv-lightbox-close"><X size={16} aria-hidden="true" /></button>
          </div>
          <button className="gv-lightbox-info" onClick={() => { onSelectPerson(selected.person.id); setSelected(null); }}>
            <span className="serif" style={{ fontWeight: 700, fontSize: '15px' }}>{getDisplayName(selected.person)}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selected.person.occupation || ''}{lifeLine(selected.person) ? ` · ${lifeLine(selected.person)}` : ''}
            </span>
            <span style={{ fontSize: '11px', marginTop: '2px', color: 'var(--accent)', fontWeight: 700 }}>{t('clickToViewProfile')}</span>
          </button>
        </div>
      )}

      <style>{`
        .gv-toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-wrap: wrap; }
        .gv-count { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); flex: 1; min-width: 80px; }
        .gv-toolbar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .gv-select { background: #1a1a24; color: var(--text); border: 1px solid var(--border); padding: 7px 10px; font-family: var(--font-body); font-size: 13px; min-height: 36px; cursor: pointer; max-width: 200px; }
        .gv-select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .gv-select-full { width: 100%; max-width: none; }
        .gv-field { display: flex; flex-direction: column; gap: 6px; }

        .gv-viewtoggle { display: inline-flex; border: 1px solid var(--border); flex-shrink: 0; }
        .gv-viewtoggle button { width: 34px; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: background 150ms, color 150ms; }
        .gv-viewtoggle button + button { border-left: 1px solid var(--border); }
        .gv-viewtoggle button.on { background: var(--accent); color: #0d0d0d; }
        .gv-viewtoggle button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

        .gv-body { flex: 1; overflow-y: auto; padding: 16px; }

        /* Empty state */
        .gv-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; padding: 40px 20px; }
        .gv-empty-title { margin: 6px 0 0; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--ink); }
        .gv-empty-sub { margin: 0 0 10px; color: var(--text-muted); font-size: 15px; max-width: 42ch; font-style: italic; }

        /* Grid */
        .gv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .gv-tile { position: relative; padding: 0; border: 1px solid var(--border); background: var(--bg-muted); cursor: pointer; overflow: hidden; aspect-ratio: 4 / 3; display: block; width: 100%; transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out); }
        .gv-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gv-tile:hover, .gv-tile:focus-visible { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); outline: none; }
        .gv-dot { position: absolute; top: 8px; right: 8px; width: 12px; height: 12px; border: 1.5px solid rgba(0,0,0,0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        .gv-profile { position: absolute; top: 8px; left: 8px; font-size: 9px; padding: 2px 7px; }
        .gv-overlay { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 1px; padding: 22px 10px 9px; background: linear-gradient(transparent, rgba(10,10,14,0.92)); opacity: 0; transition: opacity 180ms var(--ease-out); text-align: left; }
        .gv-tile:hover .gv-overlay, .gv-tile:focus-visible .gv-overlay { opacity: 1; }
        .gv-ov-name { color: #f5f0e8; font-size: 15px; font-weight: 700; line-height: 1.15; }
        .gv-ov-dates { color: var(--accent-text); font-family: var(--font-mono); font-size: 11px; }

        /* List */
        .gv-list { display: flex; flex-direction: column; gap: 6px; }
        .gv-row { display: flex; align-items: center; gap: 12px; padding: 8px; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; text-align: left; transition: border-color 150ms, background 150ms; }
        .gv-row:hover, .gv-row:focus-visible { border-color: var(--accent); background: var(--bg-muted); outline: none; }
        .gv-row img { width: 64px; height: 48px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
        .gv-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .gv-row-name { font-size: 15px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gv-row-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); }
        .gv-dot-static { position: static; flex-shrink: 0; }

        /* Modal */
        .gv-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: var(--bw) solid var(--border-strong); }
        .gv-drop { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 32px 16px; background: #1a1a24; border: 1.5px dashed var(--border-strong); color: var(--text-muted); font-size: 13px; cursor: pointer; transition: border-color 150ms, background 150ms, color 150ms; }
        .gv-drop:hover, .gv-drop.over, .gv-drop:focus-visible { border-color: var(--accent); color: var(--accent-text); background: var(--accent-light); outline: none; }
        .gv-preview { position: relative; }
        .gv-preview img { width: 100%; max-height: 240px; object-fit: cover; display: block; border: 1px solid var(--border-strong); }
        .gv-preview-change { position: absolute; bottom: 8px; right: 8px; }
        .gv-hint { margin: 0; font-size: 12px; color: var(--accent-text); text-align: right; }

        /* Lightbox */
        .gv-lightbox { position: fixed; inset: 0; background: var(--scrim, rgba(0,0,0,0.92)); z-index: 2000; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; padding: 20px; }
        .gv-lightbox-close { position: absolute; top: -12px; right: -12px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border-strong); cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .gv-lightbox-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .gv-lightbox-info { display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--bg-card); border: 1px solid var(--border); padding: 12px 20px; color: var(--text); text-align: center; cursor: pointer; }
        .gv-lightbox-info:hover, .gv-lightbox-info:focus-visible { border-color: var(--accent); outline: none; }

        @media (prefers-reduced-motion: reduce) {
          .gv-tile, .gv-overlay { transition: none; }
          .gv-tile:hover, .gv-tile:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );
}
