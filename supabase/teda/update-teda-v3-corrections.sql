-- ============================================================================
-- TEDA (FOTIE) — MISE À JOUR « V3 CORRECTIONS » de l'arbre 'teda1' en production
-- Corrections familiales du 22 juin 2026 (suite de update-teda-v2-final.sql).
--
-- Résumé des corrections intégrées :
--   1. MEFOUEGONG confirmée (la graphie « MERQUEGON » n'existe pas → purge si présente).
--   2. GNINZEKO : prénom chrétien « Gaston » CONFIRMÉ (plus « à confirmer »).
--   3. MEZEKENG / METSAGHO / MEGNIGUE : parenté MO'O SOUKA × METIOLO confirmée.
--   4. Génération 0 : TEFOUETZAP × MAFOKO → METIOLO confirmés.
--   5. TSANA Sébastien (teda-p36) : structuration en 3 ÉPOUSES + nouveaux enfants
--      (DONGMO Madeleine, GUEDIA Régine, DONGMO Julienne) — ajout des relations
--      « mère → enfant » pour TOUS ses enfants + 6 nouveaux membres.
--   6. Enfants de TEDA FOTIE : bios enrichies pour nommer la mère (MESSE / DONGHOCK).
--
-- Effet net attendu : 49 → 58 personnes (teda-p50..p58), 67 → 94 relations
--   (teda-r68..r94). Aucune suppression (hormis une éventuelle fiche « MERQUEGON »
--   parasite, qui n'existe pas en base v2). Script idempotent et ré-exécutable.
--
-- EXÉCUTION (au choix) :
--   • Supabase Dashboard → SQL Editor → coller ce fichier → Run  (recommandé).
--   • supabase db execute --file supabase/teda/update-teda-v3-corrections.sql
--   • psql "$DATABASE_URL" -f supabase/teda/update-teda-v3-corrections.sql
-- Le SQL Editor s'exécute en rôle privilégié → la RLS est contournée nativement.
-- ============================================================================

-- ── PREVIEW (état AVANT modification) ──────────────────────────────────────
SELECT 'AVANT — persons'       AS objet, count(*) AS total FROM public.persons       WHERE tree_id = 'teda1'
UNION ALL
SELECT 'AVANT — relationships' AS objet, count(*) AS total FROM public.relationships WHERE tree_id = 'teda1'
UNION ALL
SELECT 'AVANT — épouses TSANA Sébastien (spouse de teda-p36)', count(*)::int
  FROM public.relationships
  WHERE tree_id = 'teda1' AND type = 'spouse' AND (person1_id = 'teda-p36' OR person2_id = 'teda-p36')
UNION ALL
SELECT 'AVANT — fiche MERQUEGON parasite', count(*)::int
  FROM public.persons WHERE tree_id = 'teda1' AND upper(first_name) LIKE 'MERQUEGON%';
-- Attendu AVANT (depuis v2) : persons=49, relationships=67, épouses Sébastien=0, MERQUEGON=0.

DO $$
DECLARE
  v_owner uuid;
BEGIN
  -- Résoudre le propriétaire par email (pas d'UID en dur), pour la maj des métadonnées.
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = lower('dromel902007@yahoo.fr');
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Compte dromel902007@yahoo.fr introuvable dans auth.users — créez-le d''abord.';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────
  -- 1) MEFOUEGONG (teda-p10) — confirmer l'identité ; purger « MERQUEGON ».
  --    MEFOUEGONG est déjà en base (genre female, parents MEGNIGUE × Fo'o GAPGHO,
  --    donc sœur de TEDA FOTIE). On verrouille genre + bio.
  -- ──────────────────────────────────────────────────────────────────────
  UPDATE public.persons SET
    gender = 'female',
    bio = 'Sœur de TEDA FOTIE.
Fille de MEGNIGUE et du Chef Fo''o GAPGHO.
Mariée à KEMDONHAGHO. Décédée sans descendance.
Graphie correcte : MEFOUEGONG (la forme « MERQUEGON » est erronée).',
    updated_at = now()
  WHERE id = 'teda-p10' AND tree_id = 'teda1';

  -- Purge défensive d'une éventuelle fiche « MERQUEGON » parasite (et ses relations).
  DELETE FROM public.relationships
   WHERE tree_id = 'teda1'
     AND (person1_id IN (SELECT id FROM public.persons WHERE tree_id='teda1' AND upper(first_name) LIKE 'MERQUEGON%')
       OR person2_id IN (SELECT id FROM public.persons WHERE tree_id='teda1' AND upper(first_name) LIKE 'MERQUEGON%'));
  DELETE FROM public.persons
   WHERE tree_id = 'teda1' AND upper(first_name) LIKE 'MERQUEGON%';

  -- ──────────────────────────────────────────────────────────────────────
  -- 2) GNINZEKO (teda-p23) — prénom chrétien « Gaston » CONFIRMÉ.
  --    Convention de l'arbre : nom de famille → first_name, prénom → last_name
  --    (cf. DJOUMESSI/Mathias). « Gaston » reste donc en last_name.
  -- ──────────────────────────────────────────────────────────────────────
  UPDATE public.persons SET
    last_name = 'Gaston',
    bio = 'Fils de TEDA FOTIE et DONGMO Tejioguim (3e épouse).
Né vers 1928. Prénom chrétien « Gaston » confirmé (correction du 22 juin 2026).',
    updated_at = now()
  WHERE id = 'teda-p23' AND tree_id = 'teda1';

  -- ──────────────────────────────────────────────────────────────────────
  -- 5a) NOUVELLES PERSONNES — 3 épouses de TSANA Sébastien + 6 nouveaux enfants
  --     (teda-p50..p58). Idempotent : insère les manquantes, sinon ne touche pas
  --     les fiches existantes (DO NOTHING).
  -- ──────────────────────────────────────────────────────────────────────
  INSERT INTO public.persons
    (id, tree_id, first_name, last_name, gender, birth_date, death_date, birth_place, bio, is_alive)
  VALUES
  ('teda-p50', 'teda1', 'DONGMO', 'Madeleine', 'female', NULL, NULL, NULL,
   '1ère épouse de TSANA Sébastien.
Mère de 9 enfants : ZEKENG Lucienne, AKITIO Geneviève, DJOUMESSI Mathias, KADJIO Augustin, DONGMO Jean-Pierre, KENGO Dieudonné, TSANA Hégène, DONFAKA Hortense, TIOFACK Mireille.
Correction familiale du 22 juin 2026.', true),
  ('teda-p51', 'teda1', 'GUEDIA', 'Régine', 'female', NULL, NULL, NULL,
   '2ème épouse de TSANA Sébastien.
Mère de 2 enfants : AGHOFACK Albert, GAOHO Simplice.
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p52', 'teda1', 'DONGMO', 'Julienne', 'female', NULL, NULL, NULL,
   '3ème épouse de TSANA Sébastien.
Mère de 7 enfants : NAMPA Léonie, ZEKENG Delphine, GUEMESIO Lucie, TSANA Fouedjio Colince, DANCHI Anastasie, YMDJ Anne, DEMANOU Donald.
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p53', 'teda1', 'DONGMO', 'Jean-Pierre', 'male', NULL, NULL, NULL,
   'Fils de TSANA Sébastien et DONGMO Madeleine (1ère épouse).
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p54', 'teda1', 'TIOFACK', 'Mireille', 'female', NULL, NULL, NULL,
   'Fille de TSANA Sébastien et DONGMO Madeleine (1ère épouse).
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p55', 'teda1', 'AGHOFACK', 'Albert', 'male', NULL, NULL, NULL,
   'Fils de TSANA Sébastien et GUEDIA Régine (2ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p56', 'teda1', 'TSANA', 'Fouedjio Colince', 'male', NULL, NULL, NULL,
   'Fils de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p57', 'teda1', 'DANCHI', 'Anastasie', 'female', NULL, NULL, NULL,
   'Fille de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', true),
  ('teda-p58', 'teda1', 'YMDJ', 'Anne', 'female', NULL, NULL, NULL,
   'Fille de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Graphie « YMDJ » à confirmer.
Nouveau membre — correction familiale du 22 juin 2026.', true)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────
  -- 5b) TSANA Sébastien (teda-p36) — bio mise à jour (3 épouses, répartition).
  -- ──────────────────────────────────────────────────────────────────────
  UPDATE public.persons SET
    bio = 'Né vers 1948 au village de Bouleng.
Fils de TSANA Wamba Tchoupa (1918-2013).
Parcours scolaire : EP (BEPE), CEG 1966-1970, Lycée Dschang 1970-1976, Bac C 1977, ENS Collège 1977-1979, ENS GIT DUA 1980-1986.
Carrière : 1986-1998, Électricité, Chimie, Atangana.
3 épouses (correction du 22 juin 2026) :
  • DONGMO Madeleine (1ère) — 9 enfants : ZEKENG Lucienne, AKITIO Geneviève, DJOUMESSI Mathias, KADJIO Augustin, DONGMO Jean-Pierre, KENGO Dieudonné, TSANA Hégène, DONFAKA Hortense, TIOFACK Mireille.
  • GUEDIA Régine (2ème) — 2 enfants : AGHOFACK Albert, GAOHO Simplice.
  • DONGMO Julienne (3ème) — 7 enfants : NAMPA Léonie, ZEKENG Delphine, GUEMESIO Lucie, TSANA Fouedjio Colince, DANCHI Anastasie, YMDJ Anne, DEMANOU Donald.',
    updated_at = now()
  WHERE id = 'teda-p36' AND tree_id = 'teda1';

  -- ──────────────────────────────────────────────────────────────────────
  -- 5c) Enfants existants de TSANA Sébastien — enrichir la bio avec la mère
  --     (idempotent : n'ajoute la ligne que si elle est absente).
  -- ──────────────────────────────────────────────────────────────────────
  -- Épouse 1 : DONGMO Madeleine
  UPDATE public.persons SET bio = bio || E'\nMère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', updated_at = now()
   WHERE tree_id='teda1' AND id IN ('teda-p38','teda-p39','teda-p40','teda-p42','teda-p43','teda-p45','teda-p47')
     AND bio NOT LIKE '%Mère : DONGMO Madeleine%';
  -- Épouse 2 : GUEDIA Régine
  UPDATE public.persons SET bio = bio || E'\nMère : GUEDIA Régine (2ème épouse de TSANA Sébastien).', updated_at = now()
   WHERE tree_id='teda1' AND id = 'teda-p41'
     AND bio NOT LIKE '%Mère : GUEDIA Régine%';
  -- Épouse 3 : DONGMO Julienne
  UPDATE public.persons SET bio = bio || E'\nMère : DONGMO Julienne (3ème épouse de TSANA Sébastien).', updated_at = now()
   WHERE tree_id='teda1' AND id IN ('teda-p37','teda-p44','teda-p46','teda-p48')
     AND bio NOT LIKE '%Mère : DONGMO Julienne%';

  -- ──────────────────────────────────────────────────────────────────────
  -- 6) Enfants de TEDA FOTIE — bios enrichies pour nommer la mère.
  --    (Les bios v2 nomment déjà MESSE / DONGHOCK : ces UPDATE sont des no-op
  --     si la mention existe ; conservés pour garantir l'enrichissement.)
  -- ──────────────────────────────────────────────────────────────────────
  -- TEDA × MESSE : TSAGUE (p15), KADJIO (p16), MEFOKO (p17), MEPOPA (p18)
  UPDATE public.persons SET bio = bio || E'\nMère : MESSE (1ère épouse de TEDA FOTIE).', updated_at = now()
   WHERE tree_id='teda1' AND id IN ('teda-p15','teda-p16','teda-p17','teda-p18')
     AND bio NOT LIKE '%MESSE%';
  -- TEDA × DONGHOCK : NONGNI (p19), DEMANOU FOTIE (p20)
  UPDATE public.persons SET bio = bio || E'\nMère : DONGHOCK (2ème épouse de TEDA FOTIE).', updated_at = now()
   WHERE tree_id='teda1' AND id IN ('teda-p19','teda-p20')
     AND bio NOT LIKE '%DONGHOCK%';

  -- ──────────────────────────────────────────────────────────────────────
  -- 3) + 4) RELATIONS DE CONFIRMATION (déjà en base v2) — ré-insérées en
  --     idempotent pour garantir leur présence.
  --       3) MEZEKENG/METSAGHO/MEGNIGUE ← MO'O SOUKA (p4) × METIOLO (p3)
  --       4) METIOLO (p3) ← TEFOUETZAP (p1) × MAFOKO (p2)
  -- ──────────────────────────────────────────────────────────────────────
  INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
  VALUES
  ('teda-r8',  'teda1', 'parent', 'teda-p1', 'teda-p3', true),  -- TEFOUETZAP → METIOLO
  ('teda-r9',  'teda1', 'parent', 'teda-p2', 'teda-p3', true),  -- MAFOKO → METIOLO
  ('teda-r10', 'teda1', 'parent', 'teda-p3', 'teda-p5', true),  -- METIOLO → MEZEKENG
  ('teda-r11', 'teda1', 'parent', 'teda-p4', 'teda-p5', true),  -- MO'O SOUKA → MEZEKENG
  ('teda-r12', 'teda1', 'parent', 'teda-p3', 'teda-p6', true),  -- METIOLO → METSAGHO
  ('teda-r13', 'teda1', 'parent', 'teda-p4', 'teda-p6', true),  -- MO'O SOUKA → METSAGHO
  ('teda-r14', 'teda1', 'parent', 'teda-p3', 'teda-p7', true),  -- METIOLO → MEGNIGUE
  ('teda-r15', 'teda1', 'parent', 'teda-p4', 'teda-p7', true)   -- MO'O SOUKA → MEGNIGUE
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────
  -- 5d) NOUVELLES RELATIONS — épouses + parenté « mère → enfant » + parenté
  --     « père → nouveaux enfants » de TSANA Sébastien (teda-r68..r94).
  --     Les relations « père → enfants existants » sont déjà posées (r55, r57..r67).
  -- ──────────────────────────────────────────────────────────────────────
  INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
  VALUES
  -- Mariages (TSANA Sébastien × épouse)
  ('teda-r68', 'teda1', 'spouse', 'teda-p36', 'teda-p50', true),  -- × DONGMO Madeleine
  ('teda-r69', 'teda1', 'spouse', 'teda-p36', 'teda-p51', true),  -- × GUEDIA Régine
  ('teda-r70', 'teda1', 'spouse', 'teda-p36', 'teda-p52', true),  -- × DONGMO Julienne

  -- Épouse 1 — DONGMO Madeleine (teda-p50) → enfants
  ('teda-r71', 'teda1', 'parent', 'teda-p50', 'teda-p47', true),  -- ZEKENG Lucienne
  ('teda-r72', 'teda1', 'parent', 'teda-p50', 'teda-p39', true),  -- AKITIO Geneviève
  ('teda-r73', 'teda1', 'parent', 'teda-p50', 'teda-p38', true),  -- DJOUMESSI Mathias
  ('teda-r74', 'teda1', 'parent', 'teda-p50', 'teda-p42', true),  -- KADJIO Augustin
  ('teda-r75', 'teda1', 'parent', 'teda-p50', 'teda-p53', true),  -- DONGMO Jean-Pierre (NOUVEAU)
  ('teda-r76', 'teda1', 'parent', 'teda-p50', 'teda-p43', true),  -- KENGO Dieudonné
  ('teda-r77', 'teda1', 'parent', 'teda-p50', 'teda-p45', true),  -- TSANA Hégène
  ('teda-r78', 'teda1', 'parent', 'teda-p50', 'teda-p40', true),  -- DONFAKA Hortense
  ('teda-r79', 'teda1', 'parent', 'teda-p50', 'teda-p54', true),  -- TIOFACK Mireille (NOUVEAU)

  -- Épouse 2 — GUEDIA Régine (teda-p51) → enfants
  ('teda-r80', 'teda1', 'parent', 'teda-p51', 'teda-p55', true),  -- AGHOFACK Albert (NOUVEAU)
  ('teda-r81', 'teda1', 'parent', 'teda-p51', 'teda-p41', true),  -- GAOHO Simplice

  -- Épouse 3 — DONGMO Julienne (teda-p52) → enfants
  ('teda-r82', 'teda1', 'parent', 'teda-p52', 'teda-p44', true),  -- NAMPA Léonie
  ('teda-r83', 'teda1', 'parent', 'teda-p52', 'teda-p46', true),  -- ZEKENG Delphine
  ('teda-r84', 'teda1', 'parent', 'teda-p52', 'teda-p48', true),  -- GUEMESIO Lucie
  ('teda-r85', 'teda1', 'parent', 'teda-p52', 'teda-p56', true),  -- TSANA Fouedjio Colince (NOUVEAU)
  ('teda-r86', 'teda1', 'parent', 'teda-p52', 'teda-p57', true),  -- DANCHI Anastasie (NOUVEAU)
  ('teda-r87', 'teda1', 'parent', 'teda-p52', 'teda-p58', true),  -- YMDJ Anne (NOUVEAU)
  ('teda-r88', 'teda1', 'parent', 'teda-p52', 'teda-p37', true),  -- DEMANOU Donald

  -- Père (TSANA Sébastien teda-p36) → nouveaux enfants
  ('teda-r89', 'teda1', 'parent', 'teda-p36', 'teda-p53', true),  -- DONGMO Jean-Pierre
  ('teda-r90', 'teda1', 'parent', 'teda-p36', 'teda-p54', true),  -- TIOFACK Mireille
  ('teda-r91', 'teda1', 'parent', 'teda-p36', 'teda-p55', true),  -- AGHOFACK Albert
  ('teda-r92', 'teda1', 'parent', 'teda-p36', 'teda-p56', true),  -- TSANA Fouedjio Colince
  ('teda-r93', 'teda1', 'parent', 'teda-p36', 'teda-p57', true),  -- DANCHI Anastasie
  ('teda-r94', 'teda1', 'parent', 'teda-p36', 'teda-p58', true)   -- YMDJ Anne
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────
  -- Métadonnées de l'arbre (description + compteurs v3).
  -- ──────────────────────────────────────────────────────────────────────
  UPDATE public.trees SET
    description = 'Lignée FOTIE — 7 générations (~1870 – 1994+). Reconstitution juin 2026, intégrant les corrections des 13, 20 et 22 juin 2026. 58 fiches (dont les 3 épouses et les enfants de TSANA Sébastien). Source : notes manuscrites et corrections orales.',
    settings = '{"rootPersonId":"teda-p9","generationCount":7,"foundingYear":"~1870","latestDescendant":"DEMANOU Donald (1994)"}'::jsonb,
    updated_at = now()
  WHERE id = 'teda1';

  RAISE NOTICE 'TEDA v3 appliqué : owner=%, arbre teda1 (58 personnes / 94 relations attendues).', v_owner;
