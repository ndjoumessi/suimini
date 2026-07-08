-- ============================================================================
-- cleanup-extra-duplicates.sql
-- Hygiène OPTIONNELLE de `persons.extra` : retire de `extra` les clés qui ONT
-- désormais leur PROPRE colonne canonique, et UNIQUEMENT quand la colonne
-- contient déjà la valeur (aucune perte possible).
--
-- Contexte : à lancer MANUELLEMENT dans le SQL Editor Supabase (aucune
--   service_role key côté agent/CLI). IDEMPOTENT, ré-jouable à volonté.
--
-- ⚠️ POURQUOI CE SCRIPT EST « GARDÉ » (et pourquoi la version naïve est DANGEREUSE)
-- ─────────────────────────────────────────────────────────────────────────────
--   Le schéma `public.persons` N'A PAS de colonne `nickname`/`maiden_name` :
--   nickName, maidenName, nationality, religion, education, photos, events,
--   notes, sources, media, photoTags, aiNarrative, birthDateApprox,
--   deathDateApprox VIVENT LÉGITIMEMENT dans `extra` (catch-all, cf. schema.sql).
--   → Un `extra - 'nickName'` SUPPRIMERAIT DÉFINITIVEMENT le surnom (il n'y a
--     aucune colonne pour le recueillir). Ces clés NE DOIVENT JAMAIS être retirées.
--
--   Ce script ne retire donc QUE les clés « fantômes » qui dupliquent une
--   VRAIE colonne, et seulement si la colonne est déjà remplie (garde
--   `<col> IS NOT NULL`). Les mappers (rowToPerson : `extra` étalé EN PREMIER)
--   font déjà primer la colonne à la lecture ; ce nettoyage est purement
--   cosmétique (il évite qu'un `extra` pollué traîne). La prochaine sauvegarde
--   applicative d'une fiche ré-écrit `extra` sans ces clés (personToRow les
--   destructure hors de `extra`) → auto-guérison ; ce script accélère juste
--   la convergence côté serveur.
--
-- Portée : TOUS les arbres (la pollution `extra` est systémique, pas propre à
--   teda1). Aucun DELETE, aucun toucher à owner_id / trees / deleted_at.
-- ============================================================================

BEGIN;

-- Clés à colonne NON NULL par construction (toujours sûres si présentes dans extra) :
UPDATE public.persons SET extra = extra - 'updatedAt' WHERE extra ? 'updatedAt';
UPDATE public.persons SET extra = extra - 'createdAt' WHERE extra ? 'createdAt';
UPDATE public.persons SET extra = extra - 'id'        WHERE extra ? 'id';
UPDATE public.persons SET extra = extra - 'treeId'    WHERE extra ? 'treeId';
UPDATE public.persons SET extra = extra - 'isAlive'   WHERE extra ? 'isAlive';

-- Clés à colonne NULLABLE : on ne retire de `extra` QUE si la colonne porte déjà
-- la valeur (sinon on garderait la seule copie existante dans extra).
UPDATE public.persons SET extra = extra - 'firstName'    WHERE extra ? 'firstName'    AND first_name    <> '';
UPDATE public.persons SET extra = extra - 'lastName'     WHERE extra ? 'lastName'     AND last_name     <> '';
UPDATE public.persons SET extra = extra - 'gender'       WHERE extra ? 'gender'       AND gender        IS NOT NULL;
UPDATE public.persons SET extra = extra - 'birthDate'    WHERE extra ? 'birthDate'    AND birth_date    IS NOT NULL;
UPDATE public.persons SET extra = extra - 'birthPlace'   WHERE extra ? 'birthPlace'   AND birth_place   IS NOT NULL;
UPDATE public.persons SET extra = extra - 'deathDate'    WHERE extra ? 'deathDate'    AND death_date    IS NOT NULL;
UPDATE public.persons SET extra = extra - 'deathPlace'   WHERE extra ? 'deathPlace'   AND death_place   IS NOT NULL;
UPDATE public.persons SET extra = extra - 'occupation'   WHERE extra ? 'occupation'   AND occupation    IS NOT NULL;
UPDATE public.persons SET extra = extra - 'bio'          WHERE extra ? 'bio'          AND bio           IS NOT NULL;
UPDATE public.persons SET extra = extra - 'profilePhoto' WHERE extra ? 'profilePhoto' AND profile_photo IS NOT NULL;
UPDATE public.persons SET extra = extra - 'dnaOrigins'   WHERE extra ? 'dnaOrigins'   AND dna_origins   IS NOT NULL;
UPDATE public.persons SET extra = extra - 'citations'    WHERE extra ? 'citations'    AND citations     IS NOT NULL;
UPDATE public.persons SET extra = extra - 'customFields' WHERE extra ? 'customFields' AND custom_fields IS NOT NULL;
UPDATE public.persons SET extra = extra - 'tags'         WHERE extra ? 'tags'         AND tags          IS NOT NULL;
UPDATE public.persons SET extra = extra - 'privacy'      WHERE extra ? 'privacy'      AND privacy       IS NOT NULL;

-- Normalise les `extra` devenus vides ({}), pour rester cohérent avec l'écriture
-- applicative (extra = null quand il ne reste aucune clé non normalisée).
UPDATE public.persons SET extra = NULL WHERE extra = '{}'::jsonb;

COMMIT;

-- ============================================================================
-- VÉRIFICATION — clés canoniques encore présentes dans un `extra` (attendu : 0) :
-- ============================================================================
SELECT id, first_name, last_name,
       (SELECT array_agg(k) FROM jsonb_object_keys(extra) k
        WHERE k IN ('updatedAt','createdAt','id','treeId','isAlive','firstName',
                    'lastName','gender','birthDate','birthPlace','deathDate',
                    'deathPlace','occupation','bio','profilePhoto','dnaOrigins',
                    'citations','customFields','tags','privacy')) AS residual_canonical_keys
FROM public.persons
WHERE extra IS NOT NULL
  AND extra ?| array['updatedAt','createdAt','id','treeId','isAlive','firstName',
                     'lastName','gender','birthDate','birthPlace','deathDate',
                     'deathPlace','occupation','bio','profilePhoto','dnaOrigins',
                     'citations','customFields','tags','privacy'];
