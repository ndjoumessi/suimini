-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0011_sharing_token.sql (framework de
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
