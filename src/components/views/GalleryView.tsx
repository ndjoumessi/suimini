'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3, ImagePlus, X, Plus, ScanFace, UploadCloud, Trash2 } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';
import { uploadAvatar, deleteAvatarByUrl } from '@/lib/media/uploadImage';
import { formatBytes } from '@/lib/media/imageCompression';
import { cropToCanvas, cropToFile } from '@/lib/media/imageCrop';
import { GENDER_BAR, currentNodeMode } from '../tree/nodeStyle';
import { useOverlay } from '@/hooks/useOverlay';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  /** Open the AI face-recognition analyzer. Receives the currently filtered
   *  person (if any) so a single-person filter pre-assigns face #1 to them
   *  instead of always defaulting to "Inconnu". */
  onAnalyzePhoto?: (personId?: string) => void;
  /** Toast feedback (added / deleted). */
  onToast?: (msg: string) => void;
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

/** Full-screen photo lightbox. A real dialog via the shared useOverlay hook
 *  (focus-trap + Esc + body scroll-lock + focus-restore) — mounted only while open. */
function PhotoLightbox({ photo, onClose, onOpenPerson }: { photo: PhotoItem; onClose: () => void; onOpenPerson: (id: string) => void }) {
  const t = useTranslations('gallery');
  const ref = useOverlay<HTMLDivElement>(onClose);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={getDisplayName(photo.person)} className="gv-lightbox" onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <img src={photo.url} alt={t('lightboxAlt', { name: getDisplayName(photo.person) })}
          style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
        <button onClick={onClose} aria-label={t('close')} className="gv-lightbox-close"><X size={16} aria-hidden="true" /></button>
      </div>
      <button className="gv-lightbox-info" onClick={() => onOpenPerson(photo.person.id)}>
        <span className="serif" style={{ fontWeight: 700, fontSize: '15px' }}>{getDisplayName(photo.person)}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {photo.person.occupation || ''}{lifeLine(photo.person) ? ` · ${lifeLine(photo.person)}` : ''}
        </span>
        <span style={{ fontSize: '11px', marginTop: '2px', color: 'var(--accent)', fontWeight: 700 }}>{t('clickToViewProfile')}</span>
      </button>
    </div>
  );
}

