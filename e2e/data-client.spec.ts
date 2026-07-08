/**
 * Phase 0 — socle DataClient (PR1). Garde-fou pur (aucun navigateur) : la
 * frontière réseau unique existe, expose toute l'interface, et le flag est en
 * ROLLBACK par défaut ('direct'). Le comportement de sync lui-même reste couvert
 * par sync-logic / conflict-resolution / realtime-echo (fonctions supabaseSync
 * inchangées, toujours exportées et testées directement).
 */
import { test, expect } from '@playwright/test';
import { getDataClient, DATA_LAYER } from '../src/lib/dataClient';

const METHODS = ['loadTrees', 'loadOneTree', 'saveTree', 'deleteTree', 'deleteChildRows', 'detectDeleteConflicts', 'restoreEntity'] as const;

test('getDataClient() expose toute l’interface DataClient', () => {
  const c = getDataClient() as unknown as Record<string, unknown>;
  for (const m of METHODS) expect(typeof c[m]).toBe('function');
});

test('DATA_LAYER par défaut = direct (rollback par défaut, aucun flag posé)', () => {
  // En environnement de test NEXT_PUBLIC_DATA_LAYER n'est pas défini.
  expect(DATA_LAYER).toBe('direct');
});

test('getDataClient() est un singleton stable (même instance à chaque appel)', () => {
  expect(getDataClient()).toBe(getDataClient());
});
