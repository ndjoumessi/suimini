-- ============================================================================
-- RESTORE_TEDA_FROM_EXPORT.sql — RESTAURATION COMPLÈTE de l'arbre TEDA ('teda1')
-- Source : export applicatif Suimini « Famille TEDA.suimini (1).json » (5 juil. 2026),
--          état complet réel de l'arbre = source de vérité.
--
-- Contenu : 57 personnes + 93 relations.
-- NE TOUCHE PAS public.trees (owner_id conservé). Aucune RPC. Une transaction.
-- Table rase pour teda1 puis réinsertion fidèle (mapping camelCase JSON → colonnes).
-- birthPlace/deathPlace → JSONB ; champs non normalisés → colonne `extra` (JSONB).
-- IDs TEXT/base36 (teda-p*, teda-r*). À lancer dans le SQL Editor Supabase.
-- ============================================================================

BEGIN;

-- 0) Table rase (enfants uniquement ; trees + owner intacts)
DELETE FROM public.relationships WHERE tree_id = 'teda1';
DELETE FROM public.persons       WHERE tree_id = 'teda1';

-- 1) PERSONNES (57)
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, birth_date, birth_place,
   death_date, death_place, is_alive, occupation, bio, profile_photo,
   dna_origins, citations, custom_fields, tags, privacy, extra, created_at, updated_at)