export default function GalleryView({ tree, onSelectPerson, onUpdatePerson, onAnalyzePhoto, onToast }: Props) {
  const t = useTranslations('gallery');
  const tp = useTranslations('photoAnalyzer');
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PhotoItem | null>(null);
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
  // Person combobox (search + alphabetical list) for the upload modal.
  const [personQuery, setPersonQuery] = useState('');
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const personBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Crop (1:1, profile-photo ratio) — see the upload modal.
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  const canAdd = !!onUpdatePerson && tree.persons.length > 0;
  const canDelete = !!onUpdatePerson;

  // Remove a photo: drop it from the person record (profilePhoto or photos[]),
  // best-effort clean the storage object, and toast. Works in demo (base64 in the
  // store) and cloud alike — the store removal is what makes it disappear.
  function doDelete(photo: PhotoItem) {
    if (!onUpdatePerson) { setConfirmDelete(null); return; }
    const p = photo.person;
    if (photo.isProfile) onUpdatePerson(p.id, { profilePhoto: undefined });
    else onUpdatePerson(p.id, { photos: (p.photos || []).filter(u => u !== photo.url) });
    void deleteAvatarByUrl(photo.url);
    onToast?.(t('photoDeleted'));
    if (selected && selected.url === photo.url) setSelected(null);
    setConfirmDelete(null);
  }

  const resetCrop = () => { setCrop(undefined); setCompletedCrop(undefined); };
  const openModal = () => { setAddPersonId(''); setPendingFile(null); setPreviewUrl(''); setDragOver(false); setPersonQuery(''); setPersonDropdownOpen(false); resetCrop(); setShowAdd(true); };
  const closeModal = () => { setShowAdd(false); setPendingFile(null); setPreviewUrl(''); setPersonQuery(''); setPersonDropdownOpen(false); resetCrop(); };

  // Upload/delete modals used a bespoke Esc-only listener (no focus-trap, and
  // not registered in useOverlay's LIFO stack like every other overlay —
  // AUDIT-V5 P2 #26). Same shared hook as the lightbox now.
  const uploadOverlayRef = useOverlay<HTMLDivElement>(closeModal, { enabled: showAdd });
  const deleteOverlayRef = useOverlay<HTMLDivElement>(() => setConfirmDelete(null), { enabled: !!confirmDelete });

  // Revoke object URLs to avoid leaks.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    resetCrop();
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Seed a centered square crop once the image dimensions are known.
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const c = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height);
    setCrop(c);
    setCompletedCrop(convertToPixelCrop(c, width, height));
  };

  // Live square preview of the current crop.
  useEffect(() => {
    if (!completedCrop || !completedCrop.width || !imgRef.current || !previewCanvasRef.current) return;
    cropToCanvas(previewCanvasRef.current, imgRef.current, completedCrop, 120);
  }, [completedCrop]);

  const handleSave = async () => {
    if (!pendingFile || !addPersonId || !onUpdatePerson) return;
    setUploading(true);
    try {
      // Crop via canvas → JPEG 0.85; fall back to the original on any failure.
      let fileToUpload = pendingFile;
      if (imgRef.current && completedCrop?.width && completedCrop.height) {
        const cropped = await cropToFile(imgRef.current, completedCrop, pendingFile.name);
        if (cropped) fileToUpload = cropped;
      }
      const res = await uploadAvatar(fileToUpload, addPersonId);
      const person = tree.persons.find(p => p.id === addPersonId);
      onUpdatePerson(addPersonId, { photos: [...(person?.photos || []), res.url] });
      const compressed = res.beforeBytes != null && res.afterBytes != null && res.afterBytes < res.beforeBytes;
      onToast?.(
        compressed
          ? t('photoCompressed', { before: formatBytes(res.beforeBytes!), after: formatBytes(res.afterBytes!) })
          : t('photoAdded'),
      );
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

  // Sans filtre explicite, si les photos actuellement affichées appartiennent
  // TOUTES à une seule et même personne (petit arbre, une seule photo…), on la
  // considère comme le sujet évident — pas besoin de forcer l'utilisateur à
  // toucher le filtre "personne" avant d'analyser. Redevient ambigu (undefined)
  // dès qu'il y a plusieurs personnes dans la vue.
  const soleVisiblePersonId = useMemo(() => {
    if (photos.length === 0) return undefined;
    const first = photos[0].person.id;
    return photos.every(p => p.person.id === first) ? first : undefined;
  }, [photos]);

  const personsWithPhotos = useMemo(
    () => tree.persons
      .filter(p => p.profilePhoto || (p.photos && p.photos.length > 0))
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr', { sensitivity: 'base' })),
    [tree],
  );

  // Alphabetical, searchable person list for the upload modal's "associate with" combobox.
  const sortedPersons = useMemo(
    () => [...tree.persons].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr', { sensitivity: 'base' })),
    [tree.persons],
  );
  const filteredAddPersons = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (!q) return sortedPersons;
    return sortedPersons.filter(p => getDisplayName(p).toLowerCase().includes(q));
  }, [sortedPersons, personQuery]);
  const selectedPerson = addPersonId ? tree.persons.find(p => p.id === addPersonId) : undefined;

  // Broken-image placeholder (data URI, so it must carry its own literal
  // colours — CSS vars don't resolve inside an <img src>). Picked per current
  // theme so it doesn't render as a dark tile in light mode (AUDIT-V5 P1 #8).
  const fallbackSurface = currentNodeMode() === 'light' ? '%23e9e1cd' : '%231a1a24';
  const fallbackStroke = currentNodeMode() === 'light' ? '%236a5e46' : '%236c6c82';
  const FALLBACK_IMG = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='160' height='120' fill='${fallbackSurface}'/><g transform='translate(60,40) scale(1.7)' fill='none' stroke='${fallbackStroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/><circle cx='12' cy='13' r='3'/></g></svg>`;

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
              <button onClick={() => onAnalyzePhoto(filterPersonId || soleVisiblePersonId)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
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
              <div key={`${photo.person.id}-${photo.url}`} className="gv-tile">
                <button type="button" onClick={() => setSelected(photo)} className="gv-tile-open"
                  aria-label={t('viewPhotoOf', { name: getDisplayName(photo.person) })}>
                  <img src={photo.url} alt={t('photoAlt', { name: getDisplayName(photo.person), n: i + 1 })}
                    loading="lazy" decoding="async"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                  <span className="gv-overlay">
                    <span className="serif gv-ov-name">{getDisplayName(photo.person)}</span>
                    {lifeLine(photo.person) && <span className="gv-ov-dates">{lifeLine(photo.person)}</span>}
                  </span>
                </button>
                <span className="gv-dot" style={{ background: genderDot(photo.person) }} aria-hidden="true" />
                {photo.isProfile && <span className="gv-profile badge badge-accent">{t('profileBadge')}</span>}
                {canDelete && (
                  <button type="button" className="gv-del" onClick={() => setConfirmDelete(photo)}
                    aria-label={t('deletePhoto')} title={t('deletePhoto')}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="gv-list">
            {photos.map((photo) => (
              <div key={`${photo.person.id}-${photo.url}`} className="gv-row">
                <button type="button" onClick={() => setSelected(photo)} className="gv-row-open"
                  aria-label={t('viewPhotoOf', { name: getDisplayName(photo.person) })}>
                  <img src={photo.url} alt="" loading="lazy" decoding="async"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                  <span className="gv-row-body">
                    <span className="serif gv-row-name">{getDisplayName(photo.person)}</span>
                    {lifeLine(photo.person) && <span className="gv-row-dates">{lifeLine(photo.person)}</span>}
                  </span>
                </button>
                <span className="gv-dot gv-dot-static" style={{ background: genderDot(photo.person) }} aria-hidden="true" />
                {canDelete && (
                  <button type="button" className="gv-del-row" onClick={() => setConfirmDelete(photo)}
                    aria-label={t('deletePhoto')} title={t('deletePhoto')}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showAdd && onUpdatePerson && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div ref={uploadOverlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('modalTitle')} className="modal" style={{ maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="gv-modal-head">
              <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                <ImagePlus size={18} aria-hidden="true" style={{ color: 'var(--accent)' }} /> {t('modalTitle')}
              </h2>
              <button onClick={closeModal} aria-label={t('cancel')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', minHeight: 0 }}>
              {/* 1. Person selector — searchable, alphabetically sorted combobox */}
              <div className="gv-field" style={{ position: 'relative' }}>
                <span className="label" id="gv-person-label">{t('associateWith')}</span>
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={personDropdownOpen}
                  aria-controls="gv-person-listbox"
                  aria-autocomplete="list"
                  aria-labelledby="gv-person-label"
                  autoComplete="off"
                  placeholder={t('choosePerson')}
                  value={personDropdownOpen ? personQuery : (selectedPerson ? getDisplayName(selectedPerson) : '')}
                  onFocus={() => {
                    if (personBlurTimer.current) clearTimeout(personBlurTimer.current);
                    setPersonQuery('');
                    setPersonDropdownOpen(true);
                  }}
                  onChange={e => { setPersonQuery(e.target.value); if (addPersonId) setAddPersonId(''); }}
                  onKeyDown={e => { if (e.key === 'Escape') { setPersonDropdownOpen(false); (e.target as HTMLInputElement).blur(); } }}
                  onBlur={() => { personBlurTimer.current = setTimeout(() => setPersonDropdownOpen(false), 120); }}
                  className="input gv-select-full"
                />
                {personDropdownOpen && (
                  <ul id="gv-person-listbox" role="listbox" aria-label={t('choosePersonLabel')} className="gv-person-listbox">
                    {filteredAddPersons.length === 0 ? (
                      <li className="gv-person-empty" role="presentation">{t('personSearchEmpty')}</li>
                    ) : filteredAddPersons.map(p => (
                      <li key={p.id} role="option" aria-selected={p.id === addPersonId}>
                        <button
                          type="button"
                          className="gv-person-option"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setAddPersonId(p.id); setPersonQuery(''); setPersonDropdownOpen(false); }}
                        >
                          <span className="gv-dot gv-dot-static" style={{ background: genderDot(p) }} aria-hidden="true" />
                          {getDisplayName(p)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Drop zone / preview */}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { acceptFile(e.target.files?.[0]); e.target.value = ''; }} />
              {previewUrl ? (
                <div className="gv-cropwrap">
                  <div className="gv-cropmain">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percent) => setCrop(percent)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      keepSelection
                      className="gv-reactcrop"
                    >
                      <img ref={imgRef} src={previewUrl} alt={t('previewAlt')} onLoad={onImageLoad} className="gv-cropimg" />
                    </ReactCrop>
                    <p className="gv-cropinstr">{t('cropInstruction')}</p>
                    <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm gv-change">
                      {t('changeImage')}
                    </button>
                  </div>
                  <div className="gv-cropside">
                    <span className="label">{t('previewLabel')}</span>
                    <canvas ref={previewCanvasRef} className="gv-cropprev" width={120} height={120} />
                  </div>
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div ref={deleteOverlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('deleteConfirmTitle')} className="modal" style={{ maxWidth: '380px' }}>
            <div style={{ padding: '24px' }}>
              <h2 className="serif" style={{ margin: '0 0 8px', fontSize: '1.15rem', color: 'var(--ink)' }}>{t('deleteConfirmTitle')}</h2>
              <p style={{ margin: '0 0 22px', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-muted)' }}>{t('deleteConfirmText')}</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                <button onClick={() => doDelete(confirmDelete)} className="btn btn-danger btn-sm" style={{ gap: '6px' }}>
                  <Trash2 size={14} aria-hidden="true" /> {t('deleteConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <PhotoLightbox
          photo={selected}
          onClose={() => setSelected(null)}
          onOpenPerson={(id) => { onSelectPerson(id); setSelected(null); }}
        />
      )}

      <style>{`
        .gv-toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-wrap: wrap; }
        .gv-count { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); flex: 1; min-width: 80px; }
        .gv-toolbar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .gv-select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 10px; font-family: var(--font-body); font-size: 13px; min-height: 36px; cursor: pointer; max-width: 200px; }
        .gv-select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .gv-select-full { width: 100%; max-width: none; }
        .gv-field { display: flex; flex-direction: column; gap: 6px; }
        .gv-person-listbox { position: absolute; z-index: 5; top: calc(100% + 4px); left: 0; right: 0; max-height: 240px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: var(--bg-card); border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow); }
        .gv-person-option { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; background: transparent; border: none; color: var(--text); font-family: var(--font-body); font-size: 13px; text-align: left; cursor: pointer; }
        .gv-person-option { border-radius: var(--radius-sm); }
        .gv-person-option:hover, .gv-person-option:focus-visible { background: var(--interactive); outline: none; }
        li[aria-selected="true"] .gv-person-option { color: var(--accent); font-weight: 600; }
        .gv-person-empty { padding: 8px; font-size: 13px; color: var(--text-muted); }

        .gv-viewtoggle { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; flex-shrink: 0; }
        .gv-viewtoggle button { width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: background 150ms, color 150ms; }
        .gv-viewtoggle button + button { border-left: 1px solid var(--border); }
        .gv-viewtoggle button.on { background: var(--accent); color: var(--ink-on-accent); }
        .gv-viewtoggle button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

        .gv-body { flex: 1; overflow-y: auto; padding: 16px; }

        /* Empty state */
        .gv-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; padding: 40px 20px; }
        .gv-empty-title { margin: 6px 0 0; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--ink); }
        .gv-empty-sub { margin: 0 0 10px; color: var(--text-muted); font-size: 15px; max-width: 42ch; font-style: italic; }

        /* Grid */
        .gv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .gv-tile { position: relative; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-muted); overflow: hidden; aspect-ratio: 4 / 3; transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out); }
        .gv-tile-open { position: absolute; inset: 0; padding: 0; border: none; background: none; cursor: pointer; width: 100%; height: 100%; }
        .gv-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gv-tile:hover, .gv-tile:focus-within { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .gv-tile-open:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .gv-dot { position: absolute; top: 8px; right: 8px; width: 12px; height: 12px; border: 1.5px solid rgba(0,0,0,0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.4); pointer-events: none; }
        .gv-profile { position: absolute; top: 8px; left: 8px; font-size: 9px; padding: 2px 7px; pointer-events: none; }
        .gv-overlay { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 1px; padding: 22px 10px 9px; background: linear-gradient(transparent, rgba(10,10,14,0.92)); opacity: 0; transition: opacity 180ms var(--ease-out); text-align: left; pointer-events: none; }
        .gv-tile:hover .gv-overlay, .gv-tile:focus-within .gv-overlay { opacity: 1; }
        .gv-ov-name { color: var(--ink); font-size: 15px; font-weight: 700; line-height: 1.15; }
        .gv-ov-dates { color: var(--accent-text); font-family: var(--font-mono); font-size: 11px; }
        /* delete button — appears on hover/focus, top-right (over the gender dot) */
        .gv-del { position: absolute; top: 6px; right: 6px; z-index: 3; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--danger) 88%, transparent); color: #fff; border: none; border-radius: var(--radius-sm); cursor: pointer; opacity: 0; transition: opacity 150ms ease, background 150ms ease; }
        .gv-tile:hover .gv-del, .gv-del:focus-visible { opacity: 1; }
        .gv-del:hover { background: var(--danger); }

        /* List */
        .gv-list { display: flex; flex-direction: column; gap: 6px; }
        .gv-row { display: flex; align-items: center; gap: 12px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); transition: border-color 150ms, background 150ms; }
        .gv-row:hover, .gv-row:focus-within { border-color: var(--accent); background: var(--interactive); }
        .gv-row-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 0; border: none; background: none; cursor: pointer; text-align: left; }
        .gv-row-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .gv-row img { width: 64px; height: 48px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .gv-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .gv-row-name { font-size: 15px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gv-row-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); }
        .gv-dot-static { position: static; flex-shrink: 0; }
        .gv-del-row { flex-shrink: 0; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--text-muted); border: none; cursor: pointer; transition: color 150ms ease, background 150ms ease; }
        .gv-del-row { border-radius: var(--radius-sm); }
        .gv-del-row:hover, .gv-del-row:focus-visible { color: #fff; background: color-mix(in srgb, var(--danger) 88%, transparent); outline: none; }

        /* Modal */
        .gv-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: var(--bw) solid var(--border-strong); }
        .gv-drop { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 32px 16px; background: var(--bg-muted); border: 1.5px dashed var(--border-strong); border-radius: var(--radius-lg); color: var(--text-muted); font-size: 13px; cursor: pointer; transition: border-color 150ms, background 150ms, color 150ms; }
        .gv-drop:hover, .gv-drop.over, .gv-drop:focus-visible { border-color: var(--accent); color: var(--accent-text); background: var(--accent-light); outline: none; }
        .gv-hint { margin: 0; font-size: 12px; color: var(--accent-text); text-align: right; }

        /* Crop UI — interactive 1:1 crop + live preview */
        .gv-cropwrap { display: flex; gap: 16px; align-items: flex-start; }
        .gv-cropmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .gv-reactcrop { width: 100%; background: var(--ink-on-accent); border: 1px solid var(--border-strong);
          /* theme: gold handles, gold focus (override the library's vars) */
          --rc-drag-handle-size: 14px; --rc-drag-handle-bg-colour: var(--accent); --rc-border-color: var(--accent); --rc-focus-color: var(--accent); }
        .gv-cropimg { display: block; width: 100%; max-height: 46vh; object-fit: contain; }
        /* dark overlay on excluded zones (huge spread shadow leaves the selection clear) */
        .gv-reactcrop .ReactCrop__crop-selection { box-shadow: 0 0 0 9999px rgba(13,13,13,0.64); }
        .gv-reactcrop .ReactCrop__drag-handle { background-color: var(--accent); border-color: var(--ink-on-accent); }
        .gv-cropinstr { margin: 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em; color: var(--text-muted); }
        .gv-change { flex-shrink: 0; }
        .gv-cropside { width: 120px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .gv-cropside .label { align-self: flex-start; }
        .gv-cropprev { width: 120px; height: 120px; background: var(--ink-on-accent); border: 1px solid var(--border-strong); display: block; }
        @media (max-width: 560px) {
          .gv-cropwrap { flex-direction: column; }
          .gv-cropside { width: 100%; flex-direction: row; align-items: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gv-reactcrop .ReactCrop__crop-selection { animation: none; }
        }

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
