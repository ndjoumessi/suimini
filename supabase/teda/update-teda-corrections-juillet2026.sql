-- ============================================================================
-- update-teda-corrections-juillet2026.sql
-- TEDA (tree_id = 'teda1') — RÉCUPÉRATION de corrections perdues lors de
-- l'incident Supabase du 5 juillet 2026. Corrections confirmées VISUELLEMENT
-- par le propriétaire (juillet 2026) :
--   • MESSE (teda-p11)            → surnom (nickName) = « Jiedong de Kopte »
--   • TSANA Sébastien (teda-p36)  → surnom (nickName) = « Wamba Tchoupa I »
--   • DONGHOCK (teda-p12)         → alias « Kemdong » (voir décision ci-dessous)
--
-- Contexte : à lancer MANUELLEMENT dans le SQL Editor Supabase (rôle privilégié
--   → RLS contournée ; aucune service_role key n'existe côté agent/CLI, donc
--   l'exécution ne peut PAS être automatisée).
--
-- Portée / garanties :
--   • IDEMPOTENT : re-jouable à volonté, même résultat (jsonb_set écrit toujours
--     la même valeur ; updated_at = now() à chaque passage — voulu).
--   • Ne touche QUE `extra.nickName` + `updated_at`, et UNIQUEMENT tree_id='teda1'.
--   • jsonb_set(..., true) PRÉSERVE toutes les autres clés de `extra`
--     (maidenName, events, etc.) et ne fait qu'ajouter/mettre à jour `nickName`.
--   • Le surnom (NOM/alias) va dans SA place = `extra.nickName` (champ non
--     normalisé), JAMAIS dans une colonne canonique. Le web l'affiche en 3ᵉ
--     ligne (nickName), cf. nodeStyle.ts / FocusTree / TreeView / PrintModal.
--   • Convention de noms TEDA respectée en lecture : first_name = NOM (famille),
--     last_name = prénom (ex. ('TSANA','Sébastien')). On CIBLE PAR `id` (stable,
--     non ambigu) — un WHERE par nom serait fragile (5 rows TSANA : p21, p36,
--     p45, p56, p62 ; on veut UNIQUEMENT p36 = Sébastien).
--   • Aucune suppression, aucun DELETE, aucun toucher à owner_id ni à
--     public.trees. Architecture soft-delete : ce sont de purs UPDATE, donc pas
--     de tombstone à gérer ici.
--
-- DÉCISION DONGHOCK (teda-p12) :
--   La bio existante (RESTORE_TEDA_FROM_EXPORT.sql) porte déjà l'alias :
--   « 2ème épouse de TEDA (alias KEMDONG). » → l'information « Kemdong » est
--   DÉJÀ présente. On ne réécrit donc PAS la bio et on n'ajoute PAS de nickName
--   redondant : on se contente de BUMPER updated_at (touch), pour marquer la
--   ligne comme revue lors de cette récupération et la faire remonter dans
--   « Dernières modifications ». (Si le propriétaire préfère un vrai surnom
--   affiché en 3ᵉ ligne, décommenter la variante nickName ci-dessous.)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) MESSE (teda-p11) → nickName = « Jiedong de Kopte »
-- ─────────────────────────────────────────────────────────────────────────────
-- AVANT
SELECT 'MESSE (avant)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_before
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p11';

UPDATE public.persons
SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{nickName}', '"Jiedong de Kopte"'::jsonb, true),
    updated_at = now()
WHERE tree_id = 'teda1' AND id = 'teda-p11';

-- APRÈS
SELECT 'MESSE (après)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_after
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p11';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) TSANA Sébastien (teda-p36) → nickName = « Wamba Tchoupa I »
--    (⚠️ NE PAS confondre avec teda-p21 = TSANA Wamba Tchoupa, son PÈRE)
-- ─────────────────────────────────────────────────────────────────────────────
-- AVANT
SELECT 'TSANA Sébastien (avant)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_before
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p36';

UPDATE public.persons
SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{nickName}', '"Wamba Tchoupa I"'::jsonb, true),
    updated_at = now()
WHERE tree_id = 'teda1' AND id = 'teda-p36';

-- APRÈS
SELECT 'TSANA Sébastien (après)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_after
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p36';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) DONGHOCK (teda-p12) → alias « Kemdong » DÉJÀ dans la bio → simple touch
-- ─────────────────────────────────────────────────────────────────────────────
-- AVANT (on montre aussi la bio pour vérifier que « KEMDONG » y figure déjà)
SELECT 'DONGHOCK (avant)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_before, bio
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p12';

-- Bio porte déjà « (alias KEMDONG) » → on ne fait QUE bumper updated_at.
UPDATE public.persons
SET updated_at = now()
WHERE tree_id = 'teda1' AND id = 'teda-p12';

-- APRÈS
SELECT 'DONGHOCK (après)' AS etape, id, first_name, last_name, extra->>'nickName' AS nickname_after, bio
FROM public.persons WHERE tree_id = 'teda1' AND id = 'teda-p12';

-- ── VARIANTE (optionnelle) — si le propriétaire veut un surnom AFFICHÉ (3ᵉ ligne)
--    plutôt que l'alias noyé dans la bio, décommenter :
-- UPDATE public.persons
-- SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{nickName}', '"Kemdong"'::jsonb, true),
--     updated_at = now()
-- WHERE tree_id = 'teda1' AND id = 'teda-p12';

COMMIT;

-- ============================================================================
-- VÉRIFICATION GLOBALE (les 3 lignes touchées) — nickName attendu :
--   teda-p11 MESSE            → Jiedong de Kopte
--   teda-p36 TSANA Sébastien  → Wamba Tchoupa I
--   teda-p12 DONGHOCK         → (NULL) [alias resté dans la bio]
-- ============================================================================
SELECT id, first_name, last_name, extra->>'nickName' AS nickname
FROM public.persons
WHERE tree_id = 'teda1' AND id IN ('teda-p11', 'teda-p36', 'teda-p12')
ORDER BY id;
