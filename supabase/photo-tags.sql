-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0015_photo_tags.sql (framework de
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

-- Photo face tags (AI face recognition → person associations).
-- Manual migration: run in the Supabase SQL editor.
-- The app stays fully functional offline (localStorage) when this isn't applied;
-- photo tags are also persisted inside the tree JSON via the store.

-- Note: trees.id and persons.id are TEXT in schema.sql (the app generates
-- base36 string ids, not UUIDs), so tree_id / person_id must be text too.
CREATE TABLE IF NOT EXISTS public.photo_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id text NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  person_id text NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
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
