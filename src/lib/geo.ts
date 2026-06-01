import { GeoLocation } from '@/types';

/** Lightweight gazetteer of common cities → [lat, lng]. Keys are accent-stripped lowercase. */
export const CITY_COORDS: Record<string, [number, number]> = {
  // France
  'paris': [48.8566, 2.3522],
  'lyon': [45.764, 4.8357],
  'marseille': [43.2965, 5.3698],
  'toulouse': [43.6047, 1.4442],
  'bordeaux': [44.8378, -0.5792],
  'lille': [50.6292, 3.0573],
  'nantes': [47.2184, -1.5536],
  'strasbourg': [48.5734, 7.7521],
  'nice': [43.7102, 7.262],
  'rennes': [48.1173, -1.6778],
  'montpellier': [43.6108, 3.8767],
  'grenoble': [45.1885, 5.7245],
  'dijon': [47.322, 5.0415],
  'angers': [47.4784, -0.5632],
  'reims': [49.2583, 4.0317],
  'le havre': [49.4944, 0.1079],
  'saint-etienne': [45.4397, 4.3872],
  'toulon': [43.1242, 5.928],
  'brest': [48.3904, -4.4861],
  'limoges': [45.8336, 1.2611],
  'clermont-ferrand': [45.7772, 3.087],
  'tours': [47.3941, 0.6848],
  'amiens': [49.8941, 2.2958],
  'metz': [49.1193, 6.1757],
  'besancon': [47.238, 6.0243],
  'orleans': [47.9029, 1.909],
  'caen': [49.1829, -0.3707],
  'avignon': [43.9493, 4.8055],
  'pau': [43.2951, -0.3708],
  'perpignan': [42.6887, 2.8948],
  'bayonne': [43.4929, -1.4748],
  'annecy': [45.8992, 6.1294],
  'ajaccio': [41.9192, 8.7386],
  // Europe / world
  'londres': [51.5074, -0.1278],
  'london': [51.5074, -0.1278],
  'bruxelles': [50.8503, 4.3517],
  'geneve': [46.2044, 6.1432],
  'lausanne': [46.5197, 6.6323],
  'madrid': [40.4168, -3.7038],
  'barcelone': [41.3851, 2.1734],
  'rome': [41.9028, 12.4964],
  'milan': [45.4642, 9.19],
  'berlin': [52.52, 13.405],
  'munich': [48.1351, 11.582],
  'amsterdam': [52.3676, 4.9041],
  'lisbonne': [38.7223, -9.1393],
  'vienne': [48.2082, 16.3738],
  'new york': [40.7128, -74.006],
  'montreal': [45.5017, -73.5673],
  'quebec': [46.8139, -71.208],
  'casablanca': [33.5731, -7.5898],
  'alger': [36.7538, 3.0588],
  'tunis': [36.8065, 10.1815],
  'dakar': [14.7167, -17.4677],
  'abidjan': [5.36, -4.0083],
  'yaounde': [3.848, 11.5021],
  'douala': [4.0511, 9.7679],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Resolve a GeoLocation to [lat, lng], using explicit coordinates first, then the gazetteer. */
export function resolveCoords(place?: GeoLocation): [number, number] | null {
  if (!place) return null;
  if (place.coordinates && typeof place.coordinates.lat === 'number' && typeof place.coordinates.lng === 'number') {
    return [place.coordinates.lat, place.coordinates.lng];
  }
  if (place.city) {
    const key = normalize(place.city);
    if (CITY_COORDS[key]) return CITY_COORDS[key];
  }
  return null;
}

export function placeLabel(place?: GeoLocation): string {
  if (!place) return '';
  return [place.city, place.region, place.country].filter(Boolean).join(', ');
}
