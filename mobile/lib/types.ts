/**
 * Domain types — mirrored from the web app (src/types/index.ts) so the mobile
 * client speaks the exact same shape as Supabase rows and localStorage. Keep in
 * sync when the web model changes.
 */

export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type RelationType = 'spouse' | 'partner' | 'parent' | 'child' | 'sibling';
export type EventType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'divorce'
  | 'baptism'
  | 'graduation'
  | 'military'
  | 'immigration'
  | 'other';
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

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Citation {
  id: string;
  title: string;
  author?: string;
  year?: string;
  url?: string;
}

export interface DnaOrigin {
  region: string;
  percent: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  date: string;
  content: string;
  mentionedPersonIds?: string[];
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AiNarrative {
  text: string;
  questions: string[];
  generatedAt: string;
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
  /** Cadrage de la photo de profil : object-position en % (0–100 ; 50/50 = centré,
   *  valeur par défaut quand absent). Miroir du champ web (src/types/index.ts) —
   *  round-trip via `extra` côté serveur, aucune migration schéma requise. Mobile
   *  n'édite pas encore ce champ (pas de UI de recentrage) mais le lit/préserve
   *  pour ne pas écraser un cadrage défini depuis le web. */
  profilePhotoPosition?: { x: number; y: number };
  photos?: string[];
  events?: FamilyEvent[];
  notes?: Note[];
  citations?: Citation[];
  dnaOrigins?: DnaOrigin[];
  sources?: string[];
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  privacy?: 'public' | 'private' | 'family';
  aiNarrative?: AiNarrative;
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

export interface TreeSettings {
  defaultView: 'tree' | 'list' | 'timeline';
  showPhotos: boolean;
  showDates: boolean;
  showPlaces: boolean;
  colorScheme: 'default' | 'blue' | 'green' | 'warm' | 'custom';
  customColors?: { male: string; female: string; other: string };
  generationsToShow: number;
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
  journal?: JournalEntry[];
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

export interface Anniversary {
  person: Person;
  type: 'birthday' | 'deathday' | 'wedding';
  date: string;
  age?: number;
  daysUntil: number;
  relatedPerson?: Person;
}

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserRole = 'user' | 'admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  status: UserStatus;
  role: UserRole;
  created_at: string;
}

export interface StoreUser {
  id: string;
  email?: string;
}
