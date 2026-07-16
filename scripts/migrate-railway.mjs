#!/usr/bin/env node
/**
 * Runner de migrations versionnées — Railway (Archi F5).
 *
 * Miroir de `scripts/migrate.mjs` (Supabase), simplifié : Railway n'a pas
 * d'équivalent de la Management API Supabase pour exécuter du SQL arbitraire
 * à distance sans connexion directe — donc UN SEUL backend ici, toujours
 * `psql` sur l'URL **UNPOOLED** (DDL/migrations = jamais le pooler PgBouncer,
 * cf. CLAUDE.md « migrations/psql/DDL = URL UNPOOLED directe »).
 *
 * Applique dans l'ordre les fichiers `railway/migrations/NNNN_*.sql` non
 * encore enregistrés dans `public.suimini_migrations` (même nom de table de
 * suivi que Supabase — bases physiquement distinctes, pas de collision).
 * Chaque migration tourne dans UNE transaction (BEGIN … COMMIT) avec
 * l'insertion du marqueur → atomique.
 *
 * Commandes :
 *   node scripts/migrate-railway.mjs            # applique les migrations en attente
 *   node scripts/migrate-railway.mjs status     # liste appliquées / en attente
 *   node scripts/migrate-railway.mjs baseline   # marque TOUTES les migrations comme
 *                                                 # appliquées SANS les exécuter
 *                                                 # (adoption sur une base déjà à jour —
 *                                                 # ex. 0001_schema.sql au premier run,
 *                                                 # le schéma étant déjà en place depuis
 *                                                 # la migration de données initiale)
 *
 * Variable requise : `RAILWAY_DATABASE_URL_UNPOOLED` (URL Postgres DIRECTE, pas
 * la variante poolée `RAILWAY_DATABASE_URL` utilisée par l'app au runtime —
 * même distinction que `railwayDb.ts`/`docs/railway-migration.md`).
 *
 * ⚠️ Les fichiers de migration NE doivent PAS contenir leur propre BEGIN/COMMIT
 *    (le runner enveloppe). Ils doivent rester idempotents (CREATE … IF NOT
 *    EXISTS, CREATE OR REPLACE) — filet en cas de rejeu.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'railway', 'migrations');
const TRACKING_DDL = `create table if not exists public.suimini_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);`;

const DB_URL = process.env.RAILWAY_DATABASE_URL_UNPOOLED || '';

/** Exécute du SQL arbitraire (throw en cas d'erreur). Rien n'est retourné. */
function runSql(sql) {
  execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: ['ignore', 'ignore', 'inherit'] });
}

/** SELECT renvoyant une colonne `name` → tableau de chaînes. */
function selectNames() {
  const out = execFileSync('psql', [DB_URL, '-Atqc', 'select name from public.suimini_migrations order by name'], { encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

// ── Fichiers de migration ────────────────────────────────────────────────────
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{4}_.+\.sql$/.test(f))
    .sort(); // NNNN_ préfixe → ordre lexicographique = ordre d'application
}

const esc = s => `'${String(s).replace(/'/g, "''")}'`;

// ── Commandes ────────────────────────────────────────────────────────────────
function ensureTracking() { runSql(TRACKING_DDL); }

function cmdStatus() {
  ensureTracking();
  const applied = new Set(selectNames());
  const files = migrationFiles();
  console.log('Backend : psql (RAILWAY_DATABASE_URL_UNPOOLED)');
  console.log(`Migrations (${files.length}) :`);
  for (const f of files) {
    const name = f.replace(/\.sql$/, '');
    console.log(`  ${applied.has(name) ? '✅ appliquée ' : '⏳ en attente'}  ${name}`);
  }
  const pending = files.filter(f => !applied.has(f.replace(/\.sql$/, '')));
  console.log(pending.length ? `\n${pending.length} en attente.` : '\nÀ jour.');
}

function cmdBaseline() {
  ensureTracking();
  const files = migrationFiles();
  for (const f of files) {
    const name = f.replace(/\.sql$/, '');
    runSql(`insert into public.suimini_migrations(name) values (${esc(name)}) on conflict (name) do nothing;`);
  }
  console.log(`Baseline : ${files.length} migration(s) marquée(s) appliquée(s) SANS exécution.`);
}

function cmdUp() {
  ensureTracking();
  const applied = new Set(selectNames());
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
    runSql(wrapped);
    console.log('OK');
  }
  console.log(`\n${pending.length} migration(s) appliquée(s).`);
}

// ── Entrée ───────────────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'up';
if (!DB_URL) {
  console.error('RAILWAY_DATABASE_URL_UNPOOLED manquante (URL Postgres DIRECTE/unpooled Railway).');
  process.exit(2);
}
const run = { up: cmdUp, status: cmdStatus, baseline: cmdBaseline }[cmd];
if (!run) { console.error(`Commande inconnue : ${cmd} (up | status | baseline)`); process.exit(2); }
try {
  run();
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}