END $$;

-- ── VÉRIFICATION (état APRÈS modification) ─────────────────────────────────
SELECT 'APRÈS — persons'       AS objet, count(*)::text AS valeur FROM public.persons       WHERE tree_id = 'teda1'
UNION ALL
SELECT 'APRÈS — relationships', count(*)::text FROM public.relationships WHERE tree_id = 'teda1'
UNION ALL
SELECT 'APRÈS — vivants',       count(*)::text FROM public.persons WHERE tree_id = 'teda1' AND is_alive
UNION ALL
SELECT 'APRÈS — épouses TSANA Sébastien (attendu 3)',
       count(*)::text FROM public.relationships
       WHERE tree_id='teda1' AND type='spouse' AND (person1_id='teda-p36' OR person2_id='teda-p36')
UNION ALL
SELECT 'APRÈS — enfants TSANA Sébastien, côté père (attendu 18)',
       count(*)::text FROM public.relationships
       WHERE tree_id='teda1' AND type='parent' AND person1_id='teda-p36'
UNION ALL
SELECT 'APRÈS — enfants DONGMO Madeleine (attendu 9)',
       count(*)::text FROM public.relationships
       WHERE tree_id='teda1' AND type='parent' AND person1_id='teda-p50'
UNION ALL
SELECT 'APRÈS — enfants GUEDIA Régine (attendu 2)',
       count(*)::text FROM public.relationships
       WHERE tree_id='teda1' AND type='parent' AND person1_id='teda-p51'
