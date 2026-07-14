// ============================================================================
// _shared/expoPush.ts — cœur RÉUTILISABLE d'envoi Expo Push (Deno / Edge Functions)
//
// Mécanisme d'envoi de notifications push GÉNÉRIQUE, partagé par toutes les Edge
// Functions Supabase qui poussent (aujourd'hui send-birthday-notifications ; demain
// d'autres déclencheurs serveur). Extrait de l'ancienne logique inline de la fonction
// anniversaires, à l'identique : mêmes chunks de 100, même détection DeviceNotRegistered.
//
// ⚠️ Duplication ASSUMÉE avec src/lib/push.ts (côté Node/Next.js) : une Edge Function
// Deno ne peut pas importer depuis src/lib (runtimes + résolution de modules distincts).
// Les deux fichiers portent la MÊME logique d'appel Expo (~20 lignes) ; garder en phase.
//
// Ne fait QUE parler à l'API Expo. La lecture des tokens, le ciblage des destinataires
// et la localisation des messages restent à l'appelant (dépendants du cas d'usage).
// ============================================================================

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_CHUNK = 100; // limite de l'API Expo par requête

/** Un message push Expo prêt à envoyer (une entrée = un token destinataire). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  data?: Record<string, string>;
}

/** Résultat agrégé d'un envoi : nb délivrés + tokens à purger (DeviceNotRegistered). */
export interface ExpoPushResult {
  sent: number;
  /** Tokens revenus DeviceNotRegistered → l'appelant les purge (déchet technique). */
  dead: string[];
}

/**
 * Envoie une liste de messages Expo par paquets de 100 et renvoie le nombre de
 * tickets « ok » + les tokens morts (DeviceNotRegistered). Ne lève pas : un chunk
 * en échec réseau est simplement compté comme non délivré (best-effort).
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
      /* chunk en échec réseau → non délivré, non fatal (best-effort) */
    }
  }
  return { sent, dead };
}
