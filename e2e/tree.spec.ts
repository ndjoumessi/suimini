import { test, expect, type Page } from '@playwright/test';

/**
 * Arbre généalogique — noeuds, PersonPanel, zoom, mode sombre.
 *
 * Viewport mobile (390px) : BottomNav visible (≤768px).
 * Les tests tournent contre le build prod (playwright.config.ts) :
 * pas d'overlay Next.js dev → les clics BottomNav fonctionnent normalement.
 */

test.use({ viewport: { width: 390, height: 844 } });

const enterDemoAndOpenTree = async (page: Page) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await page
    .locator('nav[aria-label="Navigation mobile"]')
    .getByRole('button', { name: 'Arbre' })
    .click();
  // Focus is the default tree view (TreeView.tsx) — these tests exercise the
  // SVG-canvas-only features (.person-node count, zoom %), so switch to
  // "Complète" explicitly before waiting on .tree-svg (it never mounts under
  // the default Focus mode).
  await page.getByRole('button', { name: 'Complète' }).click();
  await page.locator('.tree-svg').waitFor({ state: 'visible' });
};

test.beforeEach(async ({ page }) => {
  await enterDemoAndOpenTree(page);
});

test('tree renders sample nodes', async ({ page }) => {
  // ⚠️ Ce compte N'EST PAS "17 des 19 personnes" (ancien commentaire, jamais
  // revérifié après l'ajout de la virtualisation par viewport — voir
  // TreeView.tsx "Virtualisation par viewport" : seuls les .person-node
  // intersectant le viewport ±200px sont MONTÉS dans le DOM, donc ce compte
  // dépend de la taille du viewport (390×844 ici), pas juste du nombre de
  // personnes. 16 est la valeur réelle observée deux fois de suite en CI
  // (runs #286 et #288, même viewport) — mais reste fragile par nature : si
  // ça recasse après un changement de layout/données, revérifier en CI
  // (Chromium indisponible en local — voir CLAUDE.md) plutôt que de deviner
  // un nouveau chiffre.
  await expect(page.locator('.person-node')).toHaveCount(16);
});

test('clicking a node opens PersonPanel', async ({ page }) => {
  // Activation clavier (focus + Entrée) plutôt que .click() : évite toute
  // dépendance à la géométrie/au hit-testing du canvas SVG virtualisé
  // (superposition de connecteurs, pointer-events des nœuds hors focus,
  // animation d'entrée) — handleNodeClick est déclenché de façon identique
  // par les deux voies (TreeView.tsx, onKeyDown Enter/Espace).
  const node = page.locator('.person-node').first();
  await node.focus();
  await node.press('Enter');
  await expect(page.locator('[data-testid="person-panel"]')).toBeVisible();
});

test('PersonPanel closes on the Fermer button', async ({ page }) => {
  const node = page.locator('.person-node').first();
  await node.focus();
  await node.press('Enter');
  await expect(page.locator('[data-testid="person-panel"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer le panneau' }).click();
  await expect(page.locator('[data-testid="person-panel"]')).not.toBeVisible();
});

test('zoom in increases the displayed percentage', async ({ page }) => {
  // Échelle initiale 1.1 → 110% ; zoom avant ×1.2 → 132%
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await expect(page.getByText('132%')).toBeVisible();
});

test('zoom reset returns to 100%', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await page.getByRole('button', { name: 'Réinitialiser le zoom' }).click();
  await expect(page.getByText('100%')).toBeVisible();
});

test('dark mode toggle sets data-theme="dark"', async ({ page }) => {
  // Le sélecteur de thème n'est plus un bouton unique dans la sidebar (« Activer
  // le mode sombre » n'existe plus) : depuis le redesign « Veillée » (light/dark/
  // system réel — voir CLAUDE.md), c'est un groupe Clair/Sombre/Système dans
  // Réglages (SettingsView.tsx, set-mode-btn). On force d'abord le mode clair
  // pour que le test soit valable même si "dark" est déjà actif par défaut
  // (sinon cliquer "Sombre" sur un thème déjà sombre ne prouverait rien).
  await page
    .locator('nav[aria-label="Navigation mobile"]')
    .getByRole('button', { name: 'Ouvrir le menu' })
    .click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('button', { name: 'Clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