VALUES
  ('teda-p50', 'teda1', 'DONGMO', 'Madeleine', 'female', NULL, NULL, NULL, NULL, true, NULL, '1ère épouse de TSANA Sébastien.
Mère de 9 enfants : ZEKENG Lucienne, AKITIO Geneviève, DJOUMESSI Mathias, KADJIO Augustin, DONGMO Jean-Pierre, KENGO Dieudonné, TSANA Hégène, DONFAKA Hortense, TIOFACK Mireille.
Correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p41', 'teda1', 'GAOHO', 'Simplice', 'male', '1971', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : GUEDIA Régine (2ème épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p39', 'teda1', 'AKITIO', 'Geneviève', 'female', '1953', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p44', 'teda1', 'NAMPA', 'Léonie', 'female', '1967', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Julienne (3ème épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p9', 'teda1', 'TEDA', 'FOTIE', 'male', '1870', NULL, NULL, NULL, false, NULL, 'Ancêtre pivot. Prénom chrétien TEDA, nom FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p38', 'teda1', 'DJOUMESSI', 'Mathias', 'male', '1956', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p6', 'teda1', 'METSAGHO', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de METIOLO.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p10', 'teda1', 'MEFOUEGONG', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Sœur de TEDA FOTIE.
Fille de MEGNIGUE et du Chef Fo''o GAPGHO.
Mariée à KEMDONHAGHO. Décédée sans descendance.
Graphie correcte : MEFOUEGONG (la forme « MERQUEGON » est erronée).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p52', 'teda1', 'DONGMO', 'Julienne', 'female', NULL, NULL, NULL, NULL, true, NULL, '3ème épouse de TSANA Sébastien.
Mère de 7 enfants : NAMPA Léonie, ZEKENG Delphine, GUEMESIO Lucie, TSANA Fouedjio Colince, DANCHI Anastasie, YMDJ Anne, DEMANOU Donald.
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p20', 'teda1', 'DEMANOU', 'FOTIE', 'male', '1913', NULL, '1988', NULL, false, NULL, 'Fils de TEDA et DONGHOCK.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p18', 'teda1', 'MEPOPA', '', 'unknown', NULL, NULL, NULL, NULL, false, NULL, 'Enfant de TEDA et MESSE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p2', 'teda1', 'MAFOKO', '', 'female', NULL, '{"city": "Bansoa"}'::jsonb, NULL, NULL, false, NULL, 'GEN 0 — épouse de TEFOUETZAP (village Bansoa).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p36', 'teda1', 'TSANA', 'Sébastien', 'male', '1948', NULL, NULL, NULL, true, NULL, 'Né vers 1948 au village de Bouleng.
Fils de TSANA Wamba Tchoupa (1918-2013).
Parcours scolaire : EP (BEPE), CEG 1966-1970, Lycée Dschang 1970-1976, Bac C 1977, ENS Collège 1977-1979, ENS GIT DUA 1980-1986.
Carrière : 1986-1998, Électricité, Chimie, Atangana.
3 épouses (correction du 22 juin 2026) :
  • DONGMO Madeleine (1ère) — 9 enfants : ZEKENG Lucienne, AKITIO Geneviève, DJOUMESSI Mathias, KADJIO Augustin, DONGMO Jean-Pierre, KENGO Dieudonné, TSANA Hégène, DONFAKA Hortense, TIOFACK Mireille.
  • GUEDIA Régine (2ème) — 2 enfants : AGHOFACK Albert, GAOHO Simplice.
  • DONGMO Julienne (3ème) — 7 enfants : NAMPA Léonie, ZEKENG Delphine, GUEMESIO Lucie, TSANA Fouedjio Colince, DANCHI Anastasie, YMDJ Anne, DEMANOU Donald.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p3', 'teda1', 'METIOLO', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de TEFOUETZAP et MAFOKO.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p8', 'teda1', 'Fo''o', 'GAPGHO', 'male', NULL, NULL, NULL, NULL, false, NULL, 'Chef, époux de MEGNIGUE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p11', 'teda1', 'MESSE', '', 'female', NULL, NULL, NULL, NULL, false, NULL, '1ère épouse de TEDA (J.E. DONG).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p13', 'teda1', 'DONGMO', 'Tejioguim', 'female', NULL, NULL, NULL, NULL, false, NULL, '3ème épouse de TEDA.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p5', 'teda1', 'MEZEKENG', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de METIOLO.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p40', 'teda1', 'DONFAKA', 'Hortense', 'female', '1972', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p27', 'teda1', 'MEGHOFOUET', 'Tekang', 'unknown', NULL, NULL, NULL, NULL, false, NULL, 'Enfant de TEDA et DONGMO Tela.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p51', 'teda1', 'GUEDIA', 'Régine', 'female', NULL, NULL, NULL, NULL, true, NULL, '2ème épouse de TSANA Sébastien.
Mère de 2 enfants : AGHOFACK Albert, GAOHO Simplice.
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p32', 'teda1', 'KAGHO', 'Monique', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p46', 'teda1', 'ZEKENG', 'Delphine', 'female', '1969', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Julienne (3ème épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p12', 'teda1', 'DONGHOCK', '', 'female', NULL, NULL, NULL, NULL, false, NULL, '2ème épouse de TEDA (alias KEMDONG).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p53', 'teda1', 'DONGMO', 'Jean-Pierre', 'male', NULL, NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien et DONGMO Madeleine (1ère épouse).
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p31', 'teda1', 'GUEFACK', 'Berthe', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p1', 'teda1', 'TEFOUETZAP', '', 'male', '1850', '{"city": "Zem"}'::jsonb, NULL, NULL, false, NULL, 'GEN 0 — souche de la lignée (village Zem).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p21', 'teda1', 'TSANA', 'Wamba Tchoupa', 'male', '1918', NULL, '2013', NULL, false, NULL, 'Fils de TEDA et DONGMO Tejioguim.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p16', 'teda1', 'KADJIO', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de TEDA et MESSE (alias Megnin-za, quartier Sa''a).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p26', 'teda1', 'GHODA', 'Bfou', 'unknown', NULL, NULL, NULL, NULL, false, NULL, 'Enfant de TEDA et DONGMO Tela.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p35', 'teda1', 'MEKEUTIO', 'Julienne', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p25', 'teda1', 'ZEKENG', '', 'unknown', '1923', NULL, NULL, NULL, false, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p24', 'teda1', 'MEGNIGUE', '', 'female', '1933', NULL, NULL, NULL, false, NULL, 'Fille de TEDA et DONGMO Tejioguim.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p28', 'teda1', 'DANCHI', 'Martine', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p45', 'teda1', 'TSANA', 'Hégène', 'male', '1968', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p23', 'teda1', 'GNINZEKO', 'Gaston', 'male', '1928', NULL, NULL, NULL, false, NULL, 'Fils de TEDA FOTIE et DONGMO Tejioguim (3e épouse).
Né vers 1928. Prénom chrétien « Gaston » confirmé (correction du 22 juin 2026).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p56', 'teda1', 'TSANA', 'Fouedjio Colince', 'male', NULL, NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p14', 'teda1', 'DONGMO', 'Tela', 'female', NULL, NULL, NULL, NULL, false, NULL, '4ème épouse de TEDA.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p15', 'teda1', 'TSAGUE', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de TEDA et MESSE (alias Tsuelépo).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p7', 'teda1', 'MEGNIGUE', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de METIOLO (notre lignée).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p17', 'teda1', 'MEFOKO', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de TEDA et MESSE (alias Letsie, quartier Letsie).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p34', 'teda1', 'MEGNIGHO', 'Francesca', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p22', 'teda1', 'GUIMATIO', '', 'unknown', '1913', NULL, NULL, NULL, false, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p54', 'teda1', 'TIOFACK', 'Mireille', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien et DONGMO Madeleine (1ère épouse).
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p4', 'teda1', 'MO''O', 'SOUKA', 'male', NULL, NULL, NULL, NULL, false, NULL, 'Époux de METIOLO.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p55', 'teda1', 'AGHOFACK', 'Albert', 'male', NULL, NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien et GUEDIA Régine (2ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p57', 'teda1', 'DANCHI', 'Anastasie', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p43', 'teda1', 'KENGO', 'Dieudonné', 'male', '1964', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p48', 'teda1', 'GUEMESIO', 'Lucie', 'female', '1983', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Julienne (3ème épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p29', 'teda1', 'DEMANOU', 'Suzanne', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p30', 'teda1', 'DONGMO', 'Lucienne', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p37', 'teda1', 'DEMANOU', 'Donald', 'male', '1994', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien.
Mère : DONGMO Julienne (3ème épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p42', 'teda1', 'KADJIO', 'Augustin', 'male', '1958', NULL, NULL, NULL, true, NULL, 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p47', 'teda1', 'ZEKENG', 'Lucienne', 'female', '1945', NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.
Mère : DONGMO Madeleine (1ère épouse de TSANA Sébastien).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p58', 'teda1', 'YMDJ', 'Anne', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Fille de TSANA Sébastien et DONGMO Julienne (3ème épouse).
Graphie « YMDJ » à confirmer.
Nouveau membre — correction familiale du 22 juin 2026.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-22T10:11:56.900867+00:00', '2026-06-22T10:11:56.900867+00:00'),
  ('teda-p19', 'teda1', 'NONGNI', '', 'female', NULL, NULL, NULL, NULL, false, NULL, 'Fille de TEDA et MESSE (alias Saïa, branche DONGHOCK).', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00'),
  ('teda-p33', 'teda1', 'MAGUE', 'Marie', 'female', NULL, NULL, NULL, NULL, true, NULL, 'Enfant de DEMANOU FOTIE.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20T02:48:02.58355+00:00', '2026-06-20T02:48:02.58355+00:00')
ON CONFLICT (id) DO NOTHING;

-- 2) RELATIONS (93)
INSERT INTO public.relationships
  (id, tree_id, type, person1_id, person2_id, start_date, end_date, is_active, notes, extra)
VALUES
  ('teda-r36', 'teda1', 'parent', 'teda-p9', 'teda-p23', NULL, NULL, true, NULL, NULL),
  ('teda-r37', 'teda1', 'parent', 'teda-p13', 'teda-p23', NULL, NULL, true, NULL, NULL),
  ('teda-r38', 'teda1', 'parent', 'teda-p9', 'teda-p24', NULL, NULL, true, NULL, NULL),
  ('teda-r39', 'teda1', 'parent', 'teda-p13', 'teda-p24', NULL, NULL, true, NULL, NULL),
  ('teda-r28', 'teda1', 'parent', 'teda-p9', 'teda-p19', NULL, NULL, true, NULL, NULL),
  ('teda-r9', 'teda1', 'parent', 'teda-p2', 'teda-p3', NULL, NULL, true, NULL, NULL),
  ('teda-r10', 'teda1', 'parent', 'teda-p3', 'teda-p5', NULL, NULL, true, NULL, NULL),
  ('teda-r40', 'teda1', 'parent', 'teda-p9', 'teda-p25', NULL, NULL, true, NULL, NULL),
  ('teda-r41', 'teda1', 'parent', 'teda-p13', 'teda-p25', NULL, NULL, true, NULL, NULL),
  ('teda-r94', 'teda1', 'parent', 'teda-p36', 'teda-p58', NULL, NULL, true, NULL, NULL),
  ('teda-r68', 'teda1', 'spouse', 'teda-p36', 'teda-p50', NULL, NULL, true, NULL, NULL),
  ('teda-r69', 'teda1', 'spouse', 'teda-p36', 'teda-p51', NULL, NULL, true, NULL, NULL),
  ('teda-r70', 'teda1', 'spouse', 'teda-p36', 'teda-p52', NULL, NULL, true, NULL, NULL),
  ('teda-r75', 'teda1', 'parent', 'teda-p50', 'teda-p53', NULL, NULL, true, NULL, NULL),
  ('teda-r76', 'teda1', 'parent', 'teda-p50', 'teda-p43', NULL, NULL, true, NULL, NULL),
  ('teda-r11', 'teda1', 'parent', 'teda-p4', 'teda-p5', NULL, NULL, true, NULL, NULL),
  ('teda-r52', 'teda1', 'parent', 'teda-p20', 'teda-p34', NULL, NULL, true, NULL, NULL),
  ('teda-r1', 'teda1', 'spouse', 'teda-p1', 'teda-p2', NULL, NULL, true, NULL, NULL),
  ('teda-r59', 'teda1', 'parent', 'teda-p36', 'teda-p40', NULL, NULL, true, NULL, NULL),
  ('teda-r82', 'teda1', 'parent', 'teda-p52', 'teda-p44', NULL, NULL, true, NULL, NULL),
  ('teda-r83', 'teda1', 'parent', 'teda-p52', 'teda-p46', NULL, NULL, true, NULL, NULL),
  ('teda-r84', 'teda1', 'parent', 'teda-p52', 'teda-p48', NULL, NULL, true, NULL, NULL),
  ('teda-r85', 'teda1', 'parent', 'teda-p52', 'teda-p56', NULL, NULL, true, NULL, NULL),
  ('teda-r86', 'teda1', 'parent', 'teda-p52', 'teda-p57', NULL, NULL, true, NULL, NULL),
  ('teda-r87', 'teda1', 'parent', 'teda-p52', 'teda-p58', NULL, NULL, true, NULL, NULL),
  ('teda-r88', 'teda1', 'parent', 'teda-p52', 'teda-p37', NULL, NULL, true, NULL, NULL),
  ('teda-r89', 'teda1', 'parent', 'teda-p36', 'teda-p53', NULL, NULL, true, NULL, NULL),
  ('teda-r90', 'teda1', 'parent', 'teda-p36', 'teda-p54', NULL, NULL, true, NULL, NULL),
  ('teda-r91', 'teda1', 'parent', 'teda-p36', 'teda-p55', NULL, NULL, true, NULL, NULL),
  ('teda-r22', 'teda1', 'parent', 'teda-p9', 'teda-p16', NULL, NULL, true, NULL, NULL),
  ('teda-r61', 'teda1', 'parent', 'teda-p36', 'teda-p42', NULL, NULL, true, NULL, NULL),
  ('teda-r62', 'teda1', 'parent', 'teda-p36', 'teda-p43', NULL, NULL, true, NULL, NULL),
  ('teda-r78', 'teda1', 'parent', 'teda-p50', 'teda-p40', NULL, NULL, true, NULL, NULL),
  ('teda-r79', 'teda1', 'parent', 'teda-p50', 'teda-p54', NULL, NULL, true, NULL, NULL),
  ('teda-r12', 'teda1', 'parent', 'teda-p3', 'teda-p6', NULL, NULL, true, NULL, NULL),
  ('teda-r13', 'teda1', 'parent', 'teda-p4', 'teda-p6', NULL, NULL, true, NULL, NULL),
  ('teda-r14', 'teda1', 'parent', 'teda-p3', 'teda-p7', NULL, NULL, true, NULL, NULL),
  ('teda-r15', 'teda1', 'parent', 'teda-p4', 'teda-p7', NULL, NULL, true, NULL, NULL),
  ('teda-r53', 'teda1', 'parent', 'teda-p20', 'teda-p35', NULL, NULL, true, NULL, NULL),
  ('teda-r54', 'teda1', 'parent', 'teda-p21', 'teda-p36', NULL, NULL, true, NULL, NULL),
  ('teda-r55', 'teda1', 'parent', 'teda-p36', 'teda-p37', NULL, NULL, true, NULL, NULL),
  ('teda-r35', 'teda1', 'parent', 'teda-p13', 'teda-p22', NULL, NULL, true, NULL, NULL),
  ('teda-r46', 'teda1', 'parent', 'teda-p20', 'teda-p28', NULL, NULL, true, NULL, NULL),
  ('teda-r47', 'teda1', 'parent', 'teda-p20', 'teda-p29', NULL, NULL, true, NULL, NULL),
  ('teda-r48', 'teda1', 'parent', 'teda-p20', 'teda-p30', NULL, NULL, true, NULL, NULL),
  ('teda-r57', 'teda1', 'parent', 'teda-p36', 'teda-p38', NULL, NULL, true, NULL, NULL),
  ('teda-r92', 'teda1', 'parent', 'teda-p36', 'teda-p56', NULL, NULL, true, NULL, NULL),
  ('teda-r93', 'teda1', 'parent', 'teda-p36', 'teda-p57', NULL, NULL, true, NULL, NULL),
  ('teda-r23', 'teda1', 'parent', 'teda-p11', 'teda-p16', NULL, NULL, true, NULL, NULL),
  ('teda-r45', 'teda1', 'parent', 'teda-p14', 'teda-p27', NULL, NULL, true, NULL, NULL),
  ('teda-r63', 'teda1', 'parent', 'teda-p36', 'teda-p44', NULL, NULL, true, NULL, NULL),
  ('teda-r64', 'teda1', 'parent', 'teda-p36', 'teda-p45', NULL, NULL, true, NULL, NULL),
  ('teda-r65', 'teda1', 'parent', 'teda-p36', 'teda-p46', NULL, NULL, true, NULL, NULL),
  ('teda-r66', 'teda1', 'parent', 'teda-p36', 'teda-p47', NULL, NULL, true, NULL, NULL),
  ('teda-r67', 'teda1', 'parent', 'teda-p36', 'teda-p48', NULL, NULL, true, NULL, NULL),
  ('teda-r49', 'teda1', 'parent', 'teda-p20', 'teda-p31', NULL, NULL, true, NULL, NULL),
  ('teda-r2', 'teda1', 'spouse', 'teda-p4', 'teda-p3', NULL, NULL, true, NULL, NULL),
  ('teda-r3', 'teda1', 'spouse', 'teda-p8', 'teda-p7', NULL, NULL, true, NULL, NULL),
  ('teda-r44', 'teda1', 'parent', 'teda-p9', 'teda-p27', NULL, NULL, true, NULL, NULL),
  ('teda-r16', 'teda1', 'parent', 'teda-p7', 'teda-p9', NULL, NULL, true, NULL, NULL),
  ('teda-r17', 'teda1', 'parent', 'teda-p8', 'teda-p9', NULL, NULL, true, NULL, NULL),
  ('teda-r18', 'teda1', 'parent', 'teda-p7', 'teda-p10', NULL, NULL, true, NULL, NULL),
  ('teda-r19', 'teda1', 'parent', 'teda-p8', 'teda-p10', NULL, NULL, true, NULL, NULL),
  ('teda-r20', 'teda1', 'parent', 'teda-p9', 'teda-p15', NULL, NULL, true, NULL, NULL),
  ('teda-r21', 'teda1', 'parent', 'teda-p11', 'teda-p15', NULL, NULL, true, NULL, NULL),
  ('teda-r50', 'teda1', 'parent', 'teda-p20', 'teda-p32', NULL, NULL, true, NULL, NULL),
  ('teda-r51', 'teda1', 'parent', 'teda-p20', 'teda-p33', NULL, NULL, true, NULL, NULL),
  ('teda-r8', 'teda1', 'parent', 'teda-p1', 'teda-p3', NULL, NULL, true, NULL, NULL),
  ('teda-r77', 'teda1', 'parent', 'teda-p50', 'teda-p45', NULL, NULL, true, NULL, NULL),
  ('teda-r4', 'teda1', 'spouse', 'teda-p9', 'teda-p11', NULL, NULL, true, NULL, NULL),
  ('teda-r5', 'teda1', 'spouse', 'teda-p9', 'teda-p12', NULL, NULL, true, NULL, NULL),
  ('teda-r60', 'teda1', 'parent', 'teda-p36', 'teda-p41', NULL, NULL, true, NULL, NULL),
  ('teda-r24', 'teda1', 'parent', 'teda-p9', 'teda-p17', NULL, NULL, true, NULL, NULL),
  ('teda-r25', 'teda1', 'parent', 'teda-p11', 'teda-p17', NULL, NULL, true, NULL, NULL),
  ('teda-r6', 'teda1', 'spouse', 'teda-p9', 'teda-p13', NULL, NULL, true, NULL, NULL),
  ('teda-r7', 'teda1', 'spouse', 'teda-p9', 'teda-p14', NULL, NULL, true, NULL, NULL),
  ('teda-r42', 'teda1', 'parent', 'teda-p9', 'teda-p26', NULL, NULL, true, NULL, NULL),
  ('teda-r43', 'teda1', 'parent', 'teda-p14', 'teda-p26', NULL, NULL, true, NULL, NULL),
  ('teda-r26', 'teda1', 'parent', 'teda-p9', 'teda-p18', NULL, NULL, true, NULL, NULL),
  ('teda-r27', 'teda1', 'parent', 'teda-p11', 'teda-p18', NULL, NULL, true, NULL, NULL),
  ('teda-r30', 'teda1', 'parent', 'teda-p9', 'teda-p20', NULL, NULL, true, NULL, NULL),
  ('teda-r31', 'teda1', 'parent', 'teda-p12', 'teda-p20', NULL, NULL, true, NULL, NULL),
  ('teda-r71', 'teda1', 'parent', 'teda-p50', 'teda-p47', NULL, NULL, true, NULL, NULL),
  ('5lafd43ptmr7txmgz', 'teda1', 'parent', 'teda-p12', 'teda-p19', NULL, NULL, true, NULL, NULL),
  ('teda-r80', 'teda1', 'parent', 'teda-p51', 'teda-p55', NULL, NULL, true, NULL, NULL),
  ('teda-r81', 'teda1', 'parent', 'teda-p51', 'teda-p41', NULL, NULL, true, NULL, NULL),
  ('teda-r72', 'teda1', 'parent', 'teda-p50', 'teda-p39', NULL, NULL, true, NULL, NULL),
  ('teda-r73', 'teda1', 'parent', 'teda-p50', 'teda-p38', NULL, NULL, true, NULL, NULL),
  ('teda-r74', 'teda1', 'parent', 'teda-p50', 'teda-p42', NULL, NULL, true, NULL, NULL),
  ('teda-r32', 'teda1', 'parent', 'teda-p9', 'teda-p21', NULL, NULL, true, NULL, NULL),
  ('teda-r33', 'teda1', 'parent', 'teda-p13', 'teda-p21', NULL, NULL, true, NULL, NULL),
  ('teda-r34', 'teda1', 'parent', 'teda-p9', 'teda-p22', NULL, NULL, true, NULL, NULL),
  ('teda-r58', 'teda1', 'parent', 'teda-p36', 'teda-p39', NULL, NULL, true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- VÉRIFICATION
SELECT 'persons' AS objet, count(*) AS total FROM public.persons WHERE tree_id = 'teda1'
UNION ALL
SELECT 'relationships', count(*) FROM public.relationships WHERE tree_id = 'teda1';
-- Attendu : persons = 57, relationships = 93.
