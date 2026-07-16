/**
 * Archi — garde-fou d'inventaire de frontière (recommandation n°4 de
 * AUDIT-ARCHITECTURE.md). Ce test aurait attrapé F1, F2 et F8 d'un coup : les
 * trois étaient des fichiers touchant une table du data-plane EN DEHORS de la
 * frontière `DataClient`/`DataStore` (ShareModal.tsx → supabaseSync direct,
 * export-pdf/send-approval-email/push-notify-join → SELECT Supabase direct).
 *
 * Principe : scanner tout `src/` (hors `node_modules`) et échouer si un
 * fichier HORS ALLOWLIST référence une table du data-plane, que ce soit via
 * le patron Supabase (`.from('trees')`) ou le patron SQL brut de Railway
 * (`from trees`, `into persons`, `update tree_shares` dans une chaîne).
 *
 * L'allowlist n'est pas "tout /api/data/*" comme le suggérait la recommandation
 * d'origine : vérification faite (2026-07-16), AUCUNE route actuelle ne touche
 * une table directement — elles passent toutes par `store.method()`. La vraie
 * frontière légitime, ce sont les 5 fichiers qui IMPLÉMENTENT l'accès aux
 * tables (mappers + impls `*Direct` + providers) : `supabaseSync.ts`,
 * `authz.ts`, `dataStore.ts`, `railwayStore.ts`, `sharing.ts`, `collaboration.ts`
 * (les deux derniers via leur patron `*Direct(client)`, documenté dans
 * CLAUDE.md). Si une route `/api/data/*` se met un jour à référencer une table
 * directement, ce test doit échouer — l'allowlist ne doit être élargie qu'en
 * connaissance de cause.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(__dirname, '..', 'src');

const DATA_PLANE_TABLES = [
  'trees', 'persons', 'relationships', 'journal_entries',
  'tree_shares', 'tree_members', 'person_comments', 'person_suggestions',
  'scanned_documents', 'photo_tags',
];

// Fichiers autorisés à référencer une table du data-plane DIRECTEMENT (les
// mappers/impls qui EXISTENT pour ça — voir le commentaire d'en-tête).
const ALLOWLIST = new Set([
  'src/lib/supabaseSync.ts',
  'src/lib/authz.ts',
  'src/lib/dataStore.ts',
  'src/lib/railwayStore.ts',
  'src/lib/sharing.ts',
  'src/lib/collaboration.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** Repère `.from('table')` / `.from("table")` (patron Supabase). */
function findSupabaseStyleHits(content: string, table: string): number[] {
  const re = new RegExp(`\\.from\\(['"]${table}['"]\\)`, 'g');
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) hits.push(m.index);
  return hits;
}

/** Repère `from table` / `into table` / `update table` en SQL brut (patron
 * Railway), en ignorant les lignes de commentaire (prose du type
 * « hint from tree_shares » ne doit pas déclencher un faux positif). */
function findRawSqlHits(content: string, table: string): number[] {
  const re = new RegExp(`\\b(from|into|update)\\s+${table}\\b`, 'gi');
  const hits: number[] = [];
  const lines = content.split('\n');
  let offset = 0;
  for (const line of lines) {
    if (!isCommentLine(line)) {
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(line))) hits.push(offset + m.index);
    }
    offset += line.length + 1;
  }
  return hits;
}

test('inventaire de frontière : aucune table data-plane référencée hors allowlist', () => {
  const files = walk(SRC_DIR);
  const violations: string[] = [];

  for (const file of files) {
    const relPath = relative(join(__dirname, '..'), file).replace(/\\/g, '/');
    if (ALLOWLIST.has(relPath)) continue;
    const content = readFileSync(file, 'utf-8');
    for (const table of DATA_PLANE_TABLES) {
      const supaHits = findSupabaseStyleHits(content, table);
      const sqlHits = findRawSqlHits(content, table);
      if (supaHits.length + sqlHits.length > 0) {
        violations.push(`${relPath} → table "${table}" (${supaHits.length} patron Supabase, ${sqlHits.length} SQL brut)`);
      }
    }
  }

  expect(violations, `Fichier(s) hors allowlist référençant une table data-plane :\n${violations.join('\n')}`).toEqual([]);
});

test('allowlist : chaque fichier existe encore (pas d\'entrée obsolète)', () => {
  const missing = [...ALLOWLIST].filter(p => {
    try { statSync(join(__dirname, '..', p)); return false; } catch { return true; }
  });
  expect(missing, 'Entrée(s) d\'allowlist pointant vers un fichier supprimé').toEqual([]);
});