UNION ALL
SELECT 'APRÈS — enfants DONGMO Julienne (attendu 7)',
       count(*)::text FROM public.relationships
       WHERE tree_id='teda1' AND type='parent' AND person1_id='teda-p52'
UNION ALL
SELECT 'APRÈS — MEFOUEGONG=female (attendu 1)',
       count(*)::text FROM public.persons WHERE id='teda-p10' AND gender='female'
UNION ALL
SELECT 'APRÈS — GNINZEKO/Gaston (attendu 1)',
       count(*)::text FROM public.persons WHERE id='teda-p23' AND last_name='Gaston'
UNION ALL
SELECT 'APRÈS — fiche MERQUEGON parasite (attendu 0)',
       count(*)::text FROM public.persons WHERE tree_id='teda1' AND upper(first_name) LIKE 'MERQUEGON%';
-- Attendu APRÈS : persons=58, relationships=94, épouses Sébastien=3,
--   enfants côté père=18, Madeleine=9, Régine=2, Julienne=7.

-- ── Liste des NOUVEAUX membres ajoutés (teda-p50..p58) ─────────────────────
SELECT id, first_name, last_name, gender, is_alive
  FROM public.persons
 WHERE tree_id = 'teda1' AND id IN
   ('teda-p50','teda-p51','teda-p52','teda-p53','teda-p54','teda-p55','teda-p56','teda-p57','teda-p58')
 ORDER BY id;
