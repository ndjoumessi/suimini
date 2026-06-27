-- =====================================================================
-- check-teda-completeness.sql — VÉRIFICATION (lecture seule) de l'arbre TEDA
-- =====================================================================
-- Objet : diagnostiquer si toutes les générations (0 → 6) sont bien présentes
--         en prod pour tree_id = 'teda1', afin de confirmer que l'absence de
--         la génération 6 côté app vient des DONNÉES (et non du front-end).
--
-- ⚠️ IMPORTANT — il n'existe PAS de colonne `generation` dans public.persons.
--    La génération n'est pas stockée : l'app la calcule depuis les relations
--    (`type = 'parent'`, person1_id = PARENT, person2_id = ENFANT) par parcours
--    de graphe. Ce script la recalcule donc en SQL via une CTE récursive.
--    (La mention « GEN n — … » dans `bio` est purement documentaire, non fiable
--    pour un comptage : on s'appuie sur les relations, source de vérité.)
--
--    Convention de génération ici : 0 = personnes sans parent connu dans l'arbre
--    (souche FOTIE + conjoints « entrés par alliance » sans ascendant saisi),
--    puis +1 à chaque lien parent→enfant. Le MAX(generation) reflète donc la
--    profondeur réelle des descendances (ce qu'on veut vérifier).
--
-- 100 % lecture seule (SELECT + CTE récursive). Ne modifie rien.
-- À lancer dans le SQL Editor Supabase.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Synthèse : nombre de personnes, génération max, nb de personnes en gén. 6
-- ---------------------------------------------------------------------
WITH RECURSIVE
parent_rel AS (
  SELECT person1_id AS parent_id, person2_id AS child_id
  FROM public.relationships
  WHERE tree_id = 'teda1' AND type = 'parent'
),
gen(person_id, generation) AS (
  -- Racines : personnes de l'arbre qui ne sont enfant d'aucune relation parent
  SELECT p.id, 0
  FROM public.persons p
  WHERE p.tree_id = 'teda1'
    AND NOT EXISTS (SELECT 1 FROM parent_rel pr WHERE pr.child_id = p.id)
  UNION ALL
  -- Descente : chaque enfant = génération du parent + 1 (garde-fou anti-boucle)
  SELECT pr.child_id, g.generation + 1
  FROM gen g
  JOIN parent_rel pr ON pr.parent_id = g.person_id
  WHERE g.generation < 50
),
gen_max AS (
  -- Une personne atteignable par plusieurs chemins → on garde sa profondeur max
  SELECT person_id, MAX(generation) AS generation
  FROM gen
  GROUP BY person_id
)
SELECT
  (SELECT COUNT(*) FROM public.persons WHERE tree_id = 'teda1')        AS total_persons,
  (SELECT COUNT(*) FROM gen_max)                                       AS persons_reachable,
  MAX(generation)                                                      AS max_generation,
  COUNT(*) FILTER (WHERE generation = 6)                               AS gen6_count
FROM gen_max;


-- ---------------------------------------------------------------------
-- 2) Nombre total de relations de l'arbre (toutes : parent + spouse)
-- ---------------------------------------------------------------------
SELECT
  COUNT(*)                                   AS total_relationships,
  COUNT(*) FILTER (WHERE type = 'parent')    AS parent_links,
  COUNT(*) FILTER (WHERE type = 'spouse')    AS spouse_links
FROM public.relationships
WHERE tree_id = 'teda1';


-- ---------------------------------------------------------------------
-- 3) Répartition par génération (combien de personnes à chaque niveau)
-- ---------------------------------------------------------------------
WITH RECURSIVE
parent_rel AS (
  SELECT person1_id AS parent_id, person2_id AS child_id
  FROM public.relationships
  WHERE tree_id = 'teda1' AND type = 'parent'
),
gen(person_id, generation) AS (
  SELECT p.id, 0
  FROM public.persons p
  WHERE p.tree_id = 'teda1'
    AND NOT EXISTS (SELECT 1 FROM parent_rel pr WHERE pr.child_id = p.id)
  UNION ALL
  SELECT pr.child_id, g.generation + 1
  FROM gen g
  JOIN parent_rel pr ON pr.parent_id = g.person_id
  WHERE g.generation < 50
),
gen_max AS (
  SELECT person_id, MAX(generation) AS generation
  FROM gen GROUP BY person_id
)
SELECT generation, COUNT(*) AS persons
FROM gen_max
GROUP BY generation
ORDER BY generation;


-- ---------------------------------------------------------------------
-- 4) Les 20 personnes les plus profondes (avec leur génération calculée)
-- ---------------------------------------------------------------------
WITH RECURSIVE
parent_rel AS (
  SELECT person1_id AS parent_id, person2_id AS child_id
  FROM public.relationships
  WHERE tree_id = 'teda1' AND type = 'parent'
),
gen(person_id, generation) AS (
  SELECT p.id, 0
  FROM public.persons p
  WHERE p.tree_id = 'teda1'
    AND NOT EXISTS (SELECT 1 FROM parent_rel pr WHERE pr.child_id = p.id)
  UNION ALL
  SELECT pr.child_id, g.generation + 1
  FROM gen g
  JOIN parent_rel pr ON pr.parent_id = g.person_id
  WHERE g.generation < 50
),
gen_max AS (
  SELECT person_id, MAX(generation) AS generation
  FROM gen GROUP BY person_id
)
SELECT p.id, p.first_name, p.last_name, gm.generation
FROM gen_max gm
JOIN public.persons p ON p.id = gm.person_id
ORDER BY gm.generation DESC, p.last_name, p.first_name
LIMIT 20;


-- ---------------------------------------------------------------------
-- 5) (Bonus) Personnes ORPHELINES de relation — ni parent, ni enfant, ni conjoint.
--    Utile pour repérer des membres importés mais jamais reliés (donc invisibles
--    dans la nav Focus, qui suit les liens).
-- ---------------------------------------------------------------------
SELECT p.id, p.first_name, p.last_name
FROM public.persons p
WHERE p.tree_id = 'teda1'
  AND NOT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.tree_id = 'teda1'
      AND (r.person1_id = p.id OR r.person2_id = p.id)
  )
ORDER BY p.last_name, p.first_name;
