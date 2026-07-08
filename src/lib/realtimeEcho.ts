/**
 * Suppression déterministe des échos Realtime de NOS PROPRES écritures.
 *
 * Supabase `postgres_changes` renvoie à l'émetteur ses propres écritures. Le
 * listener collaboratif (SuiminiApp) déclenchait alors « un collaborateur a
 * modifié cet arbre » sur nos propres modifications. L'ancienne parade — une
 * fenêtre temporelle de 6 s après le dernier push — était fragile : un simple
 * édit ré-upserte TOUT l'arbre (des dizaines/centaines de lignes), et la rafale
 * d'échos qui en résulte s'étale dans le temps ; le moindre écho arrivé après la
 * fenêtre produisait un faux positif.
 *
 * Ici on identifie chaque ligne écrite par une SIGNATURE (id + contenu muté /
 * horodatage) enregistrée AVANT l'upsert, et on ignore tout écho dont la
 * signature est connue. Déterministe, insensible à la latence. Une modif d'un
 * VRAI collaborateur porte un `updated_at`/`deleted_at` différent (son horloge)
 * → signature inconnue → l'écho passe et le message s'affiche.
 *
 * Module singleton (pas de React) : partagé par la couche sync (enregistrement à
 * l'écriture) et par le listener Realtime (vérification à la réception).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const TTL_MS = 20_000;              // couvre largement la latence d'une rafale d'échos
const MAX_ENTRIES = 5_000;          // garde-fou mémoire (édition très intensive)
const seen = new Map<string, number>(); // signature → instant d'enregistrement (ms)

function prune(now: number): void {
  for (const [k, t] of seen) if (now - t > TTL_MS) seen.delete(k);
  if (seen.size > MAX_ENTRIES) seen.clear(); // repli dur : ne jamais fuir la mémoire
}

/** Normalise un horodatage en epoch-ms (chaîne) pour comparer malgré les
 * différences de format ISO entre ce qu'on envoie et ce que Realtime renvoie
 * (« Z » vs « +00:00 », millisecondes, etc.). '' si non parsable/absent. */
function tsNorm(v: unknown): string {
  const n = Date.parse(typeof v === 'string' ? v : '');
  return Number.isNaN(n) ? '' : String(n);
}
function s(v: unknown): string { return v == null ? '' : String(v); }

/** Signature d'une ligne DB (colonnes snake_case, comme le payload Realtime).
 * persons/journal : id + updated_at (+ deleted_at). relationships : pas de
 * `updated_at` → on signe le contenu muté. */
export function rowSignature(table: string, r: any): string {
  const del = tsNorm(r?.deleted_at);
  if (table === 'relationships') {
    return `r:${s(r?.id)}:${s(r?.type)}:${s(r?.person1_id)}:${s(r?.person2_id)}:${s(r?.start_date)}:${s(r?.end_date)}:${s(r?.is_active)}:${s(r?.notes)}:${del}`;
  }
  const p = table === 'persons' ? 'p' : 'j';
  return `${p}:${s(r?.id)}:${tsNorm(r?.updated_at)}:${del}`;
}

/** Signature d'un soft-delete (UPDATE deleted_at=ts) : l'écho garde l'ancien
 * `updated_at`, donc seul le couple (id, deleted_at) l'identifie. */
export function softDeleteSignature(table: string, id: string, deletedAtIso: string): string {
  return `del:${table}:${s(id)}:${tsNorm(deletedAtIso)}`;
}
/** Signature d'un hard-delete (repli pré-migration : DELETE → écho sans deleted_at). */
export function hardDeleteSignature(table: string, id: string): string {
  return `hd:${table}:${s(id)}`;
}

/** Enregistre des signatures de lignes qu'on vient d'écrire (à appeler AVANT
 * l'upsert/update, l'écho arrive après). */
export function recordSelfWrites(signatures: string[]): void {
  if (signatures.length === 0) return;
  const now = Date.now();
  for (const sig of signatures) seen.set(sig, now);
  prune(now);
}

/**
 * Un événement Realtime est-il l'écho de NOTRE propre écriture ? `row` =
 * payload.new (INSERT/UPDATE, y compris soft-delete) ou payload.old (hard DELETE).
 */
export function isSelfEcho(table: string, row: any): boolean {
  if (!row || row.id == null) return false;
  prune(Date.now());
  const id = s(row.id);
  if (seen.has(hardDeleteSignature(table, id))) return true;                 // notre DELETE dur
  if (row.deleted_at != null && seen.has(softDeleteSignature(table, id, row.deleted_at))) return true; // notre soft-delete
  return seen.has(rowSignature(table, row));                                 // notre upsert
}

/** Test-only : vide le registre entre deux cas. */
export function _resetEchoRegistry(): void { seen.clear(); }
