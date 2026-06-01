'use client';
import { useEffect, useMemo, useState } from 'react';
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

function buildAvatar(person: Person): string {
  if (person.profilePhoto) {
    return `<img src="${person.profilePhoto}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
  }
  const emoji = person.gender === 'male' ? '👨' : person.gender === 'female' ? '👩' : '🧑';
  return `<span style="font-size:18px;line-height:34px;">${emoji}</span>`;
}

function makeIcon(group: MarkerGroup): L.DivIcon {
  const count = group.points.length;
  if (count > 1) {
    const html = `<div style="width:42px;height:42px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;border:3px solid var(--bg-card);box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:Lato,sans-serif;">${count}</div>`;
    return L.divIcon({ html, className: 'suimini-marker', iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -21] });
  }
  const pt = group.points[0];
  const ring = pt.kind === 'birth' ? 'var(--success)' : 'var(--deceased)';
  const badge = pt.kind === 'birth' ? '✦' : '✝';
  const html = `
    <div style="position:relative;width:40px;height:40px;">
      <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--bg-muted);border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;text-align:center;">${buildAvatar(pt.person)}</div>
      <div style="position:absolute;bottom:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:${ring};color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-card);">${badge}</div>
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
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1, minWidth: '120px' }}>🗺 Carte des lieux</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {([['all', 'Tous'], ['birth', '✦ Naissances'], ['death', '✝ Décès']] as [typeof filter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} className="btn btn-sm" style={{
              background: filter === f ? 'var(--accent)' : 'var(--bg-muted)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>{label}</button>
          ))}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {totalLocated} / {tree.persons.length} localisés
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
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', fontFamily: 'Lato, sans-serif' }}>
                          📍 {group.points[0].place || 'Ce lieu'} · {group.points.length} événements
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.points.map((pt, i) => (
                          <button
                            key={i}
                            onClick={() => onSelectPerson(pt.person.id)}
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'Lato, sans-serif' }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                              {pt.person.profilePhoto
                                ? <img src={pt.person.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : (pt.person.gender === 'male' ? '👨' : pt.person.gender === 'female' ? '👩' : '🧑')}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1612' }}>{getDisplayName(pt.person)}</div>
                              <div style={{ fontSize: '11px', color: '#6b6560' }}>
                                {pt.kind === 'birth' ? '✦ Naissance' : '✝ Décès'}{pt.year ? ` · ${pt.year}` : ''}
                              </div>
                              {pt.place && <div style={{ fontSize: '11px', color: '#a09890' }}>📍 {pt.place}</div>}
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
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px' }}>🗺</div>
              <h3 style={{ margin: 0 }}>Aucun lieu à afficher</h3>
              <p style={{ maxWidth: '360px', textAlign: 'center' }}>
                Renseignez une ville de naissance ou de décès pour les membres afin de les voir apparaître sur la carte.
              </p>
            </div>
        )}
      </div>
    </div>
  );
}
