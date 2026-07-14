// ============================================================================
// lib/push.ts — cœur d'envoi Expo Push RÉUTILISABLE (Node / routes API Next.js)
//
// Pendant Node du module Deno supabase/functions/_shared/expoPush.ts. Mécanisme
// GÉNÉRIQUE : n'importe quelle route serveur (/api/*) qui doit pousser une notif
// importe `sendExpoPush` — pas de logique Expo copiée-collée par cas d'usage.
//
// ⚠️ Duplication ASSUMÉE avec _shared/expoPush.ts : une Edge Function Deno ne peut
// pas importer depuis src/lib (runtimes distincts), et une route Next.js ne peut pas
// importer un module `npm:`/Deno. Les deux portent la MÊME logique (chunks de 100 +
// détection DeviceNotRegistered) — garder en phase si l'une change.
//
// Server-only : à n'importer que depuis des routes `runtime = 'nodejs'`.
// ============================================================================

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_CHUNK = 100; // limite de l'API Expo par requête

export type PushLocale = 'fr' | 'en';

/** Un message push Expo prêt à envoyer (une entrée = un token destinataire). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  data?: Record<string, string>;
}

/** Résultat agrégé : nb délivrés + tokens à purger (DeviceNotRegistered). */
export interface ExpoPushResult {
  sent: number;
  dead: string[];
}

/**
 * Envoie une liste de messages Expo par paquets de 100. Renvoie le nombre de
 * tickets « ok » + les tokens morts (DeviceNotRegistered) à purger. Ne lève
 * jamais : un chunk en échec réseau est compté comme non délivré (best-effort).
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      const tickets: { status?: string; details?: { error?: string } }[] = json?.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
      });
    } catch {
      /* échec réseau d'un chunk → non délivré, non fatal */
    }
  }
  return { sent, dead };
}

/**
 * Copie localisée « un membre a rejoint votre arbre », selon la locale du
 * DESTINATAIRE (le propriétaire). Même convention que la fonction anniversaires :
 * variantes fr/en codées ici, PAS dans messages/*.json (réservé à l'UI rendue).
 */
export function memberJoinedPushMessage(
  memberName: string,
  treeName: string,
  locale: PushLocale,
): { title: string; body: string } {
  if (locale === 'en') {
    return {
      title: '🌳 New member',
      body: `${memberName} joined your tree “${treeName}”`,
    };
  }
  return {
    title: '🌳 Nouveau membre',
    body: `${memberName} a rejoint votre arbre « ${treeName} »`,
  };
}
