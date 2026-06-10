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
