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
  citations?: Citation[];
  dnaOrigins?: DnaOrigin[];
  sources?: string[];
  media?: Media[];
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  privacy?: 'public' | 'private' | 'family';
  /** Faces tagged in photos that point to this person (from AI photo analysis). */
  photoTags?: PhotoTag[];
}

/** Links a detected face in a photo to a person, with its position in the image. */
export interface PhotoTag {
  photoUrl: string;
  personId: string;
  /** Face position as percentages of the image (0–100). */
  boundingBox?: { x: number; y: number; width: number; height: number };
  confidence?: number;
  taggedAt: string;
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
  journal?: JournalEntry[];
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

export type ViewMode = 'dashboard' | 'tree' | 'list' | 'timeline' | 'map' | 'statistics' | 'gallery' | 'journal' | 'birthdays' | 'ancestors' | 'settings' | 'admin';

// ----- Multitenant + validation des comptes -----
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserRole = 'user' | 'admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  status: UserStatus;
  role: UserRole;
  organization?: string;
  tenant_id?: string;
  created_at: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  payload: {
    user_id: string;
    email: string;
    display_name?: string;
    created_at: string;
  };
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'family' | 'pro';
  max_trees: number;
  max_members: number;
  is_active: boolean;
  created_at: string;
}

export type ColorThemeId = 'sepia' | 'slate' | 'forest' | 'bordeaux' | 'marine' | 'midnight';

export interface ColorTheme {
  id: ColorThemeId;
  name: string;
  emoji: string;
  accent: string;
  male: string;
  female: string;
}

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

