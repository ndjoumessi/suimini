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

-- 3) Après ce nettoyage, restaurez proprement avec
--    supabase/teda/RESTORE_TEDA_FROM_EXPORT.sql (source de vérité, 57 pers./93 rel.,
--    ou 71/119 si vous rejouez aussi update-teda-djoumessi-family.sql ensuite),
--    en passant CE MÊME owner_id.
--    (l'owner doit correspondre au compte connecté, sinon trees_select
--     — owner_id = auth.uid() — masque l'arbre et les personnes ne s'affichent pas.)
-- ============================================================================
