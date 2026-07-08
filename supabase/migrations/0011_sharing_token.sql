-- 0011 — porté depuis supabase/sharing-token.sql (framework de migrations versionnées).
-- Déjà appliqué en prod → ADOPTER PAR `baseline` (pas de rejeu). Idempotent
-- (drop-if-exists / create-or-replace / if-not-exists ; toute DML est dans un
-- corps de fonction, exécutée à l'appel, pas à l'application). Pas de BEGIN/COMMIT
-- (le runner enveloppe). Source d'origine conservée sous supabase/sharing-token.sql.
-- ============================================================================

-- Migration : ajout token + expires_at à tree_members pour les invitations par lien.
-- À exécuter manuellement dans le SQL Editor Supabase.

-- Ajouter colonnes token + expires_at à tree_members
ALTER TABLE public.tree_members
  ADD COLUMN IF NOT EXISTS token text UNIQUE;

ALTER TABLE public.tree_members
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days');

-- Permettre à un utilisateur authentifié de LIRE une invitation adressée à son email (via token)
DROP POLICY IF EXISTS tree_members_claim_read ON public.tree_members;
CREATE POLICY tree_members_claim_read ON public.tree_members
  FOR SELECT TO authenticated
  USING (token IS NOT NULL AND email = auth.email());

-- Permettre à un utilisateur authentifié de CLAIM une invitation par token si l'email correspond
DROP POLICY IF EXISTS tree_members_claim ON public.tree_members;
CREATE POLICY tree_members_claim ON public.tree_members
  FOR UPDATE TO authenticated
  USING (token IS NOT NULL AND email = auth.email())
  WITH CHECK (user_id = auth.uid() AND status = 'accepted');
