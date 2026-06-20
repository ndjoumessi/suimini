-- ============================================================================
-- SEED RLS-SAFE — Famille TEDA (FOTIE), arbre 'teda1'
-- Contourne la RLS via une fonction SECURITY DEFINER (s'exécute avec les droits
-- du propriétaire de la fonction → bypass des policies persons/relationships).
-- Idempotent (ON CONFLICT DO NOTHING) et auto-nettoyante (DROP en fin de script).
--
-- UTILISATION :
--   1. Récupérez votre UID :   select id from auth.users where email = 'VOTRE@EMAIL';
--   2. Remplacez le placeholder dans le SELECT plus bas par cet UID.
--   3. Exécutez tout le script dans le SQL Editor.
--
-- La fonction (re)crée l'arbre 'teda1' au besoin (owner = p_owner) puis insère
-- les 48 personnes + 55 relations. Conventions identiques à seed-teda.sql :
-- relationships.type = 'parent' (person1=parent, person2=enfant) / 'spouse' ;
-- birth_place en JSONB ; bio = biographie ; rootPersonId = teda-p9 (TEDA FOTIE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_teda_family(p_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Arbre parent (créé seulement s'il n'existe pas déjà ; FK persons.tree_id).
  INSERT INTO public.trees (id, owner_id, name, description, settings)
  VALUES ('teda1', p_owner, 'Famille TEDA', 'Lignée FOTIE, 7 générations',
          '{"rootPersonId": "teda-p9"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- ── Personnes ────────────────────────────────────────────────────────────
  INSERT INTO public.persons
    (id, tree_id, first_name, last_name, gender, birth_date, death_date, birth_place, bio, is_alive)
  VALUES
    ('teda-p1',  'teda1', 'TEFOUETZAP', '',       'male',    '1850', NULL, '{"city":"Zem"}'::jsonb,    'GEN 0 — souche de la lignée (village Zem).', false),
    ('teda-p2',  'teda1', 'MAFOKO',     '',       'female',  NULL,   NULL, '{"city":"Bansoa"}'::jsonb, 'GEN 0 — épouse de TEFOUETZAP (village Bansoa).', false),
    ('teda-p3',  'teda1', 'METIOLO',    '',       'female',  NULL,   NULL, NULL, 'Fille de TEFOUETZAP et MAFOKO.', false),
    ('teda-p4',  'teda1', 'MO''O',      'SOUKA',  'male',    NULL,   NULL, NULL, 'Époux de METIOLO.', false),
    ('teda-p5',  'teda1', 'MEZEKENG',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO.', false),
    ('teda-p6',  'teda1', 'METSAGHO',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO.', false),
    ('teda-p7',  'teda1', 'MEGNIGUE',   '',       'female',  NULL,   NULL, NULL, 'Fille de METIOLO (notre lignée).', false),
    ('teda-p8',  'teda1', 'Fo''o',      'GAPGHO', 'male',    NULL,   NULL, NULL, 'Chef, époux de MEGNIGUE.', false),
    ('teda-p9',  'teda1', 'TEDA',       'FOTIE',  'male',    '1870', NULL, NULL, 'Ancêtre pivot. Prénom chrétien TEDA, nom FOTIE.', false),
    ('teda-p10', 'teda1', 'MEFOUEGONG', '',       'female',  NULL,   NULL, NULL, 'Soeur de TEDA, décédée sans enfants.', false),
    ('teda-p11', 'teda1', 'MESSE',      '',       'female',  NULL,   NULL, NULL, '1ère épouse de TEDA (J.E. DONG).', false),
    ('teda-p12', 'teda1', 'DONGHOCK',   '',       'female',  NULL,   NULL, NULL, '2ème épouse de TEDA (alias KEMDONG).', false),
    ('teda-p13', 'teda1', 'DONGMO',     'Tejioguim', 'female', NULL, NULL, NULL, '3ème épouse de TEDA.', false),
    ('teda-p14', 'teda1', 'DONGMO',     'Tela',   'female',  NULL,   NULL, NULL, '4ème épouse de TEDA.', false),
    ('teda-p15', 'teda1', 'TSAGUE',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Tsuelépo).', false),
    ('teda-p16', 'teda1', 'KADJIO',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Megnin-za, quartier Sa''a).', false),
    ('teda-p17', 'teda1', 'MEFOKO',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Letsie, quartier Letsie).', false),
    ('teda-p18', 'teda1', 'MEPOPA',     '',       'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et MESSE.', false),
    ('teda-p19', 'teda1', 'NONGNI',     '',       'female',  NULL,   NULL, NULL, 'Fille de TEDA et MESSE (alias Saïa, branche DONGHOCK).', false),
    ('teda-p20', 'teda1', 'DEMANOU',    'FOTIE',  'male',    '1913', '1988', NULL, 'Fils de TEDA et DONGHOCK.', false),
    ('teda-p21', 'teda1', 'TSANA',      'Wamba Tchoupa', 'male', '1918', '2013', NULL, 'Fils de TEDA et DONGMO Tejioguim.', false),
    ('teda-p22', 'teda1', 'GUIMATIO',   '',       'unknown', '1913', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),
    ('teda-p23', 'teda1', 'GNINZEKO',   'Gaston', 'male',    '1928', NULL, NULL, 'Fils de TEDA et DONGMO Tejioguim.', false),
    ('teda-p24', 'teda1', 'MEGNIGUE',   '',       'female',  '1933', NULL, NULL, 'Fille de TEDA et DONGMO Tejioguim.', false),
    ('teda-p25', 'teda1', 'ZEKENG',     '',       'unknown', '1923', NULL, NULL, 'Enfant de TEDA et DONGMO Tejioguim.', false),
    ('teda-p26', 'teda1', 'GHODA',      'Bfou',   'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),
    ('teda-p27', 'teda1', 'MEGHOFOUET', 'Tekang', 'unknown', NULL,   NULL, NULL, 'Enfant de TEDA et DONGMO Tela.', false),
    ('teda-p28', 'teda1', 'DANCHI',     'Martine',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p29', 'teda1', 'DEMANOU',    'Suzanne',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p30', 'teda1', 'DONGMO',     'Lucienne',  'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p31', 'teda1', 'GUEFACK',    'Berthe',    'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p32', 'teda1', 'KAGHO',      'Monique',   'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p33', 'teda1', 'MAGUE',      'Marie',     'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p34', 'teda1', 'MEGNIGHO',   'Francesca', 'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p35', 'teda1', 'MEKEUTIO',   'Julienne',  'female', NULL, NULL, NULL, 'Enfant de DEMANOU FOTIE.', true),
    ('teda-p36', 'teda1', 'TSANA',      'Sébastien', 'male',  '1948', NULL, NULL, 'Fils de TSANA Wamba Tchoupa.', true),
    ('teda-p37', 'teda1', 'DEMANOU',    'Donald',    'male',  '1994', NULL, NULL, 'Fils de TSANA Sébastien.', true),
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

  -- ── Relations (spouse / parent : person1=parent, person2=enfant) ─────────
  INSERT INTO public.relationships
    (id, tree_id, type, person1_id, person2_id, is_active)
  VALUES
    ('teda-r1',  'teda1', 'spouse', 'teda-p1',  'teda-p2',  true),
    ('teda-r2',  'teda1', 'spouse', 'teda-p4',  'teda-p3',  true),
    ('teda-r3',  'teda1', 'spouse', 'teda-p8',  'teda-p7',  true),
    ('teda-r4',  'teda1', 'spouse', 'teda-p9',  'teda-p11', true),
    ('teda-r5',  'teda1', 'spouse', 'teda-p9',  'teda-p12', true),
    ('teda-r6',  'teda1', 'spouse', 'teda-p9',  'teda-p13', true),
    ('teda-r7',  'teda1', 'spouse', 'teda-p9',  'teda-p14', true),
    ('teda-r8',  'teda1', 'parent', 'teda-p1',  'teda-p3',  true),
    ('teda-r9',  'teda1', 'parent', 'teda-p2',  'teda-p3',  true),
    ('teda-r10', 'teda1', 'parent', 'teda-p3',  'teda-p5',  true),
    ('teda-r11', 'teda1', 'parent', 'teda-p4',  'teda-p5',  true),
    ('teda-r12', 'teda1', 'parent', 'teda-p3',  'teda-p6',  true),
    ('teda-r13', 'teda1', 'parent', 'teda-p4',  'teda-p6',  true),
    ('teda-r14', 'teda1', 'parent', 'teda-p3',  'teda-p7',  true),
    ('teda-r15', 'teda1', 'parent', 'teda-p4',  'teda-p7',  true),
    ('teda-r16', 'teda1', 'parent', 'teda-p7',  'teda-p9',  true),
    ('teda-r17', 'teda1', 'parent', 'teda-p8',  'teda-p9',  true),
    ('teda-r18', 'teda1', 'parent', 'teda-p7',  'teda-p10', true),
    ('teda-r19', 'teda1', 'parent', 'teda-p8',  'teda-p10', true),
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
    ('teda-r30', 'teda1', 'parent', 'teda-p9',  'teda-p20', true),
    ('teda-r31', 'teda1', 'parent', 'teda-p12', 'teda-p20', true),
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
    ('teda-r42', 'teda1', 'parent', 'teda-p9',  'teda-p26', true),
    ('teda-r43', 'teda1', 'parent', 'teda-p14', 'teda-p26', true),
    ('teda-r44', 'teda1', 'parent', 'teda-p9',  'teda-p27', true),
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
    ('teda-r55', 'teda1', 'parent', 'teda-p36', 'teda-p37', true)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ── Exécution ───────────────────────────────────────────────────────────────
-- Remplacez le placeholder par VOTRE UID (auth.users.id) puis exécutez :
SELECT public.seed_teda_family('00000000-0000-0000-0000-000000000000'::uuid);

-- Nettoyage : la fonction temporaire est retirée après usage.
DROP FUNCTION public.seed_teda_family(uuid);

-- ============================================================================
-- ALTERNATIVE (plus directe, mais laisse la RLS désactivée si le script échoue
-- en cours de route — à n'utiliser qu'en connaissance de cause) :
--
--   ALTER TABLE public.persons       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.relationships DISABLE ROW LEVEL SECURITY;
--   -- ... (coller ici les INSERT de supabase/seed-teda.sql) ...
--   ALTER TABLE public.persons       ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
-- ============================================================================
