-- ============================================================================
-- ENRICHISSEMENT — Famille TEDA (arbre 'teda1')
-- À exécuter dans le SQL Editor Supabase APRÈS le seed (seed-teda-rpc.sql) :
-- toutes les personnes/relations référencées (teda-p*, teda-r*) doivent exister.
-- Exécuté comme rôle privilégié (SQL Editor) → la RLS est contournée.
--
-- NOTE DE COHÉRENCE : teda-p21 (TSANA Wamba Tchoupa) était 'male' dans le seed
-- mais la biographie ci-dessous la décrit comme une femme (Née / Fille / Époux
-- WAMBA TCHOUPA). On corrige donc gender = 'female' (sinon couple male×male avec
-- teda-p49 et badge incohérent). Retirez cette ligne si l'info était erronée.
-- ============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- 1. BIOGRAPHIES ENRICHIES
-- ───────────────────────────────────────────────────────────────────────────

-- TSANA Sébastien (teda-p36)
UPDATE public.persons SET
  birth_place = '{"city":"Bouleng"}'::jsonb,
  bio = 'Né vers 1948 au village de Bouleng.
Fils de TSANA Wamba Tchoupa. Parcours scolaire :
EP (BEPE), CEG 1966–1970, Lycée Dschang 1970–1976,
Bac C 1977, ENS Collège 1977–1979,
ENS GIT DUA 1980–1986 (diplômé).
Carrière professionnelle : 1986–1998,
secteurs Électricité, Chimie, Atangana.
Père de DEMANOU Donald (né 1994).'
WHERE id = 'teda-p36';

-- DEMANOU FOTIE (teda-p20)
UPDATE public.persons SET
  bio = 'Né en 1913, décédé en 1988.
Fils de TEDA FOTIE et DONGHOCK (2e épouse).
A eu 8 épouses (non identifiées dans les notes).
Enfants connus : DONGMO Lucienne, MEKEUTIO Julienne,
GUEFACK Berthe, DEMANOU Suzanne, MAGUE Marie,
KAGHO Monique, DANCHI Martine, MEGNIGHO Francesca.
Graphie variante : DEMANOU CHOTIE.'
WHERE id = 'teda-p20';

-- TEDA FOTIE (teda-p9) — ancêtre pivot
UPDATE public.persons SET
  bio = 'Ancêtre pivot de toute la lignée TEDA (FOTIE).
Né vers 1870. Fils de MEGNIGUE et Fo''o GAPGHO (Chef).
Graphies variantes : TEDA CFOTIE, TEDA''A FOTIE 1er.
A eu 4 épouses : MESSE (J.E. DONG), DONGHOCK/KEMDONG,
DONGMO Tejioguim, DONGMO Tela.
Nombreux descendants sur 4 générations.'
WHERE id = 'teda-p9';

-- TSANA Wamba Tchoupa (teda-p21)
UPDATE public.persons SET
  gender = 'female',
  bio = 'Née en 1918, décédée en 2013.
Fille de TEDA FOTIE et DONGMO Tejioguim (3e épouse).
Époux : WAMBA TCHOUPA.
Fils connu : TSANA Sébastien (né ~1948, village Bouleng).
Note : date de naissance corrigée de ~1948 à 1918.'
WHERE id = 'teda-p21';

-- TEFOUETZAP (teda-p1) — fondateur
UPDATE public.persons SET
  bio = 'Fondateur de la lignée. Village de Zem.
Épouse : MAFOKO (village Bansoa).
Enfant unique : METIOLO.
Note : orthographe corrigée de TEFOUEZAD
en TEFOUETZAP.'
WHERE id = 'teda-p1';

-- MEGNIGUE × Fo''o GAPGHO (gen 2)
UPDATE public.persons SET
  bio = 'Fille de METIOLO et MO''O SOUKA (notre lignée).
Épouse du Chef Fo''o GAPGHO.
Enfants : TEDA FOTIE (ancêtre pivot)
et MEFOUEGONG (décédée sans enfants).'
WHERE id = 'teda-p7';

UPDATE public.persons SET
  bio = 'Chef. Époux de MEGNIGUE.
Père de TEDA FOTIE et MEFOUEGONG.'
WHERE id = 'teda-p8';

-- MEFOUEGONG (teda-p10)
UPDATE public.persons SET
  bio = 'Sœur de TEDA FOTIE.
Mariée à KEMDONHAGHO.
Décédée sans descendance.'
WHERE id = 'teda-p10';

-- DEMANOU Donald (teda-p37)
UPDATE public.persons SET
  bio = 'Né en 1994. Descendant le plus récent
