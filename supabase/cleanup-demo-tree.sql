-- ============================================================================
-- CLEANUP — arbre démo « Famille Dupont » créé par erreur en production
-- Compte propriétaire : dromel902007@yahoo.fr (owner résolu par email, pas d'UID
-- en dur). Supprime les relations, personnes, journal et partages de cet arbre,
-- puis l'arbre lui-même.
--
-- ⚠️ La clé anon ne peut pas lire l'arbre (RLS owner-scoped) → impossible de
-- récupérer son id sans la session du propriétaire. Ce script cible donc par
-- NOM + OWNER, ce qui est plus robuste qu'un id codé en dur.
--
-- À exécuter dans le SQL Editor Supabase (rôle privilégié → RLS contournée).
-- 1) Lance d'abord le bloc PREVIEW pour vérifier ce qui sera supprimé.
-- 2) Si c'est bien le bon arbre, lance le bloc SUPPRESSION.
-- ============================================================================

-- ── 0) PREVIEW — que va-t-on supprimer ? (ne supprime rien) ─────────────────
SELECT
  t.id,
  t.name,
  t.owner_id,
  (SELECT count(*) FROM public.persons       p WHERE p.tree_id = t.id) AS nb_persons,
  (SELECT count(*) FROM public.relationships r WHERE r.tree_id = t.id) AS nb_relations
FROM public.trees t
WHERE t.name = 'Famille Dupont'
  AND t.owner_id = (SELECT id FROM auth.users WHERE lower(email) = lower('dromel902007@yahoo.fr'));

-- ── 1) SUPPRESSION (transactionnelle, idempotente) ─────────────────────────
DO $$
DECLARE
  v_owner uuid;
  v_ids   text[];
BEGIN
  SELECT id INTO v_owner
    FROM auth.users
   WHERE lower(email) = lower('dromel902007@yahoo.fr');
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Compte dromel902007@yahoo.fr introuvable dans auth.users.';
  END IF;

  -- Ids des arbres « Famille Dupont » appartenant à ce compte.
  SELECT array_agg(id) INTO v_ids
    FROM public.trees
   WHERE name = 'Famille Dupont'
     AND owner_id = v_owner;

  IF v_ids IS NULL THEN
    RAISE NOTICE 'Aucun arbre « Famille Dupont » pour ce compte — rien à supprimer.';
    RETURN;
  END IF;

  -- Enfants d'abord (FK), puis l'arbre.
  DELETE FROM public.relationships   WHERE tree_id = ANY(v_ids);
  DELETE FROM public.persons         WHERE tree_id = ANY(v_ids);
  DELETE FROM public.journal_entries WHERE tree_id = ANY(v_ids);
  DELETE FROM public.tree_shares     WHERE tree_id = ANY(v_ids);
  DELETE FROM public.trees           WHERE id = ANY(v_ids);

  RAISE NOTICE 'Supprimé % arbre(s) « Famille Dupont » : %', array_length(v_ids, 1), v_ids;
END $$;

-- ── 2) VÉRIFICATION (doit renvoyer 0 ligne) ────────────────────────────────
SELECT t.id, t.name
FROM public.trees t
WHERE t.name = 'Famille Dupont'
  AND t.owner_id = (SELECT id FROM auth.users WHERE lower(email) = lower('dromel902007@yahoo.fr'));
