# Migrations versionnées Suimini

Fin du « copier-coller dans le SQL Editor ». Les changements de **schéma** vivent
ici en fichiers ordonnés `NNNN_description.sql`, appliqués automatiquement par
`scripts/migrate.mjs` et suivis dans la table `public.suimini_migrations`.

> ⚠️ **Schéma seulement.** Les corrections de **données** (surnoms, ordre des
> enfants…) passent par l'app (**Réglages › Données › Éditer surnoms**), pas par
> une migration. Voir `BulkDataModal`.

## Pourquoi un runner privilégié (et pas « au démarrage de l'app »)

Le runtime de l'app n'a que la **clé anon** : elle ne peut **pas** exécuter de DDL
(`CREATE TABLE`/`POLICY`/`FUNCTION`) — c'est l'archi anon-key + RLS. Les migrations
s'appliquent donc là où un accès privilégié existe déjà : **la CI** (workflow
`.github/workflows/migrate.yml`), via la **Management API** avec
`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_ID` (les **mêmes** secrets que
`backup-db.yml`). **Jamais de `service_role` dans le runtime app / Vercel.**

## Écrire une migration

1. Créer `supabase/migrations/NNNN_ma_migration.sql` (N = prochain numéro).
2. **Idempotente** : `create … if not exists`, `add column if not exists`,
   `create or replace`. Filet si elle est rejouée.
3. **PAS de `BEGIN`/`COMMIT`** dans le fichier : le runner enveloppe chaque
   migration dans **une transaction** avec l'insertion du marqueur (atomique →
   une migration à moitié appliquée n'est jamais marquée « appliquée »).
4. Pousser sur `main` → la CI applique les migrations en attente.

## Commandes (local / manuel)

```bash
# Local (Postgres jetable ou base de test) :
export DATABASE_URL="postgres://…"
node scripts/migrate.mjs status     # appliquées / en attente
node scripts/migrate.mjs up         # applique les en attente
node scripts/migrate.mjs baseline   # marque TOUT appliqué SANS exécuter

# CI / prod (pas de DATABASE_URL) :
export SUPABASE_ACCESS_TOKEN="…"; export SUPABASE_PROJECT_ID="…"
node scripts/migrate.mjs up
```

## Adoption sur la prod existante (à faire UNE fois)

La prod a déjà tout le schéma (les 18 anciens `supabase/*.sql` lancés à la main).
Deux options, toutes deux sûres car les migrations `0001`/`0002` sont idempotentes :

- **Recommandé — baseline** : `node scripts/migrate.mjs baseline` (via
  `workflow_dispatch` du workflow, ou en local avec le token) → marque `0001`/`0002`
  « appliquées » **sans** les exécuter. Ensuite seules les **nouvelles** migrations tournent.
- **Ou laisser `up`** : comme `0001`/`0002` sont idempotentes, un `up` direct ne
  fait que des no-ops (`create if not exists`, `add column if not exists`) et les enregistre.

## Rollback

Postgres **n'a pas de rollback automatique** de DDL déjà commit. Stratégie :

1. **Filet de sécurité amont** : `backup-db.yml` sauvegarde toutes les tables
   chaque nuit (30 j d'artifacts). Une migration destructrice ⇒ restaurer depuis
   l'artifact via le SQL Editor.
2. **Migration inverse** : pour annuler `NNNN`, écrire une **nouvelle** migration
   `MMMM_revert_NNNN.sql` qui défait le changement (ex. `drop column …`,
   `drop policy …`). On n'édite JAMAIS une migration déjà appliquée : on en ajoute
   une nouvelle. Retirer aussi la ligne de `suimini_migrations` si on veut rejouer
   l'originale : `delete from public.suimini_migrations where name = 'NNNN_…';`.
3. **Architecture soft-delete** : aucune migration n'émet de `DELETE` sur
   persons/relationships/journal — une sur-suppression reste récupérable
   (`set deleted_at = null`).

## Portage des anciens `supabase/*.sql` (fait)

Les **14 scripts de SCHÉMA** ont été portés en migrations versionnées, ordonnées
par dépendance (source d'origine conservée sous `supabase/` pour l'historique) :

| # | Migration | Rôle |
|---|-----------|------|
| 0003 | `schema` | base (profiles, trees, persons, relationships, journal, RLS, triggers) |
| 0004 | `soft_delete` | colonnes `deleted_at` + `purge_tombstones()` |
| 0005 | `rate_limits` | `api_rate_limits` + `consume_rate_limit` |
| 0006 | `storage` | bucket `avatars` + RLS |
| 0007 | `push_tokens` | tokens Expo |
| 0008 | `push_subscriptions` | web push |
| 0009 | `share_public` | partage public (colonnes/policies sur `trees`) |
| 0010 | `sharing` | `tree_members` (⚠️ avant 0011–0013 qui le référencent) |
| 0011 | `sharing_token` | jetons d'invitation |
| 0012 | `collaboration` | `person_comments`, `person_suggestions` |
| 0013 | `collaboration_rpc` | RPC membres/invitations |
| 0014 | `documents` | `scanned_documents` |
| 0015 | `photo_tags` | `photo_tags` |
| 0016 | `birthday_cron` | pg_cron + pg_net (planif. anniversaires) |

Tous **idempotents à l'application** (DDL `drop-if-exists`/`create-or-replace`/
`if-not-exists` ; la DML éventuelle est dans des **corps de fonction**, exécutée à
l'appel, pas à l'application) et sans `BEGIN/COMMIT` (le runner enveloppe).

### ⚠️ Adoption : `baseline` d'abord

Ces 14 sont **déjà en prod**. Après leur ajout, lancer **UNE fois** le workflow
*Apply DB Migrations* en `workflow_dispatch` avec **`command = baseline`** → les
marque appliquées **sans les rejouer**. (Un `up` les ré-appliquerait ; c'est
non destructif car idempotent, mais inutile et ça peut faire échouer 0016 si
pg_cron/secret diffèrent. Préférer `baseline`.)

### Scripts NON portés (volontaire) — données, pas schéma

`seed-admin.sql` (seed d'un admin), `cleanup-demo-tree.sql` (purge démo) et
`cleanup-extra-duplicates.sql` (hygiène `extra`) contiennent de la **DML
top-niveau qui MUTE des données** et sont **spécifiques à un environnement /
one-off**. Les versionner comme migrations laisserait la CI (`up`) les rejouer et
**corrompre/re-seeder** la prod. Ils restent des scripts manuels documentés sous
`supabase/` (déjà appliqués). Les corrections de données courantes passent par
l'app (**Réglages › Données › Éditer surnoms**, `BulkDataModal`).

## Validation locale avant livraison

Le runner a été validé sur un Postgres jetable (`initdb`/`pg_ctl`) : `status`
détecte les en attente, `up` applique dans l'ordre + enregistre + est idempotent au
rejeu, `baseline` marque sans exécuter. Reproduire avec `DATABASE_URL` sur une base
locale avant de pousser une migration sensible (cf. « Pièges connus » de CLAUDE.md).
