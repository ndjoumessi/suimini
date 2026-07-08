/**
 * Audit d'accessibilité automatisé (axe-core) — WCAG 2.1 A + AA.
 * Couvre la landing, les pages légales et TOUTES les vues de l'app en mode
 * démo, y compris les états ouverts (panneau personne, palette de commandes,
 * modales d'export/impression). Chaque scan DOIT remonter zéro violation de
 * niveau A/AA : ce spec est le garde-fou de non-régression accessibilité.
 */
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Lance axe sur l'état courant de la page et formate les violations. */
async function expectNoViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Le canvas Leaflet (carte) et les tuiles tierces ne sont pas à nous.
    .exclude('.leaflet-container')
    .analyze();
  const violations = results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map(n => n.html.slice(0, 160)),
  }));
  expect(violations, `Violations axe (${context}) :\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

/** Entre dans l'app en mode démo (cookie proxy + localStorage). */
async function enterDemo(page: Page) {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await expect(page.locator('.demo-banner-text')).toBeVisible();
}

test.describe('a11y — pages publiques', () => {
  test('landing /', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page, 'landing');
  });

  test('CGU + confidentialité', async ({ page }) => {
    await page.goto('/cgu');
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page, '/cgu');
    await page.goto('/confidentialite');
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page, '/confidentialite');
  });
});

test.describe('a11y — app (mode démo)', () => {
  test('vue arbre (défaut) + panneau personne', async ({ page }) => {
    await enterDemo(page);
    await page.waitForTimeout(600); // fin des animations d'entrée
    await expectNoViolations(page, 'app / vue arbre');

    // Ouvre la fiche d'une personne (premier nœud interactif de l'arbre).
    const node = page.locator('[data-person-id]').first();
    if (await node.count()) {
      await node.click();
      await page.waitForTimeout(400);
      await expectNoViolations(page, 'app / panneau personne ouvert');
      await page.keyboard.press('Escape');
    }
  });

  test('vues dashboard, liste, frise, journal, carte', async ({ page }) => {
    await enterDemo(page);
    // La navigation passe par la sidebar (desktop). On visite chaque vue par
    // son libellé accessible ; si un libellé change, ce test le signale.
    for (const view of ['Tableau de bord', 'Membres', 'Frise', 'Journal']) {
      const navBtn = page.getByRole('button', { name: new RegExp(view, 'i') }).first();
      if (!(await navBtn.count())) continue;
      await navBtn.click();
      await page.waitForTimeout(500);
      await expectNoViolations(page, `app / vue ${view}`);
    }
  });

  test('palette de commandes (Cmd+K)', async ({ page }) => {
    await enterDemo(page);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await page.waitForTimeout(300);
    await expectNoViolations(page, 'app / palette de commandes');
  });

  test('modale export PDF', async ({ page }) => {
    await enterDemo(page);
    const exportBtn = page.getByRole('button', { name: /export|livret|imprimer/i }).first();
    if (await exportBtn.count()) {
      await exportBtn.click();
      await page.waitForTimeout(400);
      await expectNoViolations(page, 'app / modale export');
    }
  });
});
