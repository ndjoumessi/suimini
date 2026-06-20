-- ============================================================================
-- CLEANUP — supprime les arbres « TEDA » du compte indiqué pour repartir propre.
-- À exécuter manuellement dans le SQL Editor Supabase.
-- Les persons / relationships / journal_entries CASCADENT automatiquement
-- (FK ... ON DELETE CASCADE), inutile de les supprimer à la main.
-- ============================================================================

-- 1) PRÉVISUALISATION — vérifiez ce qui sera supprimé AVANT de lancer le DELETE.
SELECT t.id, t.name, t.owner_id,
       (SELECT count(*) FROM public.persons p        WHERE p.tree_id = t.id) AS nb_persons,
       (SELECT count(*) FROM public.relationships r  WHERE r.tree_id = t.id) AS nb_relations
FROM public.trees t
WHERE t.name LIKE '%TEDA%'
  AND t.owner_id = (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr');

-- 2) SUPPRESSION (cascade vers persons / relationships / journal_entries).
DELETE FROM public.trees
WHERE name LIKE '%TEDA%'
  AND owner_id = (
    SELECT id FROM auth.users
    WHERE email = 'dromel902007@yahoo.fr'
  );

-- 3) Après ce nettoyage, ré-injectez proprement avec supabase/seed-teda-rpc.sql
--    en passant CE MÊME owner :
--      SELECT public.seed_teda_family(
--        (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr'));
--    (l'owner doit correspondre au compte connecté, sinon trees_select
--     — owner_id = auth.uid() — masque l'arbre et les 48 personnes ne s'affichent pas.)
-- ============================================================================
