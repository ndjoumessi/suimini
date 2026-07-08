/**
 * Tests unitaires PURS (aucun navigateur, aucun réseau) des helpers du bandeau
 * de statut Supabase : `src/hooks/useSupabaseStatus.ts`. On vérifie le mappage
 * indicateur → niveau/rôle du bandeau, la stabilité de la clé de rejet
 * (dismissKey) et la normalisation des indicateurs inconnus.
 */
import { test, expect } from '@playwright/test';
import { bannerLevel, dismissKey, normalizeIndicator } from '../src/hooks/useSupabaseStatus';

test.describe('normalizeIndicator', () => {
  test('laisse passer les indicateurs connus', () => {
    expect(normalizeIndicator('minor')).toBe('minor');
    expect(normalizeIndicator('major')).toBe('major');
    expect(normalizeIndicator('critical')).toBe('critical');
  });
  test('replie tout le reste sur "none" (fail-open)', () => {
    expect(normalizeIndicator('none')).toBe('none');
    expect(normalizeIndicator('maintenance')).toBe('none');
    expect(normalizeIndicator(undefined)).toBe('none');
    expect(normalizeIndicator(null)).toBe('none');
    expect(normalizeIndicator(42)).toBe('none');
  });
});

test.describe('bannerLevel', () => {
  test('indicator "none" → aucun bandeau', () => {
    expect(bannerLevel('none')).toBeNull();
  });
  test('minor → niveau minor, role status, teinte accent (or)', () => {
    const l = bannerLevel('minor');
    expect(l).not.toBeNull();
    expect(l?.level).toBe('minor');
    expect(l?.role).toBe('status');
    expect(l?.color).toBe('var(--accent)');
  });
  test('major → niveau major, role status, teinte warning (ambre)', () => {
    const l = bannerLevel('major');
    expect(l?.level).toBe('major');
    expect(l?.role).toBe('status');
    expect(l?.color).toBe('var(--warning)');
  });
  test('critical → niveau critical, role alert (assertif), teinte danger (rouge)', () => {
    const l = bannerLevel('critical');
    expect(l?.level).toBe('critical');
    expect(l?.role).toBe('alert');
    expect(l?.color).toBe('var(--danger)');
  });
});

test.describe('dismissKey', () => {
  test('utilise l\'id de l\'incident quand il existe', () => {
    const key = dismissKey({ indicator: 'major', description: 'DB down', incidents: [{ id: 'inc-123' }] });
    expect(key).toBe('suimini_status_dismissed_inc-123');
  });
  test('est stable pour le même incident', () => {
    const a = dismissKey({ indicator: 'major', description: 'DB down', incidents: [{ id: 'inc-123' }] });
    const b = dismissKey({ indicator: 'major', description: 'DB down', incidents: [{ id: 'inc-123' }] });
    expect(a).toBe(b);
  });
  test('change pour un NOUVEL incident', () => {
    const a = dismissKey({ indicator: 'major', description: 'DB down', incidents: [{ id: 'inc-123' }] });
    const b = dismissKey({ indicator: 'major', description: 'DB down', incidents: [{ id: 'inc-999' }] });
    expect(a).not.toBe(b);
  });
  test('sans incident → repli indicateur + hash de description, stable', () => {
    const a = dismissKey({ indicator: 'minor', description: 'Elevated latency' });
    const b = dismissKey({ indicator: 'minor', description: 'Elevated latency' });
    expect(a).toBe(b);
    expect(a.startsWith('suimini_status_dismissed_minor-')).toBe(true);
  });
  test('sans incident → une description différente donne une clé différente', () => {
    const a = dismissKey({ indicator: 'minor', description: 'Elevated latency' });
    const b = dismissKey({ indicator: 'minor', description: 'Partial outage' });
    expect(a).not.toBe(b);
  });
});
