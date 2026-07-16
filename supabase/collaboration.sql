-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0012_collaboration.sql (framework de
-- migrations versionnées, runner `scripts/migrate.mjs`, voir CLAUDE.md
-- § « Migrations SQL »). Ce fichier est conservé pour mémoire (la migration
-- ci-dessus le cite comme source d'origine et en a repris le contenu tel
-- quel) mais n'est plus la voie d'exécution : le SQL Editor + copier-coller
-- de CE fichier n'appliquerait rien de nouveau, tout est déjà en prod.
-- Toute évolution future du schéma correspondant doit passer par une
-- NOUVELLE migration `NNNN_*.sql`, jamais par une édition ici — sinon les
-- deux fichiers divergent silencieusement (c'est précisément le risque que
-- cette recommandation visait à éliminer).
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
