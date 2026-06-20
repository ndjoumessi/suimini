-- ============================================================================
-- SEED — Famille TEDA (FOTIE), 7 générations — arbre tree_id = 'teda1'
-- Migration manuelle : à exécuter dans le SQL Editor Supabase.
-- Idempotent : ON CONFLICT (id) DO NOTHING sur chaque INSERT (re-exécutable).
--
-- IMPORTANT — alignement avec le schéma réel + le rendu de l'app :
--   * relationships.type : on utilise 'parent' (PAS 'parent-child') avec
--     person1_id = PARENT et person2_id = ENFANT, et 'spouse' pour les unions.
--     C'est exactement ce que src/lib/treeUtils.ts attend
--     (getParents/getChildren filtrent r.type === 'parent') : avec 'parent-child'
--     les liens parent/enfant ne s'afficheraient pas dans l'arbre.
--   * persons.birth_place est de type JSONB → on stocke {"city": "..."}.
--   * La colonne de biographie est `bio` (il n'existe pas de colonne `biography`).
--   * created_at / updated_at : laissés aux valeurs par défaut (now()).
--
-- PRÉREQUIS — l'arbre 'teda1' doit déjà exister (FK persons.tree_id -> trees.id).
-- Sinon, créez-le d'abord en renseignant VOTRE owner_id (auth.users.id) :
--
--   INSERT INTO public.trees (id, owner_id, name, description, settings)
--   VALUES ('teda1', '<VOTRE-AUTH-UID>', 'Famille TEDA',
--           'Lignée FOTIE — 7 générations',
--           '{"rootPersonId": "teda-p9"}'::jsonb)
--   ON CONFLICT (id) DO NOTHING;
--
-- (rootPersonId = teda-p9 = TEDA FOTIE, l'ancêtre pivot, pour centrer l'arbre.)
-- ============================================================================

-- ───────────────────────────── PERSONNES ──────────────────────────────────
INSERT INTO public.persons
  (id, tree_id, first_name, last_name, gender, birth_date, death_date, birth_place, bio, is_alive)
VALUES
  -- GEN 0
  ('teda-p1',  'teda1', 'TEFOUETZAP', '',       'male',    '1850', NULL, '{"city":"Zem"}'::jsonb,    'GEN 0 — souche de la lignée (village Zem).', false),
  ('teda-p2',  'teda1', 'MAFOKO',     '',       'female',  NULL,   NULL, '{"city":"Bansoa"}'::jsonb, 'GEN 0 — épouse de TEFOUETZAP (village Bansoa).', false),

  -- GEN 1
  ('teda-p3',  'teda1', 'METIOLO',    '',       'female',  NULL,   NULL, NULL, 'Fille de TEFOUETZAP et MAFOKO.', false),
  ('teda-p4',  'teda1', 'MO''O',      'SOUKA',  'male',    NULL,   NULL, NULL, 'Époux de METIOLO.', false),

  -- GEN 2
  ('teda-p5',  'teda1', 'MEZEKENG',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO.', false),
  ('teda-p6',  'teda1', 'METSAGHO',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO.', false),
  ('teda-p7',  'teda1', 'MEGNIGUE',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO (notre lignée).', false),
  ('teda-p8',  'teda1', 'Fo''o',      'GAPGHO', 'male',    NULL,   NULL, NULL, 'Chef, époux de MEGNIGUE.', false),

  -- GEN 3 — ancêtre pivot
  ('teda-p9',  'teda1', 'TEDA',       'FOTIE',  'male',    '1870', NULL, NULL, 'Ancêtre pivot. Prénom chrétien TEDA, nom FOTIE.', false),
  ('teda-p10', 'teda1', 'MEFOUEGONG', '',       'female',  NULL,   NULL, NULL, 'Soeur de TEDA, décédée sans enfants.', false),
  ('teda-p11', 'teda1', 'MESSE',      '',       'female',  NULL,   NULL, NULL, '1ère épouse de TEDA (J.E. DONG).', false),
  ('teda-p12', 'teda1', 'DONGHOCK',   '',       'female',  NULL,   NULL, NULL, '2ème épouse de TEDA (alias KEMDONG).', false),
  ('teda-p13', 'teda1', 'DONGMO',     'Tejioguim', 'female', NULL, NULL, NULL, '3ème épouse de TEDA.', false),
  ('teda-p14', 'teda1', 'DONGMO',     'Tela',   'female',  NULL,   NULL, NULL, '4ème épouse de TEDA.', false),

  -- GEN 4 — enfants TEDA x MESSE
  ('teda-p15', 'teda1', 'TSAGUE',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Tsuelépo).', false),
  ('teda-p16', 'teda1', 'KADJIO',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Megnin-za, quartier Sa''a).', false),
  ('teda-p17', 'teda1', 'MEFOKO',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Letsie, quartier Letsie).', false),
  ('teda-p18', 'teda1', 'MEPOPA',     '',       'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et MESSE.', false),
  ('teda-p19', 'teda1', 'NONGNI',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Saïa, branche DONGHOCK).', false),

  -- GEN 4 — enfants TEDA x DONGHOCK
  ('teda-p20', 'teda1', 'DEMANOU',    'FOTIE',  'male',    '1913', '1988', NULL, 'Fils de TEDA et DONGHOCK.', false),

  -- GEN 4 — enfants TEDA x DONGMO Tejioguim
  ('teda-p21', 'teda1', 'TSANA',      'Wamba Tchoupa', 'male', '1918', '2013', NULL, 'Fils de TEDA et DONGMO Tejioguim.', false),
  ('teda-p22', 'teda1', 'GUIMATIO',   '',       'unknown', '1913', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),
  ('teda-p23', 'teda1', 'GNINZEKO',   'Gaston', 'male',    '1928', NULL, NULL, 'Fils de TEDA et DONGMO Tejioguim.', false),
  ('teda-p24', 'teda1', 'MEGNIGUE',   '',       'female',  '1933', NULL, NULL, 'Fille de TEDA et DONGMO Tejioguim.', false),
  ('teda-p25', 'teda1', 'ZEKENG',     '',       'unknown', '1923', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),

  -- GEN 4 — enfants TEDA x DONGMO Tela
  ('teda-p26', 'teda1', 'GHODA',      'Bfou',   'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),
  ('teda-p27', 'teda1', 'MEGHOFOUET', 'Tekang', 'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),

  -- GEN 5 — enfants DEMANOU FOTIE (mère non précisée)
  ('teda-p28', 'teda1', 'DANCHI',     'Martine',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p29', 'teda1', 'DEMANOU',    'Suzanne',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p30', 'teda1', 'DONGMO',     'Lucienne',  'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p31', 'teda1', 'GUEFACK',    'Berthe',    'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p32', 'teda1', 'KAGHO',      'Monique',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p33', 'teda1', 'MAGUE',      'Marie',     'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p34', 'teda1', 'MEGNIGHO',   'Francesca', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
  ('teda-p35', 'teda1', 'MEKEUTIO',   'Julienne',  'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),

  -- GEN 5 — fils de TSANA Wamba Tchoupa
  ('teda-p36', 'teda1', 'TSANA',      'Sébastien', 'male',  '1948', NULL, NULL, 'Fils de TSANA Wamba Tchoupa.', true),

  -- GEN 6 — fils de TSANA Sébastien
  ('teda-p37', 'teda1', 'DEMANOU',    'Donald',    'male',  '1994', NULL, NULL, 'Fils de TSANA Sébastien.', true),

  -- BRANCHE ÉTENDUE (liens de parenté à préciser — aucune relation créée ici)
  ('teda-p38', 'teda1', 'DJOUMESSI',  'Mathias',   'male',   '1956', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p39', 'teda1', 'AKITIO',     'Geneviève', 'female', '1953', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p40', 'teda1', 'DONFAKA',    'Hortense',  'female', '1972', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p41', 'teda1', 'GAOHO',      'Simplice',  'male',   '1971', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p42', 'teda1', 'KADJIO',     'Augustin',  'male',   '1958', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p43', 'teda1', 'KENGO',      'Dieudonné', 'male',   '1964', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p44', 'teda1', 'NAMPA',      'Léonie',    'female', '1967', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p45', 'teda1', 'TSANA',      'Hégène',    'male',   '1968', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p46', 'teda1', 'ZEKENG',     'Delphine',  'female', '1969', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p47', 'teda1', 'ZEKENG',     'Lucienne',  'female', '1945', NULL, NULL, 'Branche étendue (lien à préciser).', true),
  ('teda-p48', 'teda1', 'GUEMESIO',   'Lucie',     'female', '1983', NULL, NULL, 'Branche étendue (lien à préciser).', true)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────── RELATIONS ──────────────────────────────────
-- spouse : union ; parent : person1_id = PARENT, person2_id = ENFANT.
INSERT INTO public.relationships
  (id, tree_id, type, person1_id, person2_id, is_active)
VALUES
  -- Unions
  ('teda-r1',  'teda1', 'spouse', 'teda-p1',  'teda-p2',  true),   -- TEFOUETZAP x MAFOKO
  ('teda-r2',  'teda1', 'spouse', 'teda-p4',  'teda-p3',  true),   -- MO'O SOUKA x METIOLO
  ('teda-r3',  'teda1', 'spouse', 'teda-p8',  'teda-p7',  true),   -- Fo'o GAPGHO x MEGNIGUE
  ('teda-r4',  'teda1', 'spouse', 'teda-p9',  'teda-p11', true),   -- TEDA x MESSE
  ('teda-r5',  'teda1', 'spouse', 'teda-p9',  'teda-p12', true),   -- TEDA x DONGHOCK
  ('teda-r6',  'teda1', 'spouse', 'teda-p9',  'teda-p13', true),   -- TEDA x DONGMO Tejioguim
  ('teda-r7',  'teda1', 'spouse', 'teda-p9',  'teda-p14', true),   -- TEDA x DONGMO Tela

  -- METIOLO, enfant de TEFOUETZAP x MAFOKO
  ('teda-r8',  'teda1', 'parent', 'teda-p1',  'teda-p3',  true),
  ('teda-r9',  'teda1', 'parent', 'teda-p2',  'teda-p3',  true),

  -- MEZEKENG, METSAGHO, MEGNIGUE, enfants de METIOLO x MO'O SOUKA
  ('teda-r10', 'teda1', 'parent', 'teda-p3',  'teda-p5',  true),
  ('teda-r11', 'teda1', 'parent', 'teda-p4',  'teda-p5',  true),
  ('teda-r12', 'teda1', 'parent', 'teda-p3',  'teda-p6',  true),
  ('teda-r13', 'teda1', 'parent', 'teda-p4',  'teda-p6',  true),
  ('teda-r14', 'teda1', 'parent', 'teda-p3',  'teda-p7',  true),
  ('teda-r15', 'teda1', 'parent', 'teda-p4',  'teda-p7',  true),

  -- TEDA et MEFOUEGONG, enfants de MEGNIGUE x Fo'o GAPGHO
  ('teda-r16', 'teda1', 'parent', 'teda-p7',  'teda-p9',  true),
  ('teda-r17', 'teda1', 'parent', 'teda-p8',  'teda-p9',  true),
  ('teda-r18', 'teda1', 'parent', 'teda-p7',  'teda-p10', true),
  ('teda-r19', 'teda1', 'parent', 'teda-p8',  'teda-p10', true),

  -- Enfants de TEDA x MESSE
  ('teda-r20', 'teda1', 'parent', 'teda-p9',  'teda-p15', true),
  ('teda-r21', 'teda1', 'parent', 'teda-p11', 'teda-p15', true),
  ('teda-r22', 'teda1', 'parent', 'teda-p9',  'teda-p16', true),
  ('teda-r23', 'teda1', 'parent', 'teda-p11', 'teda-p16', true),
  ('teda-r24', 'teda1', 'parent', 'teda-p9',  'teda-p17', true),
  ('teda-r25', 'teda1', 'parent', 'teda-p11', 'teda-p17', true),
  ('teda-r26', 'teda1', 'parent', 'teda-p9',  'teda-p18', true),
  ('teda-r27', 'teda1', 'parent', 'teda-p11', 'teda-p18', true),
  ('teda-r28', 'teda1', 'parent', 'teda-p9',  'teda-p19', true),
  ('teda-r29', 'teda1', 'parent', 'teda-p11', 'teda-p19', true),

  -- Enfant de TEDA x DONGHOCK
  ('teda-r30', 'teda1', 'parent', 'teda-p9',  'teda-p20', true),
  ('teda-r31', 'teda1', 'parent', 'teda-p12', 'teda-p20', true),

  -- Enfants de TEDA x DONGMO Tejioguim
  ('teda-r32', 'teda1', 'parent', 'teda-p9',  'teda-p21', true),
  ('teda-r33', 'teda1', 'parent', 'teda-p13', 'teda-p21', true),
  ('teda-r34', 'teda1', 'parent', 'teda-p9',  'teda-p22', true),
  ('teda-r35', 'teda1', 'parent', 'teda-p13', 'teda-p22', true),
  ('teda-r36', 'teda1', 'parent', 'teda-p9',  'teda-p23', true),
  ('teda-r37', 'teda1', 'parent', 'teda-p13', 'teda-p23', true),
  ('teda-r38', 'teda1', 'parent', 'teda-p9',  'teda-p24', true),
  ('teda-r39', 'teda1', 'parent', 'teda-p13', 'teda-p24', true),
  ('teda-r40', 'teda1', 'parent', 'teda-p9',  'teda-p25', true),
  ('teda-r41', 'teda1', 'parent', 'teda-p13', 'teda-p25', true),

  -- Enfants de TEDA x DONGMO Tela
  ('teda-r42', 'teda1', 'parent', 'teda-p9',  'teda-p26', true),
  ('teda-r43', 'teda1', 'parent', 'teda-p14', 'teda-p26', true),
  ('teda-r44', 'teda1', 'parent', 'teda-p9',  'teda-p27', true),
  ('teda-r45', 'teda1', 'parent', 'teda-p14', 'teda-p27', true),

  -- Enfants de DEMANOU FOTIE (mère non précisée)
  ('teda-r46', 'teda1', 'parent', 'teda-p20', 'teda-p28', true),
  ('teda-r47', 'teda1', 'parent', 'teda-p20', 'teda-p29', true),
  ('teda-r48', 'teda1', 'parent', 'teda-p20', 'teda-p30', true),
  ('teda-r49', 'teda1', 'parent', 'teda-p20', 'teda-p31', true),
  ('teda-r50', 'teda1', 'parent', 'teda-p20', 'teda-p32', true),
  ('teda-r51', 'teda1', 'parent', 'teda-p20', 'teda-p33', true),
  ('teda-r52', 'teda1', 'parent', 'teda-p20', 'teda-p34', true),
  ('teda-r53', 'teda1', 'parent', 'teda-p20', 'teda-p35', true),

  -- TSANA Sébastien, fils de TSANA Wamba Tchoupa
  ('teda-r54', 'teda1', 'parent', 'teda-p21', 'teda-p36', true),

  -- DEMANOU Donald, fils de TSANA Sébastien
  ('teda-r55', 'teda1', 'parent', 'teda-p36', 'teda-p37', true)
ON CONFLICT (id) DO NOTHING;
