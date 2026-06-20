-- ============================================================================
-- FIX — « loadTreesFromSupabase ne charge que 2 personnes au lieu de 49 »
--
-- Ce N'EST PAS une limite de requête ni la RLS de `persons` :
--   * la requête est `from('persons').select('*').in('tree_id', treeIds)` — aucun
--     LIMIT, aucun JOIN tronquant ;
--   * `persons_select` = can_read_tree(tree_id) est uniforme par arbre (tout ou
--     rien), donc ne peut pas renvoyer 2 lignes sur 49 pour un même arbre.
--
-- Le filtrage se fait UN CRAN PLUS HAUT, sur `trees` : `trees_select` n'expose
-- que les arbres où owner_id = auth.uid(). Si l'arbre 'teda1' a été créé en SQL
-- avec un owner_id ≠ ton compte connecté, 'teda1' est exclu de treeIds → AUCUNE
-- de ses 49 personnes n'est chargée. Les 2 personnes visibles viennent d'un AUTRE
-- arbre que tu possèdes. Corriger persons_select ne changerait donc rien.
--
-- À exécuter dans le SQL Editor. Remplace l'email par le tien si besoin.
-- ============================================================================

-- 1) DIAGNOSTIC — qui possède quoi, et combien de personnes par arbre TEDA ?
SELECT t.id, t.name, t.owner_id,
       (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr') AS my_uid,
       t.owner_id = (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr') AS owner_ok,
       (SELECT count(*) FROM public.persons p WHERE p.tree_id = t.id) AS nb_persons
FROM public.trees t
WHERE t.name ILIKE '%TEDA%' OR t.id = 'teda1';

-- 2) FIX — réattribue 'teda1' au compte connecté pour que trees_select l'expose
--    (et donc que ses 49 personnes se chargent). N'affecte que cet arbre.
UPDATE public.trees
SET owner_id = (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr')
WHERE id = 'teda1';

-- 3) VÉRIFICATION — après le fix, owner_ok doit être true et nb_persons = 49.
SELECT t.id, t.name,
       t.owner_id = (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr') AS owner_ok,
       (SELECT count(*) FROM public.persons p WHERE p.tree_id = t.id) AS nb_persons
FROM public.trees t
WHERE t.id = 'teda1';

-- Si nb_persons est encore faible (≈2) APRÈS le fix d'owner : le seed n'a pas été
-- appliqué → lancer supabase/seed-teda-rpc.sql avec le bon owner :
--   SELECT public.seed_teda_family(
--     (SELECT id FROM auth.users WHERE email = 'dromel902007@yahoo.fr'));
-- ============================================================================
