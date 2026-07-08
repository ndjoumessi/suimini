-- 0012 — porté depuis supabase/collaboration.sql (framework de migrations versionnées).
-- Déjà appliqué en prod → ADOPTER PAR `baseline` (pas de rejeu). Idempotent
-- (drop-if-exists / create-or-replace / if-not-exists ; toute DML est dans un
-- corps de fonction, exécutée à l'appel, pas à l'application). Pas de BEGIN/COMMIT
-- (le runner enveloppe). Source d'origine conservée sous supabase/collaboration.sql.
-- ============================================================================

-- Real-time collaboration: person comments + edit suggestions.
-- Manual migration: run in the Supabase SQL editor.
-- tree_id / person_id are TEXT to match trees.id / persons.id (app uses base36 ids).

-- ===== Comments on people =====
CREATE TABLE IF NOT EXISTS public.person_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id text NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  person_id text NOT NULL,
  author_id uuid REFERENCES auth.users(id),
  author_name text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_comments_lookup_idx
  ON public.person_comments (tree_id, person_id, created_at);

ALTER TABLE public.person_comments ENABLE ROW LEVEL SECURITY;

-- Access for the tree owner (extend later for shared members).
DROP POLICY IF EXISTS comments_tree_members ON public.person_comments;
CREATE POLICY comments_tree_members ON public.person_comments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = person_comments.tree_id
      AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = person_comments.tree_id
      AND owner_id = auth.uid()
  ));

-- Realtime INSERT stream for the Discussion tab.
ALTER PUBLICATION supabase_realtime ADD TABLE public.person_comments;

-- ===== Edit suggestions =====
CREATE TABLE IF NOT EXISTS public.person_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id text NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  person_id text NOT NULL,
  author_id uuid REFERENCES auth.users(id),
  author_name text,
  field text NOT NULL,
  current_value text,
  suggested_value text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_suggestions_lookup_idx
  ON public.person_suggestions (tree_id, person_id, status);

ALTER TABLE public.person_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestions_tree_members ON public.person_suggestions;
CREATE POLICY suggestions_tree_members ON public.person_suggestions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = person_suggestions.tree_id
      AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = person_suggestions.tree_id
      AND owner_id = auth.uid()
  ));
