-- 0014 — porté depuis supabase/documents.sql (framework de migrations versionnées).
-- Déjà appliqué en prod → ADOPTER PAR `baseline` (pas de rejeu). Idempotent
-- (drop-if-exists / create-or-replace / if-not-exists ; toute DML est dans un
-- corps de fonction, exécutée à l'appel, pas à l'application). Pas de BEGIN/COMMIT
-- (le runner enveloppe). Source d'origine conservée sous supabase/documents.sql.
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
