/**
 * Phase 0 — flip global : résolution du défaut serveur runtime (pur, aucun réseau).
 * Couvre la STABILITÉ du bucketing (garantie « pas de clignotement entre paliers »)
 * et la priorité allowlist > pourcentage > défaut. `getDataLayerRule` (lecture Edge
 * Config) n'est pas testée ici : elle dépend d'un store externe et fail-safe déjà.
 */
import { test, expect } from '@playwright/test';
import { bucketOf, resolveLayer, FALLBACK_RULE, type DataLayerRule } from '../src/lib/dataLayerConfig';

test('bucketOf : déterministe (même userId → même bucket) et borné [0,99]', () => {
  for (const id of ['u-alpha', 'user-123', '9f2c-uuid-xyz', '', 'é#!']) {
    const b1 = bucketOf(id);
    const b2 = bucketOf(id);
    expect(b1).toBe(b2); // pur : aucune dérive process/appel
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(100);
  }
});

test('bucketOf : MONOTONE à travers les paliers (10 → 25 → 50), jamais api→direct', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `user-${i}`);
  const base: DataLayerRule = { default: 'direct', apiPercent: 0, apiAllowlist: [] };
  const paliers = [10, 25, 50, 100];
  // Pour chaque utilisateur, une fois 'api' à un palier, il reste 'api' aux suivants.
  for (const id of ids) {
    let seenApi = false;
    for (const apiPercent of paliers) {
      const layer = resolveLayer({ ...base, apiPercent }, id);
      if (seenApi) expect(layer).toBe('api'); // aucun retour à direct quand le % monte
      if (layer === 'api') seenApi = true;
    }
  }
});

test('resolveLayer : allowlist prime sur le pourcentage et le défaut', () => {
  const rule: DataLayerRule = { default: 'direct', apiPercent: 0, apiAllowlist: ['vip'] };
  expect(resolveLayer(rule, 'vip')).toBe('api');
  expect(resolveLayer(rule, 'other')).toBe('direct'); // 0% + pas allowlisté → défaut
});

test('resolveLayer : sans allowlist ni %, suit le défaut', () => {
  expect(resolveLayer({ default: 'api', apiPercent: 0, apiAllowlist: [] }, 'x')).toBe('api');
  expect(resolveLayer({ default: 'direct', apiPercent: 0, apiAllowlist: [] }, 'x')).toBe('direct');
});

test('resolveLayer : apiPercent=100 → tout le monde en api', () => {
  const rule: DataLayerRule = { default: 'direct', apiPercent: 100, apiAllowlist: [] };
  for (const id of ['a', 'b', 'c-99', 'zzz']) expect(resolveLayer(rule, id)).toBe('api');
});

test('FALLBACK_RULE = direct (fail-safe, jamais api par accident)', () => {
  expect(FALLBACK_RULE.default).toBe('direct');
  expect(FALLBACK_RULE.apiPercent).toBe(0);
  expect(FALLBACK_RULE.apiAllowlist).toEqual([]);
});
