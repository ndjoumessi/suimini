-- ============================================================================
-- TEDA (teda1) — Famille de DJOUMESSI Mathias (teda-p38)
-- Ajoute ses 2 épouses + 12 enfants (14 personnes) et leurs 26 relations.
-- À lancer dans le SQL Editor Supabase (rôle privilégié → RLS contournée).
-- NE TOUCHE PAS public.trees (owner_id conservé). IDs TEXT/base36.
--
-- ⚠️ CORRECTIONS par rapport au brouillon fourni :
--  1. CONVENTION DE NOMS de l'arbre TEDA : first_name = NOM (famille), last_name =
--     prénom (cf. rows existantes ('DJOUMESSI','Mathias'), ('TSANA','Sébastien') et
--     le commentaire de update-teda-v3-corrections.sql). Le brouillon les inversait
--     ('Lucienne','KENFACK') → les nouveaux membres se seraient affichés « prénom /
--     NOM » à l'envers du reste de l'arbre. Ici : first_name = NOM, last_name = prénom.
--  2. Le lieu de naissance va dans la COLONNE dédiée `birth_place` (JSONB {"city":…}),
--     PAS dans `extra` : `extra` est un fourre-tout, et depuis le fix rowToPerson les
--     colonnes canoniques priment — un birthPlace mis dans `extra` serait ignoré.
--  3. `is_alive`/`is_active` posés explicitement à true (comme les rows existantes).
--
-- Ordre d'âge encodé via birth_date (mois distincts pour départager une même année :
--   1989 → LEKOGUIA Anne Marie (01) avant DJOUMESSI Romel Nelson (07) ;
--   2001 → AZEKENG Anderson (01) avant DJOUMESSI KENFACK Vitaly (07)).
-- ============================================================================

-- ── PRÉ-CONTRÔLE (lancer d'abord ; attendu max = teda-p58 / teda-r94) ─────────
-- SELECT id FROM public.persons       WHERE tree_id='teda1' ORDER BY id DESC LIMIT 5;
-- SELECT id FROM public.relationships WHERE tree_id='teda1' ORDER BY id DESC LIMIT 5;
-- Si le max diffère de teda-p58 / teda-r94, décaler teda-p59.. / teda-r95.. avant de lancer.

BEGIN;

-- ── ÉPOUSES de DJOUMESSI Mathias (teda-p38) ──────────────────────────────────
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, birth_date, birth_place, is_alive, extra)
VALUES
  ('teda-p59', 'teda1', 'KENFACK',   'Lucienne',      'female', '1960-01-01', '{"city":"Kemtio"}'::jsonb, true, NULL),
  ('teda-p60', 'teda1', 'MAGNIFEUT', 'Marie Pascale', 'female', '1960-01-01', NULL,                       true, NULL);

-- ── ENFANTS DJOUMESSI Mathias × KENFACK Lucienne (ordre d'âge) ────────────────
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, birth_date, is_alive, extra)
VALUES
  ('teda-p61', 'teda1', 'TIOTSIA',           'Luc Mirabeau', 'male',   '1984-01-01', true, NULL),
  ('teda-p62', 'teda1', 'TSANA',             'Arnauld',      'male',   '1986-01-01', true, NULL),
  ('teda-p63', 'teda1', 'LEKOGUIA',          'Anne Marie',   'female', '1989-01-01', true, NULL),
  ('teda-p64', 'teda1', 'TEKEUGUETSOP',      'Dorese',       'female', '1993-01-01', true, NULL),
  ('teda-p65', 'teda1', 'TSAGUE',            'Martial',      'male',   '1993-07-01', true, NULL),
  ('teda-p66', 'teda1', 'FEUDJIO',           'Rebecca',      'female', '1997-01-01', true, NULL),
  ('teda-p67', 'teda1', 'DJOUMESSI KENFACK', 'Vitaly',       'male',   '2001-07-01', true, NULL);

