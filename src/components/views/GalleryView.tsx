'use client';
import { useState, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3, ImageOff, X, ImageUp, Plus, ScanFace } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';
import { uploadAvatar } from '@/lib/uploadImage';

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

export default function GalleryView({ tree, onSelectPerson, onUpdatePerson, onAnalyzePhoto }: Props) {
  const t = useTranslations('gallery');
  const tp = useTranslations('photoAnalyzer');
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const [filterPersonId, setFilterPersonId] = useState<string>('');
  const [layout, setLayout] = useState<'grid' | 'masonry'>('grid');
  const [showAdd, setShowAdd] = useState(false);
  const [addPersonId, setAddPersonId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !addPersonId || !onUpdatePerson) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const res = await uploadAvatar(file, addPersonId);
      const person = tree.persons.find(p => p.id === addPersonId);
      onUpdatePerson(addPersonId, { photos: [...(person?.photos || []), res.url] });
      setShowAdd(false);
      setFilterPersonId('');
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  const photos = useMemo<PhotoItem[]>(() => {
    const items: PhotoItem[] = [];
    tree.persons.forEach(person => {
      if (person.profilePhoto) {
        items.push({ url: person.profilePhoto, person, isProfile: true });
      }
      (person.photos || []).forEach(url => {
        items.push({ url, person, isProfile: false });
      });
    });
    return filterPersonId
      ? items.filter(i => i.person.id === filterPersonId)
      : items;
  }, [tree, filterPersonId]);

  const personsWithPhotos = useMemo(
    () => tree.persons.filter(p => p.profilePhoto || (p.photos && p.photos.length > 0)),
    [tree]
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="label" style={{ flex: 1, color: 'var(--text-muted)' }}>{t('photoCount', { count: photos.length })}</span>{/* title lives in ContentHeader (no double header) */}
          <select
            value={filterPersonId}
            onChange={e => setFilterPersonId(e.target.value)}
            className="input" style={{ width: 'auto', maxWidth: '200px' }}
            aria-label={t('filterByPersonLabel')}
          >
            <option value="">{t('allPeople')}</option>
            {personsWithPhotos.map(p => (
              <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
            ))}
          </select>
          <button
            onClick={() => setLayout(l => l === 'grid' ? 'masonry' : 'grid')}
            className="btn btn-secondary btn-sm"
            style={{ gap: '6px' }}
            aria-label={layout === 'grid' ? t('switchToMasonry') : t('switchToGrid')}
          >
            {layout === 'grid'
              ? <><LayoutGrid size={14} aria-hidden="true" /> {t('layoutGrid')}</>
              : <><Rows3 size={14} aria-hidden="true" /> {t('layoutMasonry')}</>}
          </button>
          {onAnalyzePhoto && (
            <button onClick={onAnalyzePhoto} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <ScanFace size={14} aria-hidden="true" /> {tp('galleryButton')}
            </button>
          )}
          {onUpdatePerson && tree.persons.length > 0 && (
            <button onClick={() => { setShowAdd(s => !s); setAddPersonId(''); }} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
              <Plus size={14} aria-hidden="true" /> {t('addPhoto')}
            </button>
          )}
        </div>
      </div>

      {/* Add-photo panel */}
      {showAdd && onUpdatePerson && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label" style={{ flexShrink: 0 }}>{t('associateWith')}</span>
          <select value={addPersonId} onChange={e => setAddPersonId(e.target.value)} className="input" style={{ width: 'auto', maxWidth: '220px' }} aria-label={t('choosePersonLabel')}>
            <option value="">{t('choosePerson')}</option>
            {tree.persons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
          </select>
          <input ref={addFileRef} type="file" accept="image/*" onChange={handleAddFile} style={{ display: 'none' }} />
          <button onClick={() => addFileRef.current?.click()} disabled={!addPersonId || uploading} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            {uploading ? <span className="spinner" /> : <ImageUp size={14} aria-hidden="true" />} {t('importFile')}
          </button>
          <button onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
        </div>
      )}

      {/* Gallery */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {photos.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title={filterPersonId ? t('emptyFilteredTitle') : t('emptyTitle')}
            description={filterPersonId ? t('emptyFilteredText') : t('emptyText')}
            action={
              filterPersonId
                ? { label: t('seeAllPeople'), onClick: () => setFilterPersonId('') }
                : (onUpdatePerson && tree.persons.length > 0
                    ? { label: t('addPhoto'), onClick: () => { setShowAdd(true); setAddPersonId(''); } }
                    : undefined)
            }
          />
        ) : (
          <div style={layout === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }
            : { columnWidth: '180px', columnGap: '10px' }
          }>
            {photos.map((photo, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(photo)}
                aria-label={t('viewPhotoOf', { name: getDisplayName(photo.person) })}
                className="gallery-tile"
                style={{
                  borderRadius: 'var(--radius)', overflow: 'hidden',
                  cursor: 'pointer', position: 'relative', padding: 0,
                  border: '1px solid var(--border)',
                  transition: 'transform var(--t-base) var(--ease-out), box-shadow var(--t-base) var(--ease-out)',
                  aspectRatio: layout === 'grid' ? '1' : undefined,
                  breakInside: layout === 'masonry' ? 'avoid' : undefined,
                  marginBottom: layout === 'masonry' ? '10px' : undefined,
                  background: 'var(--bg-muted)', display: layout === 'masonry' ? 'inline-block' : 'block', width: '100%', textAlign: 'left', verticalAlign: 'top',
                }}
              >
                <img
                  src={photo.url}
                  alt={t('photoAlt', { name: getDisplayName(photo.person), n: i + 1 })}
                  style={{
                    width: '100%',
                    height: layout === 'grid' ? '100%' : 'auto',
                    objectFit: 'cover', display: 'block',
                  }}
                  onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='%23f4f1ec'/><g transform='translate(56,56) scale(2)' fill='none' stroke='%23847c70' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/><circle cx='12' cy='13' r='3'/></g></svg>"; }}
                />
                {photo.isProfile && (
                  <div className="badge badge-accent" style={{
                    position: 'absolute', top: '6px', right: '6px',
                    fontSize: '9px', padding: '2px 7px',
                  }}>{t('profileBadge')}</div>
                )}
                {/* Hover overlay */}
                <div className="photo-overlay" style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(26,22,18,0.85))',
                  padding: '20px 8px 8px', opacity: 0, transition: 'opacity 0.2s',
                }}>
                  <div style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>
                    {getDisplayName(photo.person)}
                  </div>
                  {photo.person.birthDate && (
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>
                      {formatYear(photo.person.birthDate)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '16px', padding: '20px',
          }}
          onClick={() => setSelected(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <img
              src={selected.url}
              alt={t('lightboxAlt', { name: getDisplayName(selected.person) })}
              style={{
                maxWidth: '100%', maxHeight: '75vh',
                borderRadius: 'var(--radius-lg)', objectFit: 'contain',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
            <button
              onClick={() => setSelected(null)}
              aria-label={t('close')}
              style={{
                position: 'absolute', top: '-12px', right: '-12px',
                background: 'var(--bg-card)', color: 'var(--text)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            ><X size={16} aria-hidden="true" /></button>
          </div>

          {/* Person info */}
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 20px',
              color: 'var(--text)', textAlign: 'center', cursor: 'pointer',
            }}
            onClick={() => { onSelectPerson(selected.person.id); setSelected(null); }}
          >
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>
              {getDisplayName(selected.person)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selected.person.occupation || ''}
              {selected.person.birthDate && ` · ${formatYear(selected.person.birthDate)}`}
              {!selected.person.isAlive && selected.person.deathDate && ` – ${formatYear(selected.person.deathDate)}`}
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--accent)', fontWeight: 700 }}>
              {t('clickToViewProfile')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
