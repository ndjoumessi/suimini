-- 0017 — RLS résiliente : une panne de `tree_members` ne doit JAMAIS bloquer le
-- propriétaire. Réécrit les trois policies `*_members_read` (0010_sharing) pour :
--   1) court-circuiter le propriétaire par un disjoint de premier niveau qui ne
--      touche PAS `tree_members` ;
--   2) router le test membre par `is_accepted_member()` (SECURITY DEFINER +
--      EXCEPTION → false) : si `tree_members` est indisponible, les membres perdent
--      la lecture (fail-closed, sûr) mais la requête n'ERREUR jamais.
-- Contexte : l'incident du 2026-07 a 500-é `trees?select=*` / `persons?select=*`
-- (les policies membres forçaient un scan de `tree_members` dans le filtre RLS
-- combiné, même pour le propriétaire). Après cette migration, la mitigation
-- « DROP des policies membres » n'est plus nécessaire.
-- Idempotent (create-or-replace / drop-if-exists). Pas de BEGIN/COMMIT (runner).
-- ============================================================================

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
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS trees_members_read ON public.trees;
CREATE POLICY trees_members_read ON public.trees
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_accepted_member(trees.id)
  );

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
