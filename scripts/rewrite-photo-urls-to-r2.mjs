#!/usr/bin/env node
// ============================================================================
// Réécrit les URLs de photos EXISTANTES (Supabase Storage public → R2 public)
// dans la base RAILWAY (plan données), APRÈS que `scripts/copy-avatars-to-r2.sh`
// ait déjà copié les mêmes fichiers vers R2 sous les MÊMES clés d'objet.
//
// ⚠️ SCRIPT MANUEL, À LANCER PAR LE USER — pas par l'agent (pas de credentials
// Railway dans ce sandbox, voir CLAUDE.md "Écriture prod bloquée depuis l'agent").
//
// Contexte : la copie des blobs (scripts/copy-avatars-to-r2.sh) ne fait QUE
// dupliquer les fichiers — elle ne touche JAMAIS aux URLs déjà enregistrées
// dans les fiches personnes / le journal. Résultat attendu et documenté
// (docs/railway-auth-storage-migration.md §4.3) : les photos existantes
// continuent de pointer vers Supabase (qui reste lisible), seules les NOUVELLES
// photos (uploadées après le flip NEXT_PUBLIC_STORAGE_BACKEND=r2) partent vers
// R2. Ce script est l'étape OPTIONNELLE pour aussi faire pointer les photos
// EXISTANTES vers R2 (utile si on veut, à terme, arrêter de dépendre de la
// lecture de Supabase Storage — mais Supabase Storage n'est jamais vidé pour
// autant, cf. rollback).
//
// Trois emplacements identifiés par lecture directe du schéma + des mappers
// (railway/schema.sql, src/lib/supabaseSync.ts, src/types/index.ts) :
//   1. persons.profile_photo         (colonne texte dédiée — la photo de profil)
//   2. persons.extra                 (jsonb catch-all : `photos` (galerie perso),
//                                      `photoTags[].photoUrl` (visages tagués),
//                                      `media[].url`/`.thumbnail` (non câblé dans
//                                      l'UI actuelle mais couvert par prudence) —
//                                      TOUS non-canoniques → atterrissent dans
//                                      `extra`, jamais dans une colonne dédiée)
//   3. journal_entries.photos        (colonne jsonb dédiée — photos d'un journal)
// (photo_tags, une table Railway séparée, existe dans le schéma mais aucun code
//  applicatif ne l'utilise actuellement — recherche exhaustive dans src/ : aucun
//  résultat — donc HORS PÉRIMÈTRE ici ; si elle est un jour câblée, l'ajouter.)
//
// Approche : remplacement de PRÉFIXE LITTÉRAL (pas de parsing JSON par chemin —
// on traite `extra`/`photos` comme du texte JSON sérialisé et on y fait un
// replace() ciblé côté Postgres, comme personToRow/rowToPerson traitent `extra`
// comme un blob opaque). Sûr ici car l'URL ne contient aucun caractère
// d'échappement JSON (pas de guillemet/backslash), donc un replace() littéral
// dans le texte JSON ne peut pas corrompre la structure — seul le contenu de la
// valeur change. `updated_at` n'est JAMAIS touché (pure réécriture technique,
// pas une vraie édition utilisateur — ne doit pas fausser le tri "Dernières
// modifications").
//
// Usage :
//   RAILWAY_DATABASE_URL=postgres://...  \
//   OLD_URL_PREFIX='https://<project-ref>.supabase.co/storage/v1/object/public/avatars/' \
//   NEW_URL_PREFIX='https://pub-xxxxxxxx.r2.dev/' \
//   node scripts/rewrite-photo-urls-to-r2.mjs            # DRY_RUN=1 par défaut
//
//   DRY_RUN=0 node scripts/rewrite-photo-urls-to-r2.mjs  # écriture réelle
//
// Réversible : relancer avec OLD_URL_PREFIX/NEW_URL_PREFIX inversés remet
// Supabase (tant que les fichiers y sont encore lisibles — jamais supprimés).
// ============================================================================
import tls from 'node:tls';
import pg from 'pg';

