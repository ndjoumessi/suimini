-- ============================================================================
-- BRANCHE ÉTENDUE — rattachements (TEMPLATE À COMPLÉTER)
--
-- ⚠️ Les 11 personnes ci-dessous (teda-p38 → teda-p48) sont en base SANS lien de
-- parenté confirmé (« à préciser »). Ce fichier NE crée AUCUN lien tel quel :
-- tout est COMMENTÉ. Les blocs « Hypothèse » sont des pistes déduites des
-- patronymes — à CONFIRMER avant de décommenter. N'applique que ce que tu sais
-- vrai. Convention : type 'parent' → person1 = PARENT, person2 = ENFANT ;
-- type 'spouse' → les deux conjoints. ids de relations : teda-r57+.
-- ============================================================================

-- ── 0) AIDE — liste des personnes pour choisir les ids parent/conjoint ──────
-- SELECT id, first_name, last_name, gender, birth_date
-- FROM public.persons WHERE tree_id = 'teda1' ORDER BY id;

-- Personnes de la branche étendue (rappel) :
--   teda-p38 DJOUMESSI Mathias   (1956, H)
--   teda-p39 AKITIO Geneviève    (1953, F)
--   teda-p40 DONFAKA Hortense    (1972, F)
--   teda-p41 GAOHO Simplice      (1971, H)
--   teda-p42 KADJIO Augustin     (1958, H)
--   teda-p43 KENGO Dieudonné     (1964, H)
--   teda-p44 NAMPA Léonie        (1967, F)
--   teda-p45 TSANA Hégène        (1968, H)
--   teda-p46 ZEKENG Delphine     (1969, F)
--   teda-p47 ZEKENG Lucienne     (~1945, F)
--   teda-p48 GUEMESIO Lucie      (1983, F)

-- ════════════════════════════════════════════════════════════════════════════
-- A) HYPOTHÈSES par patronyme (à CONFIRMER — décommente si exact)
-- ════════════════════════════════════════════════════════════════════════════
-- Ces liens ne sont PAS prouvés : ils s'appuient uniquement sur le même nom de
-- famille qu'un membre déjà rattaché. Vérifie chaque cas avant d'exécuter.

-- ZEKENG : teda-p25 « ZEKENG » (enfant de TEDA × DONGMO Tejioguim, gen 4) pourrait
-- être le parent de ZEKENG Delphine (p46) et/ou ZEKENG Lucienne (p47).
-- INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active) VALUES
--   ('teda-r57', 'teda1', 'parent', 'teda-p25', 'teda-p46', true),  -- ZEKENG → Delphine ?
--   ('teda-r58', 'teda1', 'parent', 'teda-p25', 'teda-p47', true)   -- ZEKENG → Lucienne ?
-- ON CONFLICT (id) DO NOTHING;

-- TSANA : TSANA Hégène (p45) pourrait descendre de la branche TSANA
-- (teda-p21 TSANA Wamba Tchoupa, ou teda-p36 TSANA Sébastien).
-- INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active) VALUES
--   ('teda-r59', 'teda1', 'parent', 'teda-p36', 'teda-p45', true)   -- TSANA Sébastien → Hégène ?
-- ON CONFLICT (id) DO NOTHING;

-- KADJIO : KADJIO Augustin (p42) pourrait descendre de teda-p16 « KADJIO »
-- (fille de TEDA × MESSE).
-- INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active) VALUES
--   ('teda-r60', 'teda1', 'parent', 'teda-p16', 'teda-p42', true)   -- KADJIO → Augustin ?
-- ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- B) TEMPLATE GÉNÉRIQUE (aucune hypothèse — remplace <PARENT_ID>/<CONJOINT_ID>)
-- ════════════════════════════════════════════════════════════════════════════
-- Pour chaque personne dont tu connais le lien, copie la ligne utile, remplace
-- l'id du parent (ou du conjoint) et l'id de relation, puis décommente.
--
-- Lien parent→enfant : ('teda-rNN','teda1','parent','<PARENT_ID>','teda-pXX', true)
-- Lien conjoint↔conjoint : ('teda-rNN','teda1','spouse','teda-pXX','<CONJOINT_ID>', true)
--
-- INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active) VALUES
--   ('teda-r61', 'teda1', 'parent', '<PARENT_ID>', 'teda-p38', true),  -- DJOUMESSI Mathias
--   ('teda-r62', 'teda1', 'parent', '<PARENT_ID>', 'teda-p39', true),  -- AKITIO Geneviève
--   ('teda-r63', 'teda1', 'parent', '<PARENT_ID>', 'teda-p40', true),  -- DONFAKA Hortense
--   ('teda-r64', 'teda1', 'parent', '<PARENT_ID>', 'teda-p41', true),  -- GAOHO Simplice
--   ('teda-r65', 'teda1', 'parent', '<PARENT_ID>', 'teda-p43', true),  -- KENGO Dieudonné
--   ('teda-r66', 'teda1', 'parent', '<PARENT_ID>', 'teda-p44', true),  -- NAMPA Léonie
--   ('teda-r67', 'teda1', 'parent', '<PARENT_ID>', 'teda-p48', true)   -- GUEMESIO Lucie
-- ON CONFLICT (id) DO NOTHING;

-- ── Couples éventuels au sein de la branche (ex. si deux d'entre eux mariés) ─
-- INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active) VALUES
--   ('teda-r68', 'teda1', 'spouse', 'teda-pXX', 'teda-pYY', true)
-- ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Après application : clique « ↻ Synchroniser » dans l'app, puis les nœuds
-- s'afficheront reliés dans l'arbre (et plus seulement en vue Liste).
-- Note : un nœud sans relation reste visible en Liste mais isolé dans l'arbre.
-- ============================================================================
