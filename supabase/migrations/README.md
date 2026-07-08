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

## Validation locale avant livraison

Le runner a été validé sur un Postgres jetable (`initdb`/`pg_ctl`) : `status`
détecte les en attente, `up` applique dans l'ordre + enregistre + est idempotent au
rejeu, `baseline` marque sans exécuter. Reproduire avec `DATABASE_URL` sur une base
locale avant de pousser une migration sensible (cf. « Pièges connus » de CLAUDE.md).