const { Pool } = pg;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Variable manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ RAILWAY_DATABASE_URL (ou DATABASE_URL) manquant.');
  process.exit(1);
}
const OLD_PREFIX = requireEnv('OLD_URL_PREFIX');
const NEW_PREFIX = requireEnv('NEW_URL_PREFIX');
const DRY_RUN = (process.env.DRY_RUN ?? '1') !== '0';

// Miroir exact de src/lib/railwayDb.ts::sslConfig() (dupliqué ici : ce script
// tourne en Node pur, hors build Next.js, pas d'accès à l'alias @/lib/*).
function sslConfig() {
  const ca = process.env.RAILWAY_DB_CA_CERT;
  if (ca) {
    const expected = process.env.RAILWAY_DB_TLS_SERVERNAME || 'localhost';
    return { ca, checkServerIdentity: (_host, cert) => tls.checkServerIdentity(expected, cert) };
  }
  if (process.env.RAILWAY_DB_INSECURE_SSL === '1') return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: sslConfig(), max: 2 });

const TARGETS = [
  {
    label: 'persons.profile_photo',
    countSql: `select count(*)::int as n from persons where strpos(profile_photo, $1) > 0`,
    updateSql: `update persons set profile_photo = replace(profile_photo, $1, $2) where strpos(profile_photo, $1) > 0`,
  },
  {
    label: 'persons.extra (photos / photoTags / media imbriqués)',
    countSql: `select count(*)::int as n from persons where extra is not null and strpos(extra::text, $1) > 0`,
    updateSql: `update persons set extra = replace(extra::text, $1, $2)::jsonb where extra is not null and strpos(extra::text, $1) > 0`,
  },
  {
    label: 'journal_entries.photos',
    countSql: `select count(*)::int as n from journal_entries where photos is not null and strpos(photos::text, $1) > 0`,
    updateSql: `update journal_entries set photos = replace(photos::text, $1, $2)::jsonb where photos is not null and strpos(photos::text, $1) > 0`,
  },
];

async function countAll(client, label) {
  console.log(`\n--- ${label} ---`);
  const counts = [];
  for (const t of TARGETS) {
    const { rows } = await client.query(t.countSql, [OLD_PREFIX]);
    const n = rows[0].n;
    counts.push(n);
    console.log(`  ${t.label} : ${n} ligne(s) concernée(s)`);
  }
  return counts;
}

async function main() {
  console.log('== Réécriture photos Supabase → R2 (Railway) ==');
  console.log(`Ancien préfixe : ${OLD_PREFIX}`);
  console.log(`Nouveau préfixe: ${NEW_PREFIX}`);
  console.log(`Dry-run        : ${DRY_RUN ? '1 (simulation, aucune écriture)' : '0 (écriture réelle)'}`);

  const client = await pool.connect();
  try {
    const before = await countAll(client, 'AVANT');
    const totalBefore = before.reduce((a, b) => a + b, 0);

    if (totalBefore === 0) {
      console.log('\n✅ Rien à réécrire — aucune URL avec cet ancien préfixe trouvée.');
      return;
    }

    if (DRY_RUN) {
      console.log('\n(dry-run : aucune écriture — relance avec DRY_RUN=0 pour appliquer réellement)');
      return;
    }

    console.log('\n--- Écriture (transaction) ---');
    await client.query('BEGIN');
    try {
      for (const t of TARGETS) {
        const res = await client.query(t.updateSql, [OLD_PREFIX, NEW_PREFIX]);
        console.log(`  ${t.label} : ${res.rowCount} ligne(s) mise(s) à jour`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const after = await countAll(client, 'APRÈS (doit être 0 partout)');
    const totalAfter = after.reduce((a, b) => a + b, 0);
    if (totalAfter === 0) {
      console.log('\n✅ Réécriture complète — plus aucune référence à l\'ancien préfixe.');
    } else {
      console.log(`\n⚠️  ${totalAfter} ligne(s) référencent encore l'ancien préfixe — à investiguer.`);
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Échec :', err.message);
  process.exitCode = 1;
});
