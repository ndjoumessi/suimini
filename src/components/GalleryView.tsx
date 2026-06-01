'use client';
import { useState, useMemo } from 'react';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatYear } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

interface PhotoItem {
  url: string;
  person: Person;
  isProfile: boolean;
}

export default function GalleryView({ tree, onSelectPerson }: Props) {
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const [filterPersonId, setFilterPersonId] = useState<string>('');
  const [layout, setLayout] = useState<'grid' | 'masonry'>('grid');

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
          <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>
            📸 Galerie — {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </h2>
          <select
            value={filterPersonId}
            onChange={e => setFilterPersonId(e.target.value)}
            className="input" style={{ width: 'auto', maxWidth: '200px' }}
          >
            <option value="">Toutes les personnes</option>
            {personsWithPhotos.map(p => (
              <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
            ))}
          </select>
          <button onClick={() => setLayout(l => l === 'grid' ? 'masonry' : 'grid')} className="btn btn-secondary btn-sm">
            {layout === 'grid' ? '▦ Grille' : '▤ Masonry'}
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '56px', marginBottom: '12px' }}>📷</div>
            <h3>Aucune photo</h3>
            <p>Ajoutez des photos depuis le profil de chaque personne</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: layout === 'grid'
              ? 'repeat(auto-fill, minmax(160px, 1fr))'
              : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '10px',
          }}>
            {photos.map((photo, i) => (
              <div
                key={i}
                onClick={() => setSelected(photo)}
                style={{
                  borderRadius: 'var(--radius)', overflow: 'hidden',
                  cursor: 'pointer', position: 'relative',
                  border: '2px solid var(--border)',
                  transition: 'all 0.2s',
                  aspectRatio: layout === 'grid' ? '1' : undefined,
                  background: 'var(--bg-muted)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                  const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
              >
                <img
                  src={photo.url}
                  alt={getDisplayName(photo.person)}
                  style={{
                    width: '100%',
                    height: layout === 'grid' ? '100%' : 'auto',
                    minHeight: layout === 'masonry' ? '120px' : undefined,
                    objectFit: 'cover', display: 'block',
                  }}
                  onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="%23f4f1ec"/><text x="80" y="85" text-anchor="middle" font-size="40">📷</text></svg>'; }}
                />
                {photo.isProfile && (
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: 'var(--accent)', color: 'white',
                    borderRadius: '100px', padding: '2px 6px',
                    fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px',
                  }}>PROFIL</div>
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
              </div>
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
              alt=""
              style={{
                maxWidth: '100%', maxHeight: '75vh',
                borderRadius: 'var(--radius-lg)', objectFit: 'contain',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: '-12px', right: '-12px',
                background: 'white', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >✕</button>
          </div>

          {/* Person info */}
          <div
            style={{
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius)', padding: '12px 20px',
              color: 'white', textAlign: 'center', cursor: 'pointer',
            }}
            onClick={() => { onSelectPerson(selected.person.id); setSelected(null); }}
          >
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>
              {getDisplayName(selected.person)}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              {selected.person.occupation || ''}
              {selected.person.birthDate && ` · ${formatYear(selected.person.birthDate)}`}
              {!selected.person.isAlive && selected.person.deathDate && ` – ${formatYear(selected.person.deathDate)}`}
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
              Cliquer pour voir le profil
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
