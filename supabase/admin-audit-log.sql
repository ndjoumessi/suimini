-- ============================================================================
-- Journal d'audit des actions de modération admin — idempotent, à coller dans
-- le SQL Editor Supabase (rôle privilégié). Miroir de la migration versionnée
-- supabase/migrations/0020_admin_audit_log.sql (voir ce fichier pour le
-- contexte détaillé). Table append-only + RPC admin-only get_admin_audit_log,
-- et les 4 fonctions de modération (approve_user/reject_user/set_user_status/
-- set_user_role) sont réécrites pour logguer une ligne après chaque action.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected','suspended','reactivated','promoted','demoted')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid()
  WHERE id = target_user_id;
  UPDATE public.admin_notifications SET is_read = true
  WHERE type = 'new_user' AND payload->>'user_id' = target_user_id::text;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id) VALUES (auth.uid(), 'approved', target_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET
    status = 'rejected',
    rejection_reason = reason
  WHERE id = target_user_id;
  UPDATE public.admin_notifications SET is_read = true
  WHERE type = 'new_user' AND payload->>'user_id' = target_user_id::text;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id) VALUES (auth.uid(), 'rejected', target_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.set_user_status(target_user_id uuid, new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET status = new_status WHERE id = target_user_id;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id)
  VALUES (auth.uid(), CASE WHEN new_status = 'suspended' THEN 'suspended' ELSE 'reactivated' END, target_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id)
  VALUES (auth.uid(), CASE WHEN new_role = 'admin' THEN 'promoted' ELSE 'demoted' END, target_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(limit_count integer DEFAULT 10)
RETURNS TABLE (
  id bigint, action text, created_at timestamptz,
  actor_display text, actor_email text,
  target_display text, target_email text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role IN ('admin','superadmin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT l.id, l.action, l.created_at,
           a.display_name, a.email,
           t.display_name, t.email
      FROM public.admin_audit_log l
      LEFT JOIN public.profiles a ON a.id = l.actor_id
      LEFT JOIN public.profiles t ON t.id = l.target_user_id
     ORDER BY l.created_at DESC
     LIMIT LEAST(GREATEST(limit_count, 1), 50);
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(integer) TO authenticated;
