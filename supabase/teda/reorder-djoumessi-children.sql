-- ============================================================================
-- reorder-djoumessi-children.sql
-- TEDA (tree_id = 'teda1') — Réordonne les 12 enfants de DJOUMESSI Mathias
-- (teda-p38) par ORDRE D'ÂGE. Dans l'app, l'ordre d'affichage des frères/sœurs
-- est déterminé par `birth_date` (colonne TEXT, format 'YYYY-MM-DD'). Le mois
-- départage les naissances d'une même année.
--
-- Contexte : à lancer MANUELLEMENT dans le SQL Editor Supabase (aucune
--   service_role key côté agent/CLI → exécution non automatisable).
--
-- Portée / garanties :
--   • IDEMPOTENT : re-jouable à volonté (mêmes valeurs → même résultat ;
--     updated_at = now() à chaque passage, voulu pour « Dernières modifications »).
--   • Ne touche QUE `birth_date` (+ `updated_at`), ciblage PAR `id` (stable),
--     UNIQUEMENT tree_id = 'teda1'. Aucun DELETE, aucun toucher à owner_id / trees.
--   • Convention TEDA respectée en lecture : first_name = NOM, last_name = prénom
--     (ex. ('TIOTSIA','Luc Mirabeau'), ('DJOUMESSI','Romel Nelson')).
--
-- Les 12 enfants (2 mères : teda-p59 KENFACK Lucienne, teda-p60 MAGNIFEUT
-- Marie Pascale) partagent le même père teda-p38 → ils s'INTERCALENT par âge
-- dans l'arbre, toutes mères confondues. Ordre chronologique cible :
--   1984-01-01  teda-p61  TIOTSIA Luc Mirabeau
--   1986-01-01  teda-p62  TSANA Arnauld
--   1988-01-01  teda-p68  SOKENG Francis
--   1989-01-01  teda-p63  LEKOGUIA Anne Marie      (avant Romel)
--   1989-07-01  teda-p69  DJOUMESSI Romel Nelson   (après Anne Marie)
--   1992-01-01  teda-p70  NANGMO Merlin
--   1993-01-01  teda-p64  TEKEUGUETSOP Dorese
--   1993-07-01  teda-p65  TSAGUE Martial
--   1996-01-01  teda-p71  DONGMO Jean Michel       (⚠ 1996 < 1997 → AVANT Rebecca)
--   1997-01-01  teda-p66  FEUDJIO Rebecca          (⚠ après Jean Michel, cf. dates)
--   2001-01-01  teda-p72  AZEKENG Anderson         (avant Vitaly)
--   2001-07-01  teda-p67  DJOUMESSI KENFACK Vitaly (après Anderson)
--
-- ⚠ NOTE Rebecca (p66) / Jean Michel (p71) : la liste fournie citait Rebecca
--   AVANT Jean Michel, mais les dates fournies (Rebecca 1997, Jean Michel 1996)
--   donnent l'ordre INVERSE (Jean Michel plus âgé → affiché en premier). Ce
--   script applique les DATES telles quelles. Pour afficher Rebecca en premier,
--   remplacer sa date par une valeur < celle de Jean Michel (ex. '1995-01-01').
-- ============================================================================

BEGIN;

-- ── AVANT (ordre actuel affiché = tri par birth_date) ────────────────────────
SELECT 'AVANT' AS etape, id, first_name, last_name, birth_date
FROM public.persons
WHERE tree_id = 'teda1'
  AND id IN ('teda-p61','teda-p62','teda-p63','teda-p64','teda-p65','teda-p66',
             'teda-p67','teda-p68','teda-p69','teda-p70','teda-p71','teda-p72')
ORDER BY birth_date NULLS LAST, id;

-- ── UPDATE birth_date (ordre d'âge) ──────────────────────────────────────────
-- Enfants DJOUMESSI Mathias × KENFACK Lucienne (teda-p59)
UPDATE public.persons SET birth_date = '1984-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p61'; -- TIOTSIA Luc Mirabeau
UPDATE public.persons SET birth_date = '1986-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p62'; -- TSANA Arnauld
UPDATE public.persons SET birth_date = '1989-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p63'; -- LEKOGUIA Anne Marie
UPDATE public.persons SET birth_date = '1993-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p64'; -- TEKEUGUETSOP Dorese
UPDATE public.persons SET birth_date = '1993-07-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p65'; -- TSAGUE Martial
UPDATE public.persons SET birth_date = '1997-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p66'; -- FEUDJIO Rebecca
UPDATE public.persons SET birth_date = '2001-07-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p67'; -- DJOUMESSI KENFACK Vitaly

-- Enfants DJOUMESSI Mathias × MAGNIFEUT Marie Pascale (teda-p60)
UPDATE public.persons SET birth_date = '1988-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p68'; -- SOKENG Francis
UPDATE public.persons SET birth_date = '1989-07-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p69'; -- DJOUMESSI Romel Nelson
UPDATE public.persons SET birth_date = '1992-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p70'; -- NANGMO Merlin
UPDATE public.persons SET birth_date = '1996-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p71'; -- DONGMO Jean Michel
UPDATE public.persons SET birth_date = '2001-01-01', updated_at = now() WHERE tree_id = 'teda1' AND id = 'teda-p72'; -- AZEKENG Anderson

COMMIT;

-- ============================================================================
-- VÉRIFICATION — ordre d'affichage résultant (doit suivre la liste ci-dessus) :
-- ============================================================================
SELECT 'APRES' AS etape,
       row_number() OVER (ORDER BY birth_date NULLS LAST, id) AS rang,
       id, first_name, last_name, birth_date
FROM public.persons
WHERE tree_id = 'teda1'
  AND id IN ('teda-p61','teda-p62','teda-p63','teda-p64','teda-p65','teda-p66',
             'teda-p67','teda-p68','teda-p69','teda-p70','teda-p71','teda-p72')
ORDER BY birth_date NULLS LAST, id;
