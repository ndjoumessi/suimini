-- 0008 — porté depuis supabase/push-subscriptions.sql (framework de migrations versionnées).
-- Déjà appliqué en prod → ADOPTER PAR `baseline` (pas de rejeu). Idempotent
-- (drop-if-exists / create-or-replace / if-not-exists ; toute DML est dans un
-- corps de fonction, exécutée à l'appel, pas à l'application). Pas de BEGIN/COMMIT
-- (le runner enveloppe). Source d'origine conservée sous supabase/push-subscriptions.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id)
    ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.push_subscriptions
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_sub_owner
  ON public.push_subscriptions;
CREATE POLICY push_sub_owner
  ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
