-- Photo face tags (AI face recognition → person associations).
-- Manual migration: run in the Supabase SQL editor.
-- The app stays fully functional offline (localStorage) when this isn't applied;
-- photo tags are also persisted inside the tree JSON via the store.

CREATE TABLE IF NOT EXISTS public.photo_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid REFERENCES public.trees(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  person_id uuid NOT NULL,
  bounding_box jsonb,
  confidence float,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_tags_tree_id_idx ON public.photo_tags (tree_id);
CREATE INDEX IF NOT EXISTS photo_tags_person_id_idx ON public.photo_tags (person_id);

ALTER TABLE public.photo_tags ENABLE ROW LEVEL SECURITY;

-- Owner-only access: a tag is reachable only if the caller owns its tree.
DROP POLICY IF EXISTS photo_tags_owner ON public.photo_tags;
CREATE POLICY photo_tags_owner ON public.photo_tags
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = photo_tags.tree_id
      AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = photo_tags.tree_id
      AND owner_id = auth.uid()
  ));
