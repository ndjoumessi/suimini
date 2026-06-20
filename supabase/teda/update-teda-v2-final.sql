-- ============================================================================
-- TEDA (FOTIE) — MISE À JOUR « V2 FINAL » de l'arbre 'teda1' en production
-- État de référence : document de synthèse v2 du 20 juin 2026.
-- Intègre TOUTES les corrections (13 juin + 20 juin 2026) en un seul script
-- idempotent et ré-exécutable.
--
-- Cible : 49 personnes + 67 relations, ancêtre pivot teda-p9 (TEDA FOTIE).
-- (« 60 membres » du document = 49 personnes distinctes en base + le rattachement
--  des 11 enfants de TSANA Sébastien ; le nombre de LIGNES persons est 49.)
--
-- Propriétaire de l'arbre : compte dromel902007@yahoo.fr (résolu dynamiquement,
-- aucun UID codé en dur). Ne supprime AUCUNE donnée, à l'exception des 2 relations
-- NONGNI factuellement erronées (teda-r28/r29), remplacées par teda-r28b/r29b
-- conformément à la correction du 13 juin 2026.
--
-- EXÉCUTION (au choix) :
--   • Supabase Dashboard → SQL Editor → coller ce fichier → Run  (recommandé).
--   • supabase db execute --file supabase/teda/update-teda-v2-final.sql
--       (nécessite `supabase link` au projet 'bhthavcnlxflhhevdneo' + mot de passe DB).
--   • psql "$DATABASE_URL" -f supabase/teda/update-teda-v2-final.sql
--       (nécessite la connection string Postgres / service role).
-- Le SQL Editor s'exécute en rôle privilégié → la RLS est contournée nativement.
-- ============================================================================

DO $$
DECLARE
  v_owner uuid;
