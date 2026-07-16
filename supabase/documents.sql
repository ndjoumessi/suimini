-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0014_documents.sql (framework de
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

-- Scanned civil-record documents (OCR). Manual migration: run in the Supabase SQL editor.
-- tree_id / person_id are TEXT to match trees.id / persons.id.
-- Documents are uploaded to the Storage bucket 'documents' (create it as private);
-- offline/guest mode keeps documents as data URLs in the tree JSON instead.

CREATE TABLE IF NOT EXISTS public.scanned_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id text REFERENCES public.trees(id) ON DELETE CASCADE,
  person_id text,
  document_url text NOT NULL,
  document_type text,
  extracted_data jsonb,
  confidence float,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanned_documents_lookup_idx
  ON public.scanned_documents (tree_id, person_id, created_at);

ALTER TABLE public.scanned_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scanned_documents_owner ON public.scanned_documents;
CREATE POLICY scanned_documents_owner ON public.scanned_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = scanned_documents.tree_id AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = scanned_documents.tree_id AND owner_id = auth.uid()
  ));
