-- ============================================================================
-- BRANCHE ÉTENDUE — rattachement à TSANA Sébastien (CONFIRMÉ juin 2026)
--
-- Les 11 membres classés « branche étendue » (teda-p38 → teda-p48) sont TOUS
-- des enfants de TSANA Sébastien (teda-p36, né ~1948, village Bouleng).
-- Lien confirmé le 20 juin 2026. Convention : type 'parent' → person1 = PARENT,
-- person2 = ENFANT. ids de relations : teda-r57 → teda-r67.
-- ============================================================================

-- Rattacher les 11 membres à TSANA Sébastien
INSERT INTO public.relationships
  (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r57','teda1','parent','teda-p36','teda-p38',true),
  ('teda-r58','teda1','parent','teda-p36','teda-p39',true),
  ('teda-r59','teda1','parent','teda-p36','teda-p40',true),
  ('teda-r60','teda1','parent','teda-p36','teda-p41',true),
  ('teda-r61','teda1','parent','teda-p36','teda-p42',true),
  ('teda-r62','teda1','parent','teda-p36','teda-p43',true),
  ('teda-r63','teda1','parent','teda-p36','teda-p44',true),
  ('teda-r64','teda1','parent','teda-p36','teda-p45',true),
  ('teda-r65','teda1','parent','teda-p36','teda-p46',true),
  ('teda-r66','teda1','parent','teda-p36','teda-p47',true),
  ('teda-r67','teda1','parent','teda-p36','teda-p48',true)
ON CONFLICT (id) DO NOTHING;

-- Mettre à jour les bios pour refléter le lien
UPDATE public.persons SET
  bio = 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.'
WHERE id = 'teda-p38'; -- DJOUMESSI Mathias

UPDATE public.persons SET
  bio = 'Fille de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.'
WHERE id IN (
  'teda-p39', -- AKITIO Geneviève
  'teda-p40', -- DONFAKA Hortense
  'teda-p44', -- NAMPA Léonie
  'teda-p46', -- ZEKENG Delphine
  'teda-p47', -- ZEKENG Lucienne
  'teda-p48'  -- GUEMESIO Lucie
);

UPDATE public.persons SET
  bio = 'Fils de TSANA Sébastien (~1948, Bouleng).
Branche étendue — lien confirmé juin 2026.'
WHERE id IN (
  'teda-p41', -- GAOHO Simplice
  'teda-p42', -- KADJIO Augustin
  'teda-p43', -- KENGO Dieudonné
  'teda-p45'  -- TSANA Hégène
);

-- Mettre à jour la bio de TSANA Sébastien
UPDATE public.persons SET
  bio = 'Né vers 1948 au village de Bouleng.
Fils de TSANA Wamba Tchoupa (1918-2013).
Parcours scolaire : EP (BEPE), CEG 1966-1970,
Lycée Dschang 1970-1976, Bac C 1977,
ENS Collège 1977-1979, ENS GIT DUA 1980-1986.
Carrière : 1986-1998, Électricité, Chimie, Atangana.
Enfants : DJOUMESSI Mathias, AKITIO Geneviève,
DONFAKA Hortense, GAOHO Simplice, KADJIO Augustin,
KENGO Dieudonné, NAMPA Léonie, TSANA Hégène,
ZEKENG Delphine, ZEKENG Lucienne, GUEMESIO Lucie,
DEMANOU Donald.'
WHERE id = 'teda-p36';

-- Mettre à jour le nombre de personnes dans l'arbre
UPDATE public.trees SET
  description = 'Lignée FOTIE - 7 générations
(~1870 - 1994+). Reconstitution juin 2026.
49 membres + 11 enfants de TSANA Sébastien = 60 membres.
Source : notes manuscrites + corrections orales.'
WHERE id = 'teda1';

-- ════════════════════════════════════════════════════════════════════════════
-- Après application : clique « ↻ Synchroniser » dans l'app, puis les 11 nœuds
-- s'afficheront reliés à TSANA Sébastien dans l'arbre.
-- ============================================================================
