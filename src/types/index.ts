export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type RelationType = 'spouse' | 'partner' | 'parent' | 'child' | 'sibling';
export type EventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'baptism' | 'graduation' | 'military' | 'immigration' | 'other';
export type MediaType = 'photo' | 'document' | 'audio' | 'video';

export interface GeoLocation {
  city?: string;
  region?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

export interface FamilyEvent {
  id: string;
  type: EventType;
  date?: string;
  dateApprox?: boolean;
  place?: GeoLocation;
  description?: string;
  sources?: string[];
  media?: string[];
}

export interface Media {
  id: string;
  type: MediaType;
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  date?: string;
  personIds?: string[];
  uploadedAt: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  maidenName?: string;
  nickName?: string;
  gender: Gender;
  birthDate?: string;
  birthDateApprox?: boolean;
  birthPlace?: GeoLocation;
  deathDate?: string;
  deathDateApprox?: boolean;
  deathPlace?: GeoLocation;
  isAlive: boolean;
  occupation?: string;
  nationality?: string;
  religion?: string;
  education?: string;
  bio?: string;
  profilePhoto?: string;
  photos?: string[];
  events?: FamilyEvent[];
  notes?: Note[];
  sources?: string[];
  media?: Media[];
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  privacy?: 'public' | 'private' | 'family';
}

export interface Relationship {
  id: string;
  type: RelationType;
  person1Id: string;
  person2Id: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  notes?: string;
  marriageEvent?: FamilyEvent;
  divorceEvent?: FamilyEvent;
}

export interface FamilyTree {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  persons: Person[];
  relationships: Relationship[];
  rootPersonId?: string;
  settings?: TreeSettings;
}

export interface TreeSettings {
  defaultView: 'tree' | 'list' | 'timeline';
  showPhotos: boolean;
  showDates: boolean;
  showPlaces: boolean;
  colorScheme: 'default' | 'blue' | 'green' | 'warm' | 'custom';
  customColors?: { male: string; female: string; other: string };
  generationsToShow: number;
}

export interface SearchFilters {
  query?: string;
  gender?: Gender;
  birthYearFrom?: number;
  birthYearTo?: number;
  birthPlace?: string;
  isAlive?: boolean;
  hasPhoto?: boolean;
  occupation?: string;
  tags?: string[];
}

export interface TreeStats {
  totalPersons: number;
  totalMales: number;
  totalFemales: number;
  totalAlive: number;
  totalDeceased: number;
  totalGenerations: number;
  oldestPerson?: Person;
  youngestPerson?: Person;
  averageLifespan?: number;
  mostCommonSurname?: string;
  totalRelationships: number;
  totalPhotos: number;
  totalEvents: number;
}

export type ViewMode = 'tree' | 'list' | 'timeline' | 'map' | 'statistics' | 'gallery' | 'birthdays' | 'ancestors';

export interface Anniversary {
  person: Person;
  type: 'birthday' | 'deathday' | 'wedding';
  date: string;
  age?: number;
  daysUntil: number;
  relatedPerson?: Person;
}

export interface AncestorPath {
  path: Person[];
  relation: string;
}

