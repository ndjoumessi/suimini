/**
 * Tests pure-logic du client relais temps réel (pas de navigateur, pas de réseau).
 * Couvre le parsing des messages et le filtre par arbre — le cœur qui décide si
 * un signal doit déclencher un rechargement. Lançable sans serveur :
 *   E2E_BASE_URL=http://localhost:9999 npx playwright test e2e/realtime-relay.spec.ts
 */
import { test, expect } from '@playwright/test';
import {
  parseRelayMessage,
  isChangeForTree,
  isRailwayRealtimeEnabled,
} from '../src/lib/realtimeRelay';

test.describe('parseRelayMessage', () => {
  test('parse un message de changement valide', () => {
    const m = parseRelayMessage('{"t":"tree1","tbl":"persons","op":"UPDATE"}');
    expect(m).toEqual({ t: 'tree1', tbl: 'persons', op: 'UPDATE', type: undefined });
  });

  test('parse l\'ack d\'abonnement', () => {
    const m = parseRelayMessage('{"type":"subscribed","t":"tree1"}');
    expect(m?.type).toBe('subscribed');
    expect(m?.t).toBe('tree1');
  });

  test('rejette un JSON sans tree_id', () => {
    expect(parseRelayMessage('{"tbl":"persons"}')).toBeNull();
    expect(parseRelayMessage('{"t":""}')).toBeNull();
  });

  test('rejette un JSON invalide sans lever', () => {
    expect(parseRelayMessage('pas du json')).toBeNull();
    expect(parseRelayMessage('')).toBeNull();
  });
});

test.describe('isChangeForTree', () => {
  const treeId = 'teda1';

  test('accepte un changement de l\'arbre abonné', () => {
    expect(isChangeForTree({ t: 'teda1', tbl: 'persons', op: 'INSERT' }, treeId)).toBe(true);
  });

  test('ignore un changement d\'un AUTRE arbre (pas de fuite inter-arbres)', () => {
    expect(isChangeForTree({ t: 'tree1' }, treeId)).toBe(false);
  });

  test('ignore l\'ack d\'abonnement (pas un vrai changement)', () => {
    expect(isChangeForTree({ t: 'teda1', type: 'subscribed' }, treeId)).toBe(false);
  });

  test('ignore null', () => {
    expect(isChangeForTree(null, treeId)).toBe(false);
  });
});

test.describe('isRailwayRealtimeEnabled', () => {
  const backend = process.env.NEXT_PUBLIC_REALTIME_BACKEND;
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  test.afterAll(() => {
    if (backend === undefined) delete process.env.NEXT_PUBLIC_REALTIME_BACKEND;
    else process.env.NEXT_PUBLIC_REALTIME_BACKEND = backend;
    if (url === undefined) delete process.env.NEXT_PUBLIC_REALTIME_URL;
    else process.env.NEXT_PUBLIC_REALTIME_URL = url;
  });

  test('désactivé sans flag (défaut = comportement inchangé)', () => {
    delete process.env.NEXT_PUBLIC_REALTIME_BACKEND;
    delete process.env.NEXT_PUBLIC_REALTIME_URL;
    expect(isRailwayRealtimeEnabled()).toBe(false);
  });

  test('désactivé si le flag est posé mais l\'URL manque', () => {
    process.env.NEXT_PUBLIC_REALTIME_BACKEND = 'railway';
    delete process.env.NEXT_PUBLIC_REALTIME_URL;
    expect(isRailwayRealtimeEnabled()).toBe(false);
  });

  test('activé avec flag + URL', () => {
    process.env.NEXT_PUBLIC_REALTIME_BACKEND = 'railway';
    process.env.NEXT_PUBLIC_REALTIME_URL = 'wss://relay.example/realtime';
    expect(isRailwayRealtimeEnabled()).toBe(true);
  });
});
