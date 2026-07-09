-- Multi-member tree sharing. Manual migration: run in the Supabase SQL editor.
-- tree_id is TEXT to match trees.id.

CREATE TABLE IF NOT EXISTS public.tree_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id text NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor','admin')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  UNIQUE (tree_id, email)
);

CREATE INDEX IF NOT EXISTS tree_members_user_idx ON public.tree_members (user_id, status);
CREATE INDEX IF NOT EXISTS tree_members_tree_idx ON public.tree_members (tree_id);

ALTER TABLE public.tree_members ENABLE ROW LEVEL SECURITY;

-- Owner manages all members of their trees.
DROP POLICY IF EXISTS tree_members_owner ON public.tree_members;
CREATE POLICY tree_members_owner ON public.tree_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trees WHERE id = tree_members.tree_id AND owner_id = auth.uid()));

-- A member can read their own invitation row.
DROP POLICY IF EXISTS tree_members_self ON public.tree_members;
CREATE POLICY tree_members_self ON public.tree_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- A member can accept/decline their own invitation.
DROP POLICY IF EXISTS tree_members_self_update ON public.tree_members;
CREATE POLICY tree_members_self_update ON public.tree_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===== Extend tree access to accepted members (read) — RÉSILIENT =====
-- Objectif : une panne de `tree_members` ne doit JAMAIS bloquer le PROPRIÉTAIRE.
-- Deux garde-fous combinés :
--   1) Le test propriétaire est un disjoint DE PREMIER NIVEAU qui ne touche PAS
--      `tree_members` (colonne `owner_id` sur trees, ou EXISTS sur `trees` seul) →
--      il court-circuite avant toute sous-requête membre.
--   2) Le test membre passe par `is_accepted_member()`, une fonction plpgsql
--      SECURITY DEFINER dont le bloc EXCEPTION renvoie FALSE si `tree_members` est
--      indisponible (fail-closed : les membres perdent la lecture, mais la requête
--      n'ERREUR jamais → le propriétaire reste servi par le disjoint (1)).
-- Ainsi, plus besoin de DROP les policies pendant un incident tree_members.

CREATE OR REPLACE FUNCTION public.is_accepted_member(t_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tree_members
    WHERE tree_id = t_id AND user_id = auth.uid() AND status = 'accepted'
  );
EXCEPTION WHEN OTHERS THEN
  -- tree_members indisponible → refus (fail-closed), jamais d'erreur propagée.
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS trees_members_read ON public.trees;
CREATE POLICY trees_members_read ON public.trees
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()                    -- (1) court-circuit propriétaire, sans tree_members
    OR public.is_accepted_member(trees.id)   -- (2) test membre fail-closed
  );

-- Accepted members can READ the people/relationships of shared trees.
-- (Editor write policies can be layered on later per role.)
DROP POLICY IF EXISTS persons_members_read ON public.persons;
CREATE POLICY persons_members_read ON public.persons
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trees t WHERE t.id = persons.tree_id AND t.owner_id = auth.uid())
    OR public.is_accepted_member(persons.tree_id)
  );

DROP POLICY IF EXISTS relationships_members_read ON public.relationships;
CREATE POLICY relationships_members_read ON public.relationships
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trees t WHERE t.id = relationships.tree_id AND t.owner_id = auth.uid())
    OR public.is_accepted_member(relationships.tree_id)
  );