-- ── ENFANTS DJOUMESSI Mathias × MAGNIFEUT Marie Pascale (ordre d'âge) ─────────
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, birth_date, is_alive, extra)
VALUES
  ('teda-p68', 'teda1', 'SOKENG',   'Francis',      'male', '1988-01-01', true, NULL),
  ('teda-p69', 'teda1', 'DJOUMESSI','Romel Nelson', 'male', '1989-07-01', true, NULL),
  ('teda-p70', 'teda1', 'NANGMO',   'Merlin',       'male', '1992-01-01', true, NULL),
  ('teda-p71', 'teda1', 'DONGMO',   'Jean Michel',  'male', '1996-01-01', true, NULL),
  ('teda-p72', 'teda1', 'AZEKENG',  'Anderson',     'male', '2001-01-01', true, NULL);

-- ── RELATIONS : mariages (person1 = mari, person2 = épouse) ───────────────────
INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r95', 'teda1', 'spouse', 'teda-p38', 'teda-p59', true),
  ('teda-r96', 'teda1', 'spouse', 'teda-p38', 'teda-p60', true);

-- ── RELATIONS parent→enfant (person1 = PARENT, person2 = ENFANT) ──────────────
-- Père DJOUMESSI Mathias → enfants KENFACK
INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r97',  'teda1', 'parent', 'teda-p38', 'teda-p61', true),
  ('teda-r98',  'teda1', 'parent', 'teda-p38', 'teda-p62', true),
  ('teda-r99',  'teda1', 'parent', 'teda-p38', 'teda-p63', true),
  ('teda-r100', 'teda1', 'parent', 'teda-p38', 'teda-p64', true),
  ('teda-r101', 'teda1', 'parent', 'teda-p38', 'teda-p65', true),
  ('teda-r102', 'teda1', 'parent', 'teda-p38', 'teda-p66', true),
  ('teda-r103', 'teda1', 'parent', 'teda-p38', 'teda-p67', true);

-- Mère KENFACK Lucienne → enfants
INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r104', 'teda1', 'parent', 'teda-p59', 'teda-p61', true),
  ('teda-r105', 'teda1', 'parent', 'teda-p59', 'teda-p62', true),
  ('teda-r106', 'teda1', 'parent', 'teda-p59', 'teda-p63', true),
  ('teda-r107', 'teda1', 'parent', 'teda-p59', 'teda-p64', true),
  ('teda-r108', 'teda1', 'parent', 'teda-p59', 'teda-p65', true),
  ('teda-r109', 'teda1', 'parent', 'teda-p59', 'teda-p66', true),
  ('teda-r110', 'teda1', 'parent', 'teda-p59', 'teda-p67', true);

-- Père DJOUMESSI Mathias → enfants MAGNIFEUT
INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r111', 'teda1', 'parent', 'teda-p38', 'teda-p68', true),
  ('teda-r112', 'teda1', 'parent', 'teda-p38', 'teda-p69', true),
  ('teda-r113', 'teda1', 'parent', 'teda-p38', 'teda-p70', true),
  ('teda-r114', 'teda1', 'parent', 'teda-p38', 'teda-p71', true),
  ('teda-r115', 'teda1', 'parent', 'teda-p38', 'teda-p72', true);

-- Mère MAGNIFEUT Marie Pascale → enfants
INSERT INTO public.relationships (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r116', 'teda1', 'parent', 'teda-p60', 'teda-p68', true),
  ('teda-r117', 'teda1', 'parent', 'teda-p60', 'teda-p69', true),
  ('teda-r118', 'teda1', 'parent', 'teda-p60', 'teda-p70', true),
  ('teda-r119', 'teda1', 'parent', 'teda-p60', 'teda-p71', true),
  ('teda-r120', 'teda1', 'parent', 'teda-p60', 'teda-p72', true);

COMMIT;

-- ── VÉRIFICATION (attendu : persons = 71, relationships = 119) ────────────────
SELECT 'persons'       AS objet, count(*) AS total FROM public.persons       WHERE tree_id = 'teda1'
UNION ALL
SELECT 'relationships' AS objet, count(*) AS total FROM public.relationships WHERE tree_id = 'teda1';
-- Attendu : persons = 71 (57 + 14), relationships = 119 (93 + 26).
