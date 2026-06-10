// Shared French historical context — used by the timeline (period markers) and
// by person life-era badges. Bilingual labels/context (the UI picks by locale).

import type { Person } from '@/types';
import { getAge } from './treeUtils';

export interface HistoricalEvent {
  id: string;
  start: number;
  /** Omit for a single-year event (e.g. Mai 68). */
  end?: number;
  /** Show as a life-era badge on a person who lived through it. */
  badge?: boolean;
  fr: { label: string; short: string; context: string };
  en: { label: string; short: string; context: string };
}

/** Curated, France-centric. Ordered by start year. */
export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'revolution', start: 1789, end: 1799,
    fr: { label: 'Révolution française', short: '1789', context: "Chute de l'Ancien Régime, abolition des privilèges et Déclaration des droits de l'homme. Une période de bouleversements profonds pour les familles françaises." },
    en: { label: 'French Revolution', short: '1789', context: 'The fall of the Ancien Régime, abolition of privileges and the Declaration of the Rights of Man. A time of deep upheaval for French families.' },
  },
  {
    id: 'napoleon', start: 1804, end: 1815,
    fr: { label: 'Empire napoléonien', short: '1804', context: "Le Premier Empire et les guerres napoléoniennes, qui mobilisèrent des centaines de milliers d'hommes à travers l'Europe." },
    en: { label: 'Napoleonic Empire', short: '1804', context: 'The First Empire and the Napoleonic Wars, which mobilized hundreds of thousands of men across Europe.' },
  },
  {
    id: 'franco_prussian', start: 1870, end: 1871,
    fr: { label: 'Guerre de 1870', short: '1870', context: "Guerre franco-prussienne et chute du Second Empire, suivie de la Commune de Paris et de l'avènement de la IIIᵉ République." },
    en: { label: 'War of 1870', short: '1870', context: 'The Franco-Prussian War and the fall of the Second Empire, followed by the Paris Commune and the rise of the Third Republic.' },
  },
  {
    id: 'wwi', start: 1914, end: 1918, badge: true,
    fr: { label: 'Première Guerre mondiale', short: '14-18', context: "La Grande Guerre (1914-1918) mobilisa 8 millions de Français. Près d'1,4 million y perdirent la vie. Presque chaque famille française fut touchée." },
    en: { label: 'World War I', short: '14-18', context: 'The Great War (1914-1918) mobilized 8 million French soldiers; nearly 1.4 million died. Almost every French family was affected.' },
  },
  {
    id: 'wwii', start: 1939, end: 1945, badge: true,
    fr: { label: 'Seconde Guerre mondiale', short: '39-45', context: "La guerre, l'Occupation, la Résistance et la Libération (1939-1945) marquèrent durablement les familles, entre mobilisation, exode et reconstruction." },
    en: { label: 'World War II', short: '39-45', context: 'The war, the Occupation, the Resistance and the Liberation (1939-1945) deeply marked families through mobilization, exodus and reconstruction.' },
  },
  {
    id: 'trente_glorieuses', start: 1945, end: 1975,
    fr: { label: 'Trente Glorieuses', short: '1945', context: "Trois décennies de forte croissance et de modernisation après-guerre, qui transformèrent le quotidien et la mobilité des familles." },
    en: { label: 'Trente Glorieuses', short: '1945', context: 'Three decades of strong postwar growth and modernization that transformed family life and mobility.' },
  },
  {
    id: 'mai68', start: 1968,
    fr: { label: 'Mai 68', short: '1968', context: "Le mouvement social et culturel de mai 1968, symbole d'une rupture générationnelle en France." },
    en: { label: 'May 1968', short: '1968', context: 'The social and cultural movement of May 1968, a symbol of generational rupture in France.' },
  },
];

const span = (e: HistoricalEvent): [number, number] => [e.start, e.end ?? e.start];

/** Events whose period overlaps [from, to]. Used for timeline markers within a range. */
export function eventsOverlapping(from: number, to: number): HistoricalEvent[] {
  return HISTORICAL_EVENTS.filter(e => {
    const [s, en] = span(e);
    return en >= from && s <= to;
  });
}

/** Birth/death years for a person (death falls back to "now" for the living). */
function lifeSpan(person: Person): [number, number] | null {
  if (!person.birthDate) return null;
  const birth = new Date(person.birthDate).getFullYear();
  if (Number.isNaN(birth)) return null;
  const death = person.deathDate ? new Date(person.deathDate).getFullYear() : new Date().getFullYear();
  return [birth, Number.isNaN(death) ? birth : death];
}

/** Badge-worthy events a person lived through (overlap of their life with the event). */
export function personEras(person: Person): HistoricalEvent[] {
  const life = lifeSpan(person);
  if (!life) return [];
  const [from, to] = life;
  return HISTORICAL_EVENTS.filter(e => {
    if (!e.badge) return false;
    const [s, en] = span(e);
    return en >= from && s <= to;
  });
}

// Re-export so callers can derive a person's age without a second import.
export { getAge };
