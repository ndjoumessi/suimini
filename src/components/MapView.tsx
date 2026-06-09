'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FamilyTree, Person } from '@/types';
import { resolveCoords, placeLabel } from '@/lib/geo';
import { getDisplayName, formatYear } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
}

type Kind = 'birth' | 'death';

interface GeoPoint {
  person: Person;
  kind: Kind;
  coords: [number, number];
  year: string;
  place: string;
}

interface MarkerGroup {
  key: string;
  coords: [number, number];
  points: GeoPoint[];
}

function initialsOf(person: Person): string {
  return (((person.firstName?.[0] || '') + (person.lastName?.[0] || '')).toUpperCase()) || '?';
}

function buildAvatar(person: Person): string {
  if (person.profilePhoto) {
    return `<img src="${person.profilePhoto}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
  }
  return `<span style="font-size:13px;font-weight:700;color:var(--accent);font-family:Inter,sans-serif;">${initialsOf(person)}</span>`;
}

function makeIcon(group: MarkerGroup): L.DivIcon {
  const count = group.points.length;
  if (count > 1) {
    const html = `<div style="width:42px;height:42px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;border:3px solid var(--bg-card);box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:Inter,sans-serif;">${count}</div>`;
    return L.divIcon({ html, className: 'suimini-marker', iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -21] });
  }
  const pt = group.points[0];
  const ring = pt.kind === 'birth' ? 'var(--success)' : 'var(--deceased)';
  // Kind is encoded by the ring + corner-dot colour (birth=success, death=deceased); no glyph.
  const html = `
    <div style="position:relative;width:40px;height:40px;">
      <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--accent-light);border:3px solid ${ring};box-shadow:0 2px 8px rgba(26,22,18,0.3);display:flex;align-items:center;justify-content:center;text-align:center;">${buildAvatar(pt.person)}</div>
      <div style="position:absolute;bottom:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:${ring};border:2px solid var(--bg-card);"></div>
    </div>`;
  return L.divIcon({ html, className: 'suimini-marker', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
}

function FitBounds({ groups }: { groups: MarkerGroup[] }) {
  const map = useMap();
  useEffect(() => {
    if (groups.length === 0) return;
    const bounds = L.latLngBounds(groups.map(g => g.coords));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }, [groups, map]);
  return null;
}

export default function MapView({ tree, onSelectPerson }: Props) {
  // Rendered client-only (loaded via next/dynamic with ssr:false), so leaflet is safe to use directly.
  const t = useTranslations('mapView');
  const [filter, setFilter] = useState<'all' | Kind>('all');

  const allPoints = useMemo<GeoPoint[]>(() => {
    const pts: GeoPoint[] = [];
    tree.persons.forEach(person => {
      const birth = resolveCoords(person.birthPlace);
      if (birth) pts.push({ person, kind: 'birth', coords: birth, year: formatYear(person.birthDate), place: placeLabel(person.birthPlace) });
      const death = resolveCoords(person.deathPlace);
      if (death) pts.push({ person, kind: 'death', coords: death, year: formatYear(person.deathDate), place: placeLabel(person.deathPlace) });
    });
    return pts;
  }, [tree.persons]);

  const groups = useMemo<MarkerGroup[]>(() => {
    const filtered = filter === 'all' ? allPoints : allPoints.filter(p => p.kind === filter);
    const map = new Map<string, MarkerGroup>();
    filtered.forEach(pt => {
      // Group markers that fall within ~0.01° (cluster nearby points).
      const key = `${pt.coords[0].toFixed(2)},${pt.coords[1].toFixed(2)}`;
      const existing = map.get(key);
      if (existing) existing.points.push(pt);
      else map.set(key, { key, coords: pt.coords, points: [pt] });
    });
    return Array.from(map.values());
  }, [allPoints, filter]);

  const totalLocated = new Set(allPoints.map(p => p.person.id)).size;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          {t('title')}
        </h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {([['all', 'filterAll'], ['birth', 'filterBirth'], ['death', 'filterDeath']] as [typeof filter, string][]).map(([f, labelKey]) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className="btn btn-sm" style={{
              background: filter === f ? 'var(--accent-light)' : 'var(--bg-muted)',
              color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              fontWeight: filter === f ? 700 : 400,
            }}>{t(labelKey)}</button>
          ))}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('located', { located: totalLocated, total: tree.persons.length })}
        </span>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {groups.length > 0 ? (
            <MapContainer
              center={[46.6, 2.5]}
              zoom={5}
              style={{ height: '100%', width: '100%', background: 'var(--bg-muted)' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds groups={groups} />
              {groups.map(group => (
                <Marker key={group.key} position={group.coords} icon={makeIcon(group)}>
                  <Popup>
                    <div style={{ minWidth: '180px', maxHeight: '240px', overflowY: 'auto' }}>
                      {group.points.length > 1 && (
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={13} aria-hidden="true" /> {group.points[0].place || t('thisPlace')} · {t('events', { count: group.points.length })}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.points.map((pt, i) => (
                          <button
                            key={i}
                            onClick={() => onSelectPerson(pt.person.id)}
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-body)' }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, background: 'var(--accent-light)', border: '1.5px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                              {pt.person.profilePhoto
                                ? <img src={pt.person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : initialsOf(pt.person)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>{getDisplayName(pt.person)}</div>
                              <div style={{ fontSize: '11px', color: '#6b6560' }}>
                                {pt.kind === 'birth' ? t('birth') : t('death')}{pt.year ? ` · ${pt.year}` : ''}
                              </div>
                              {pt.place && <div style={{ fontSize: '11px', color: '#a09890', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} aria-hidden="true" /> {pt.place}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', padding: '24px' }}>
              <MapPin size={48} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
              <h3 style={{ margin: 0, color: 'var(--text)' }}>{t('emptyTitle')}</h3>
              <p style={{ maxWidth: '360px', textAlign: 'center', margin: 0 }}>
                {t('emptyDescription')}
              </p>
            </div>
        )}
      </div>
    </div>
  );
}
