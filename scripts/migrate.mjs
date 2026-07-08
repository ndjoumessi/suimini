#!/usr/bin/env node
/**
 * Runner de migrations versionnées Suimini.
 *
 * Applique dans l'ordre les fichiers `supabase/migrations/NNNN_*.sql` non encore
 * enregistrés dans la table `public.suimini_migrations`. Chaque migration tourne
 * dans UNE transaction (BEGIN … COMMIT) avec l'insertion du marqueur → atomique :
 * une migration à moitié appliquée n'est jamais marquée « appliquée ».
 *
 * Deux backends (auto-détectés) :
 *   • LOCAL / validation :  DATABASE_URL=postgres://…  → via `psql` (ON_ERROR_STOP).
 *   • CI / prod         :  SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID
 *                          → Management API (/v1/projects/{ref}/database/query).
 *     (L'app n'a que l'anon key et ne peut PAS faire de DDL — d'où la CI privilégiée,
 *      MÊME secret que backup-db.yml. Jamais de service_role dans le runtime app.)
 *
 * Commandes :
 *   node scripts/migrate.mjs            # applique les migrations en attente
 *   node scripts/migrate.mjs status     # liste appliquées / en attente
 *   node scripts/migrate.mjs baseline   # marque TOUTES les migrations comme
 *                                        # appliquées SANS les exécuter (adoption
 *                                        # sur une base prod déjà à jour)
 *
 * ⚠️ Les fichiers de migration NE doivent PAS contenir leur propre BEGIN/COMMIT
 *    (le runner enveloppe). Ils doivent rester idempotents (CREATE … IF NOT EXISTS,
 *    ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE) — filet en cas de rejeu.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const TRACKING_DDL = `create table if not exists public.suimini_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);`;

// ── Backend ────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT = process.env.SUPABASE_PROJECT_ID || '';

function backendName() {
  if (DB_URL) return 'psql';
  if (TOKEN && PROJECT) return 'management-api';
  return null;
}

/** Exécute du SQL arbitraire (throw en cas d'erreur). Rien n'est retourné. */
async function runSql(sql) {
  if (DB_URL) {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: ['ignore', 'ignore', 'inherit'] });
    return;
  }
  await mgmtQuery(sql);
}

/** SELECT renvoyant une colonne `name` → tableau de chaînes. */
async function selectNames() {
  if (DB_URL) {
    const out = execFileSync('psql', [DB_URL, '-Atqc', 'select name from public.suimini_migrations order by name'], { encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  }
  const rows = await mgmtQuery('select name from public.suimini_migrations order by name');
  return (Array.isArray(rows) ? rows : []).map(r => r.name);
}

async function mgmtQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json().catch(() => []);
}

// ── Fichiers de migration ────────────────────────────────────────────────────
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{4}_.+\.sql$/.test(f))
    .sort(); // NNNN_ préfixe → ordre lexicographique = ordre d'application
}

const esc = s => `'${String(s).replace(/'/g, "''")}'`;

// ── Commandes ────────────────────────────────────────────────────────────────
async function ensureTracking() { await runSql(TRACKING_DDL); }

async function cmdStatus() {
  await ensureTracking();
  const applied = new Set(await selectNames());
  const files = migrationFiles();
  console.log(`Backend : ${backendName()}`);
  console.log(`Migrations (${files.length}) :`);
  for (const f of files) {
    const name = f.replace(/\.sql$/, '');
    console.log(`  ${applied.has(name) ? '✅ appliquée ' : '⏳ en attente'}  ${name}`);
  }
  const pending = files.filter(f => !applied.has(f.replace(/\.sql$/, '')));
  console.log(pending.length ? `\n${pending.length} en attente.` : '\nÀ jour.');
}

async function cmdBaseline() {
  await ensureTracking();
  const files = migrationFiles();
  for (const f of files) {
    const name = f.replace(/\.sql$/, '');
    await runSql(`insert into public.suimini_migrations(name) values (${esc(name)}) on conflict (name) do nothing;`);
  }
  console.log(`Baseline : ${files.length} migration(s) marquée(s) appliquée(s) SANS exécution.`);
}

async function cmdUp() {
  await ensureTracking();
  const applied = new Set(await selectNames());
  const files = migrationFiles();
  const pending = files.filter(f => !applied.has(f.replace(/\.sql$/, '')));
  if (!pending.length) { console.log('À jour — aucune migration en attente.'); return; }
  for (const f of pending) {
    const name = f.replace(/\.sql$/, '');
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    if (/^\s*(begin|commit)\s*;/im.test(sql)) {
      throw new Error(`${f} contient un BEGIN/COMMIT explicite — interdit (le runner enveloppe).`);
    }
    // Transaction : migration + marqueur ensemble → atomique.
    const wrapped = `begin;\n${sql}\n;\ninsert into public.suimini_migrations(name) values (${esc(name)});\ncommit;`;
    process.stdout.write(`→ ${name} … `);
    await runSql(wrapped);
    console.log('OK');
  }
  console.log(`\n${pending.length} migration(s) appliquée(s).`);
}

// ── Entrée ───────────────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'up';
if (!backendName()) {
  console.error('Aucun backend : définir DATABASE_URL (local) OU SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID (CI).');
  process.exit(2);
}
const run = { up: cmdUp, status: cmdStatus, baseline: cmdBaseline }[cmd];
if (!run) { console.error(`Commande inconnue : ${cmd} (up | status | baseline)`); process.exit(2); }
run().catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });
