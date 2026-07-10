/**
 * Phase 0 — flip global : DÉFAUT SERVEUR RUNTIME du transport DataClient.
 *
 * Lu au RUNTIME depuis Vercel Edge Config (changement + rollback SANS redéploiement).
 * ⚠️ SERVER-ONLY (importe `@vercel/edge-config`) : à n'utiliser que dans des routes
 * `app/api/*`. Le navigateur apprend le défaut via GET /api/data-layer (network-only).
 *
 * Règle (clé `data_layer` dans l'Edge Config) — rollout progressif :
 *   { "default": "direct", "apiPercent": 0, "apiAllowlist": ["<userId>", …] }
 *   • userId ∈ apiAllowlist            → 'api'   (toujours, indépendant du %)
 *   • bucketOf(userId) < apiPercent    → 'api'   (sticky : voir bucketOf)
 *   • sinon                            → default
 *
 * FAIL-SAFE : toute absence / erreur de lecture Edge Config ⇒ règle `direct` (le
 * chemin de rollback reste le comportement par défaut, jamais d'`api` par accident).
 */
import { get } from '@vercel/edge-config';

export interface DataLayerRule {
  default: 'api' | 'direct';
  apiPercent: number; // 0..100
  apiAllowlist: string[]; // userIds toujours en 'api'
}

export const FALLBACK_RULE: DataLayerRule = { default: 'direct', apiPercent: 0, apiAllowlist: [] };

/** Lit + normalise la règle. Ne throw jamais → FALLBACK_RULE en cas d'absence/erreur. */
export async function getDataLayerRule(): Promise<DataLayerRule> {
  try {
    const raw = await get('data_layer');
    if (raw && typeof raw === 'object') {
      const r = raw as Partial<DataLayerRule>;
      return {
        default: r.default === 'api' ? 'api' : 'direct',
        apiPercent: typeof r.apiPercent === 'number' ? Math.max(0, Math.min(100, Math.floor(r.apiPercent))) : 0,
        apiAllowlist: Array.isArray(r.apiAllowlist) ? r.apiAllowlist.filter((x): x is string => typeof x === 'string') : [],
      };
    }
  } catch {
    /* Edge Config non provisionné / lecture en échec → fail-safe */
  }
  return FALLBACK_RULE;
}

/**
 * Bucket DÉTERMINISTE et STABLE d'un userId dans [0,99] (FNV-1a 32 bits, pur).
 * Même userId → même bucket à travers requêtes, process et déploiements (aucun sel
 * aléatoire / par-process). Donc, quand `apiPercent` croît (10 → 25 → 50), l'ensemble
 * { bucket < apiPercent } est MONOTONE : un utilisateur passe au plus une fois
 * direct→api, jamais l'inverse (sauf rollback explicite). Pas de clignotement.
 */
export function bucketOf(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/** Résout le transport pour un utilisateur AUTHENTIFIÉ (userId non nul). */
export function resolveLayer(rule: DataLayerRule, userId: string): 'api' | 'direct' {
  if (rule.apiAllowlist.includes(userId)) return 'api';
  if (bucketOf(userId) < rule.apiPercent) return 'api';
  return rule.default;
}