de la lignée (génération 6, 7e depuis TEFOUETZAP).
Père : TSANA Sébastien (~1948).
Grand-mère : TSANA Wamba Tchoupa (1918–2013).
Arrière-grand-père : TEDA FOTIE (~1870).
Fondateurs : TEFOUETZAP × MAFOKO (génération 0).'
WHERE id = 'teda-p37';

-- METIOLO (teda-p3)
UPDATE public.persons SET
  bio = 'Enfant unique de TEFOUETZAP et MAFOKO.
Épouse de MO''O SOUKA.
3 enfants : MEZEKENG (mariée à Tetsa''a, Banzaï),
METSAGHO (mariée à Metsui-Tekeng, Zem),
MEGNIGUE (mariée au Chef Fo''o Gapgho — notre lignée).'
WHERE id = 'teda-p3';

-- MEZEKENG (teda-p5)
UPDATE public.persons SET
  bio = 'Fille de METIOLO et MO''O SOUKA.
Mariée à Tetsa''a, à Banzaï.'
WHERE id = 'teda-p5';

-- METSAGHO (teda-p6)
UPDATE public.persons SET
  bio = 'Fille de METIOLO et MO''O SOUKA.
Mariée à Metsui-Tekeng, à Zem.'
WHERE id = 'teda-p6';

-- Enfants TEDA × MESSE
UPDATE public.persons SET
  bio = 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Tsuelépo.'
WHERE id = 'teda-p15'; -- TSAGUE

UPDATE public.persons SET
  bio = 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Megnin-za. Quartier Sa''a.'
WHERE id = 'teda-p16'; -- KADJIO

UPDATE public.persons SET
  bio = 'Fille de TEDA FOTIE et MESSE (1ère épouse).
Alias : Letsie. Quartier Letsie.'
WHERE id = 'teda-p17'; -- MEFOKO

UPDATE public.persons SET
  bio = 'Enfant de TEDA FOTIE et MESSE (1ère épouse).
Note : rattachée à la branche DONGHOCK
selon correction du 13 juin 2026.'
WHERE id = 'teda-p19'; -- NONGNI

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CORRECTION BRANCHEMENT NONGNI (rattachée à DONGHOCK, correction 13/06/2026)
-- ───────────────────────────────────────────────────────────────────────────
-- Supprime les anciennes relations parent (TEDA→NONGNI, MESSE→NONGNI) puis
-- recrée TEDA→NONGNI (père inchangé) et DONGHOCK→NONGNI (mère corrigée).
DELETE FROM public.relationships
WHERE id IN ('teda-r28', 'teda-r29');
-- (teda-r28: TEDA→NONGNI via MESSE, teda-r29: MESSE→NONGNI)

INSERT INTO public.relationships
  (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r28b', 'teda1', 'parent', 'teda-p9',  'teda-p19', true),
  ('teda-r29b', 'teda1', 'parent', 'teda-p12', 'teda-p19', true)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. ÉPOUX DE TSANA Wamba Tchoupa
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, bio, is_alive)
VALUES
  ('teda-p49', 'teda1', 'WAMBA', 'TCHOUPA', 'male',
   'Époux de TSANA Wamba Tchoupa.', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.relationships
  (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  ('teda-r56', 'teda1', 'spouse', 'teda-p49', 'teda-p21', true)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. NOTES / QUESTIONS OUVERTES (consignées en bio)
-- ───────────────────────────────────────────────────────────────────────────

-- DJOUMESSI Mathias (teda-p38)
UPDATE public.persons SET
  bio = 'Branche étendue. Lien de parenté exact
à préciser — quelle branche de TEDA ?
(Point ouvert #1 du document de synthèse)'
WHERE id = 'teda-p38';

-- GNINZEKO Gaston (teda-p23)
UPDATE public.persons SET
  bio = 'Fils de TEDA FOTIE et DONGMO Tejioguim.
Né vers 1928. Prénom chrétien "Gaston" — à confirmer.'
WHERE id = 'teda-p23';

-- DANCHI Martine (teda-p28)
UPDATE public.persons SET
  bio = 'Fille de DEMANOU FOTIE.
Note : prénom Martine confirmé
(variante Albertine à écarter).'
WHERE id = 'teda-p28';

-- ───────────────────────────────────────────────────────────────────────────
-- 5. MÉTADONNÉES DE L'ARBRE
-- ───────────────────────────────────────────────────────────────────────────
UPDATE public.trees SET
  description = 'Lignée FOTIE — 7 générations
(~1870 – 1994). Reconstitution juin 2026,
intégrant corrections du 13 juin 2026.
~55 membres identifiés. Source : notes manuscrites.',
  settings = '{
    "rootPersonId": "teda-p9",
    "generationCount": 7,
    "foundingYear": "~1870",
    "latestDescendant": "DEMANOU Donald (1994)"
  }'::jsonb
WHERE id = 'teda1';