BEGIN
  -- 1) Résoudre le propriétaire par email (pas d'UID en dur).
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = lower('dromel902007@yahoo.fr');
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Compte dromel902007@yahoo.fr introuvable dans auth.users — créez-le d''abord.';
  END IF;

  -- 2) Arbre teda1 : créer au besoin, (ré)attribuer au bon owner, métadonnées v2.
  INSERT INTO public.trees (id, owner_id, name, description, settings)
  VALUES (
    'teda1', v_owner, 'Famille TEDA',
    'Lignée FOTIE — 7 générations (~1870 – 1994+). Reconstitution juin 2026, intégrant les corrections des 13 et 20 juin 2026. 60 membres identifiés (49 fiches + rattachement des 11 enfants de TSANA Sébastien). Source : notes manuscrites et corrections orales.',
    '{"rootPersonId":"teda-p9","generationCount":7,"foundingYear":"~1870","latestDescendant":"DEMANOU Donald (1994)"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
    SET owner_id = v_owner,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        settings = EXCLUDED.settings,
        updated_at = now();

  -- 3) PERSONNES (49) — upsert : insère les manquantes ET corrige les
  --    existantes vers l'état v2 (genre teda-p21=female, lieu teda-p36=Bouleng,
  --    biographies enrichies, ajout de teda-p49 WAMBA TCHOUPA).
  INSERT INTO public.persons
    (id, tree_id, first_name, last_name, gender, birth_date, death_date, birth_place, bio, is_alive)
  VALUES
  ('teda-p1', 'teda1', 'TEFOUETZAP', '', 'male', '1850', NULL, '{"city":"Zem"}'::jsonb, 'Fondateur de la lignée. Village de Zem.
Épouse : MAFOKO (village Bansoa).
Enfant unique : METIOLO.
Note : orthographe corrigée de TEFOUEZAD en TEFOUETZAP.', false),
  ('teda-p2', 'teda1', 'MAFOKO', '', 'female', NULL, NULL, '{"city":"Bansoa"}'::jsonb, 'GEN 0 — épouse de TEFOUETZAP (village Bansoa).', false),
  ('teda-p3', 'teda1', 'METIOLO', '', 'female', NULL, NULL, NULL, 'Enfant unique de TEFOUETZAP et MAFOKO.
Épouse de MO''O SOUKA.
3 enfants : MEZEKENG (mariée à Tetsa''a, Banzaï), METSAGHO (mariée à Metsui-Tekeng, Zem), MEGNIGUE (mariée au Chef Fo''o Gapgho — notre lignée).', false),
  ('teda-p4', 'teda1', 'MO''O', 'SOUKA', 'male', NULL, NULL, NULL, 'Époux de METIOLO.', false),
  ('teda-p5', 'teda1', 'MEZEKENG', '', 'female', NULL, NULL, NULL, 'Fille de METIOLO et MO''O SOUKA.
Mariée à Tetsa''a, à Banzaï.', false),
  ('teda-p6', 'teda1', 'METSAGHO', '', 'female', NULL, NULL, NULL, 'Fille de METIOLO et MO''O SOUKA.
Mariée à Metsui-Tekeng, à Zem.', false),
  ('teda-p7', 'teda1', 'MEGNIGUE', '', 'female', NULL, NULL, NULL, 'Fille de METIOLO et MO''O SOUKA (notre lignée).
Épouse du Chef Fo''o GAPGHO.
Enfants : TEDA FOTIE (ancêtre pivot) et MEFOUEGONG (décédée sans enfants).', false),
  ('teda-p8', 'teda1', 'Fo''o', 'GAPGHO', 'male', NULL, NULL, NULL, 'Chef. Époux de MEGNIGUE.
Père de TEDA FOTIE et MEFOUEGONG.', false),
  ('teda-p9', 'teda1', 'TEDA', 'FOTIE', 'male', '1870', NULL, NULL, 'Ancêtre pivot de toute la lignée TEDA (FOTIE).
Né vers 1870. Fils de MEGNIGUE et Fo''o GAPGHO (Chef).
Graphies variantes : TEDA CFOTIE, TEDA''A FOTIE 1er.
A eu 4 épouses : MESSE (J.E. DONG), DONGHOCK/KEMDONG, DONGMO Tejioguim, DONGMO Tela.
Nombreux descendants sur 4 générations.', false),
  ('teda-p10', 'teda1', 'MEFOUEGONG', '', 'female', NULL, NULL, NULL, 'Sœur de TEDA FOTIE.
Mariée à KEMDONHAGHO.
Décédée sans descendance.', false),
  ('teda-p11', 'teda1', 'MESSE', '', 'female', NULL, NULL, NULL, '1ère épouse de TEDA (J.E. DONG).', false),
  ('teda-p12', 'teda1', 'DONGHOCK', '', 'female', NULL, NULL, NULL, '2ème épouse de TEDA (alias KEMDONG).', false),
  ('teda-p13', 'teda1', 'DONGMO', 'Tejioguim', 'female', NULL, NULL, NULL, '3ème épouse de TEDA.', false),
  ('teda-p14', 'teda1', 'DONGMO', 'Tela', 'female', NULL, NULL, NULL, '4ème épouse de TEDA.', false),
  ('teda-p15', 'teda1', 'TSAGUE', '', 'female', NULL, NULL, NULL, 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Tsuelépo.', false),
  ('teda-p16', 'teda1', 'KADJIO', '', 'female', NULL, NULL, NULL, 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Megnin-za. Quartier Sa''a.', false),
  ('teda-p17', 'teda1', 'MEFOKO', '', 'female', NULL, NULL, NULL, 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Letsie. Quartier Letsie.', false),
  ('teda-p18', 'teda1', 'MEPOPA', '', 'unknown', NULL, NULL, NULL, 'Enfant de TEDA et MESSE.', false),
  ('teda-p19', 'teda1', 'NONGNI', '', 'female', NULL, NULL, NULL, 'Enfant de TEDA FOTIE et MESSE (1ère épouse).
Note : rattachée à la branche DONGHOCK selon correction du 13 juin 2026.', false),
  ('teda-p20', 'teda1', 'DEMANOU', 'FOTIE', 'male', '1913', '1988', NULL, 'Né en 1913, décédé en 1988.
Fils de TEDA FOTIE et DONGHOCK (2e épouse).
A eu 8 épouses (non identifiées dans les notes).
Enfants connus : DONGMO Lucienne, MEKEUTIO Julienne, GUEFACK Berthe, DEMANOU Suzanne, MAGUE Marie, KAGHO Monique, DANCHI Martine, MEGNIGHO Francesca.
Graphie variante : DEMANOU CHOTIE.', false),
  ('teda-p21', 'teda1', 'TSANA', 'Wamba Tchoupa', 'female', '1918', '2013', NULL, 'Née en 1918, décédée en 2013.
Fille de TEDA FOTIE et DONGMO Tejioguim (3e épouse).
Époux : WAMBA TCHOUPA.
Fils connu : TSANA Sébastien (né ~1948, village Bouleng).
Note : date de naissance corrigée de ~1948 à 1918.', false),
  ('teda-p22', 'teda1', 'GUIMATIO', '', 'unknown', '1913', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),
  ('teda-p23', 'teda1', 'GNINZEKO', 'Gaston', 'male', '1928', NULL, NULL, 'Fils de TEDA FOTIE et DONGMO Tejioguim.
Né vers 1928. Prénom chrétien "Gaston" — à confirmer.', false),
  ('teda-p24', 'teda1', 'MEGNIGUE', '', 'female', '1933', NULL, NULL, 'Fille de TEDA et DONGMO Tejioguim.', false),
  ('teda-p25', 'teda1', 'ZEKENG', '', 'unknown', '1923', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),
  ('teda-p26', 'teda1', 'GHODA', 'Bfou', 'unknown', NULL, NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),
  ('teda-p27', 'teda1', 'MEGHOFOUET', 'Tekang', 'unknown', NULL, NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),
  ('teda-p28', 'teda1', 'DANCHI', 'Martine', 'female', NULL, NULL, NULL, 'Fille de DEMANOU FOTIE.
Note : prénom Martine confirmé (variante Albertine à écarter).', true),
  ('teda-p29', 'teda1', 'DEMANOU', 'Suzanne', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p30', 'teda1', 'DONGMO', 'Lucienne', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p31', 'teda1', 'GUEFACK', 'Berthe', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p32', 'teda1', 'KAGHO', 'Monique', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p33', 'teda1', 'MAGUE', 'Marie', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p34', 'teda1', 'MEGNIGHO', 'Francesca', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p35', 'teda1', 'MEKEUTIO', 'Julienne', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p36', 'teda1', 'TSANA', 'Sébastien', 'male', '1948', NULL, '{"city":"Bouleng"}'::jsonb, 'Né vers 1948 au village de Bouleng.
Fils de TSANA Wamba Tchoupa (1918-2013).
Parcours scolaire : EP (BEPE), CEG 1966-1970, Lycée Dschang 1970-1976, Bac C 1977, ENS Collège 1977-1979, ENS GIT DUA 1980-1986.
Carrière : 1986-1998, Électricité, Chimie, Atangana.
Enfants : DJOUMESSI Mathias, AKITIO Geneviève, DONFAKA Hortense, GAOHO Simplice, KADJIO Augustin, KENGO Dieudonné, NAMPA Léonie, TSANA Hégène, ZEKENG Delphine, ZEKENG Lucienne, GUEMESIO Lucie, DEMANOU Donald.', true),
  ('teda-p37', 'teda1', 'DEMANOU', 'Donald', 'male', '1994', NULL, NULL, 'Né en 1994. Descendant le plus récent de la lignée (génération 6, 7e depuis TEFOUETZAP).
Père : TSANA Sébastien (~1948).
Grand-mère : TSANA Wamba Tchoupa (1918–2013).
Arrière-grand-père : TEDA FOTIE (~1870).
Fondateurs : TEFOUETZAP × MAFOKO (génération 0).', true),
  ('teda-p38', 'teda1', 'DJOUMESSI', 'Mathias', 'male', '1956', NULL, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p39', 'teda1', 'AKITIO', 'Geneviève', 'female', '1953', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p40', 'teda1', 'DONFAKA', 'Hortense', 'female', '1972', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p41', 'teda1', 'GAOHO', 'Simplice', 'male', '1971', NULL, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p42', 'teda1', 'KADJIO', 'Augustin', 'male', '1958', NULL, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p43', 'teda1', 'KENGO', 'Dieudonné', 'male', '1964', NULL, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p44', 'teda1', 'NAMPA', 'Léonie', 'female', '1967', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p45', 'teda1', 'TSANA', 'Hégène', 'male', '1968', NULL, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p46', 'teda1', 'ZEKENG', 'Delphine', 'female', '1969', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p47', 'teda1', 'ZEKENG', 'Lucienne', 'female', '1945', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p48', 'teda1', 'GUEMESIO', 'Lucie', 'female', '1983', NULL, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.', true),
  ('teda-p49', 'teda1', 'WAMBA', 'TCHOUPA', 'male', NULL, NULL, NULL, 'Époux de TSANA Wamba Tchoupa.', false)
  ON CONFLICT (id) DO UPDATE SET
    first_name  = EXCLUDED.first_name,
    last_name   = EXCLUDED.last_name,
    gender      = EXCLUDED.gender,
    birth_date  = EXCLUDED.birth_date,
    death_date  = EXCLUDED.death_date,
    birth_place = EXCLUDED.birth_place,
    bio         = EXCLUDED.bio,
    is_alive    = EXCLUDED.is_alive,
    updated_at  = now();

  -- 4) Correction NONGNI (13/06/2026) : retirer les 2 relations erronées avant de
  --    poser les bonnes (mère DONGHOCK, et non MESSE). Seule suppression du script.
  DELETE FROM public.relationships
   WHERE tree_id = 'teda1' AND id IN ('teda-r28', 'teda-r29');

  -- 5) RELATIONS (67) — état v2 final (inclut teda-r28b/r29b, teda-r56,
  --    et teda-r57→r67 = rattachement des 11 enfants de TSANA Sébastien).
  INSERT INTO public.relationships
    (id, tree_id, type, person1_id, person2_id, is_active)
  VALUES
  ('teda-r1', 'teda1', 'spouse', 'teda-p1', 'teda-p2', true),
  ('teda-r2', 'teda1', 'spouse', 'teda-p4', 'teda-p3', true),
  ('teda-r3', 'teda1', 'spouse', 'teda-p8', 'teda-p7', true),
  ('teda-r4', 'teda1', 'spouse', 'teda-p9', 'teda-p11', true),
  ('teda-r5', 'teda1', 'spouse', 'teda-p9', 'teda-p12', true),
  ('teda-r6', 'teda1', 'spouse', 'teda-p9', 'teda-p13', true),
  ('teda-r7', 'teda1', 'spouse', 'teda-p9', 'teda-p14', true),
  ('teda-r8', 'teda1', 'parent', 'teda-p1', 'teda-p3', true),
  ('teda-r9', 'teda1', 'parent', 'teda-p2', 'teda-p3', true),
  ('teda-r10', 'teda1', 'parent', 'teda-p3', 'teda-p5', true),
  ('teda-r11', 'teda1', 'parent', 'teda-p4', 'teda-p5', true),
  ('teda-r12', 'teda1', 'parent', 'teda-p3', 'teda-p6', true),
  ('teda-r13', 'teda1', 'parent', 'teda-p4', 'teda-p6', true),
  ('teda-r14', 'teda1', 'parent', 'teda-p3', 'teda-p7', true),
  ('teda-r15', 'teda1', 'parent', 'teda-p4', 'teda-p7', true),
  ('teda-r16', 'teda1', 'parent', 'teda-p7', 'teda-p9', true),
  ('teda-r17', 'teda1', 'parent', 'teda-p8', 'teda-p9', true),
  ('teda-r18', 'teda1', 'parent', 'teda-p7', 'teda-p10', true),
  ('teda-r19', 'teda1', 'parent', 'teda-p8', 'teda-p10', true),
  ('teda-r20', 'teda1', 'parent', 'teda-p9', 'teda-p15', true),
  ('teda-r21', 'teda1', 'parent', 'teda-p11', 'teda-p15', true),
  ('teda-r22', 'teda1', 'parent', 'teda-p9', 'teda-p16', true),
  ('teda-r23', 'teda1', 'parent', 'teda-p11', 'teda-p16', true),
  ('teda-r24', 'teda1', 'parent', 'teda-p9', 'teda-p17', true),
  ('teda-r25', 'teda1', 'parent', 'teda-p11', 'teda-p17', true),
  ('teda-r26', 'teda1', 'parent', 'teda-p9', 'teda-p18', true),
  ('teda-r27', 'teda1', 'parent', 'teda-p11', 'teda-p18', true),
  ('teda-r30', 'teda1', 'parent', 'teda-p9', 'teda-p20', true),
  ('teda-r31', 'teda1', 'parent', 'teda-p12', 'teda-p20', true),
  ('teda-r32', 'teda1', 'parent', 'teda-p9', 'teda-p21', true),
  ('teda-r33', 'teda1', 'parent', 'teda-p13', 'teda-p21', true),
  ('teda-r34', 'teda1', 'parent', 'teda-p9', 'teda-p22', true),
  ('teda-r35', 'teda1', 'parent', 'teda-p13', 'teda-p22', true),
  ('teda-r36', 'teda1', 'parent', 'teda-p9', 'teda-p23', true),
  ('teda-r37', 'teda1', 'parent', 'teda-p13', 'teda-p23', true),
  ('teda-r38', 'teda1', 'parent', 'teda-p9', 'teda-p24', true),
  ('teda-r39', 'teda1', 'parent', 'teda-p13', 'teda-p24', true),
  ('teda-r40', 'teda1', 'parent', 'teda-p9', 'teda-p25', true),
  ('teda-r41', 'teda1', 'parent', 'teda-p13', 'teda-p25', true),
  ('teda-r42', 'teda1', 'parent', 'teda-p9', 'teda-p26', true),
  ('teda-r43', 'teda1', 'parent', 'teda-p14', 'teda-p26', true),
  ('teda-r44', 'teda1', 'parent', 'teda-p9', 'teda-p27', true),
  ('teda-r45', 'teda1', 'parent', 'teda-p14', 'teda-p27', true),
  ('teda-r46', 'teda1', 'parent', 'teda-p20', 'teda-p28', true),
  ('teda-r47', 'teda1', 'parent', 'teda-p20', 'teda-p29', true),
  ('teda-r48', 'teda1', 'parent', 'teda-p20', 'teda-p30', true),
  ('teda-r49', 'teda1', 'parent', 'teda-p20', 'teda-p31', true),
  ('teda-r50', 'teda1', 'parent', 'teda-p20', 'teda-p32', true),
  ('teda-r51', 'teda1', 'parent', 'teda-p20', 'teda-p33', true),
  ('teda-r52', 'teda1', 'parent', 'teda-p20', 'teda-p34', true),
  ('teda-r53', 'teda1', 'parent', 'teda-p20', 'teda-p35', true),
  ('teda-r54', 'teda1', 'parent', 'teda-p21', 'teda-p36', true),
  ('teda-r55', 'teda1', 'parent', 'teda-p36', 'teda-p37', true),
  ('teda-r28b', 'teda1', 'parent', 'teda-p9', 'teda-p19', true),
  ('teda-r29b', 'teda1', 'parent', 'teda-p12', 'teda-p19', true),
  ('teda-r56', 'teda1', 'spouse', 'teda-p49', 'teda-p21', true),
  ('teda-r57', 'teda1', 'parent', 'teda-p36', 'teda-p38', true),
  ('teda-r58', 'teda1', 'parent', 'teda-p36', 'teda-p39', true),
  ('teda-r59', 'teda1', 'parent', 'teda-p36', 'teda-p40', true),
  ('teda-r60', 'teda1', 'parent', 'teda-p36', 'teda-p41', true),
  ('teda-r61', 'teda1', 'parent', 'teda-p36', 'teda-p42', true),
  ('teda-r62', 'teda1', 'parent', 'teda-p36', 'teda-p43', true),
  ('teda-r63', 'teda1', 'parent', 'teda-p36', 'teda-p44', true),
  ('teda-r64', 'teda1', 'parent', 'teda-p36', 'teda-p45', true),
  ('teda-r65', 'teda1', 'parent', 'teda-p36', 'teda-p46', true),
  ('teda-r66', 'teda1', 'parent', 'teda-p36', 'teda-p47', true),
  ('teda-r67', 'teda1', 'parent', 'teda-p36', 'teda-p48', true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'TEDA v2 appliqué : owner=%, arbre teda1.', v_owner;
END $$;

-- ── VÉRIFICATION (doit renvoyer persons=49, relationships=67) ──────────────
SELECT 'persons'        AS objet, count(*) AS total FROM public.persons        WHERE tree_id = 'teda1'
UNION ALL
SELECT 'relationships'  AS objet, count(*) AS total FROM public.relationships  WHERE tree_id = 'teda1'
UNION ALL
SELECT 'vivants'        AS objet, count(*) AS total FROM public.persons        WHERE tree_id = 'teda1' AND is_alive
UNION ALL
SELECT 'teda-p21.gender=female', (count(*))::int FROM public.persons WHERE id='teda-p21' AND gender='female'
UNION ALL
SELECT 'enfants TSANA Sébastien (parent=teda-p36)', count(*)::int
  FROM public.relationships WHERE tree_id='teda1' AND type='parent' AND person1_id='teda-p36';
-- Attendu : persons=49, relationships=67, vivants=21,
--           teda-p21=female → 1, enfants de teda-p36 → 12 (11 branche étendue + DEMANOU Donald).
