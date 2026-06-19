-- Collaboration: member-management RPCs (SECURITY DEFINER).
-- Manual migration: run in the Supabase SQL editor (after sharing.sql).
-- These let the OWNER *or an accepted ADMIN member* list / re-role / remove
-- members of a tree, regardless of row-level policies, while still rejecting
-- anyone else. tree_id is TEXT to match trees.id (base36 app ids).

-- ── Authorization helper ─────────────────────────────────────────────────
-- True when the current user owns the tree OR is an accepted 'admin' member.
CREATE OR REPLACE FUNCTION public.can_manage_members(p_tree_id text)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trees
    WHERE id = p_tree_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.tree_members
    WHERE tree_id = p_tree_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'accepted'
  );
$$;

-- ── Change a member's role ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_tree_id text,
  p_email   text,
  p_role    text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_members(p_tree_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_role NOT IN ('viewer', 'editor', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  UPDATE public.tree_members
     SET role = p_role
   WHERE tree_id = p_tree_id
     AND email = lower(p_email);
END;
$$;

-- ── Remove a member ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_member(
  p_tree_id text,
  p_email   text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_members(p_tree_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.tree_members
   WHERE tree_id = p_tree_id
     AND email = lower(p_email);
END;
$$;

-- ── List the members of a tree (manager view) ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tree_members(p_tree_id text)
  RETURNS TABLE (
    email       text,
    role        text,
    status      text,
    invited_at  timestamptz,
    accepted_at timestamptz
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_members(p_tree_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT tm.email, tm.role, tm.status, tm.invited_at, tm.accepted_at
      FROM public.tree_members tm
     WHERE tm.tree_id = p_tree_id
     ORDER BY tm.invited_at DESC;
END;
$$;

-- ── Current user's role on a tree ────────────────────────────────────────
-- Returns 'owner' | 'admin' | 'editor' | 'viewer' | NULL (no access).
-- Used by the app to gate edit/manage UI (see useFamilyStore / SuiminiApp).
CREATE OR REPLACE FUNCTION public.my_tree_role(p_tree_id text)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.trees WHERE id = p_tree_id AND owner_id = auth.uid()) THEN
    RETURN 'owner';
  END IF;
  SELECT role INTO v_role
    FROM public.tree_members
   WHERE tree_id = p_tree_id AND user_id = auth.uid() AND status = 'accepted'
   LIMIT 1;
  RETURN v_role;  -- NULL when the user has no access
END;
$$;

-- ── Accept an invitation by token (joins the tree) ───────────────────────
-- Atomic accept used by /invite/[token]: stamps user_id + accepted_at and
-- returns the joined tree's name so the UI can confirm. Rejects expired /
-- already-claimed tokens. SECURITY DEFINER so a brand-new member (not yet
-- covered by member RLS) can claim their own pending row.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
  RETURNS TABLE (tree_id text, tree_name text, role text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_row public.tree_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.tree_members WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  UPDATE public.tree_members
     SET status = 'accepted',
         user_id = auth.uid(),
         accepted_at = COALESCE(accepted_at, now())
   WHERE id = v_row.id;

  RETURN QUERY
    SELECT t.id, t.name, v_row.role
      FROM public.trees t
     WHERE t.id = v_row.tree_id;
END;
$$;

-- ── Read invitation details by token (public, for the /invite page) ──────
-- A pending invite has user_id = NULL, so member RLS can't read it by token
-- (even for the rightful invitee before they accept). This SECURITY DEFINER
-- function exposes just enough to render the invitation, to anon + authed.
CREATE OR REPLACE FUNCTION public.get_invitation(p_token text)
  RETURNS TABLE (
    tree_name    text,
    role         text,
    status       text,
    invited_email text,
    inviter_name text,
    expires_at   timestamptz
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT t.name,
           tm.role,
           tm.status,
           tm.email,
           COALESCE(p.display_name, split_part(p.email, '@', 1)),
           tm.expires_at
      FROM public.tree_members tm
      JOIN public.trees t   ON t.id = tm.tree_id
 LEFT JOIN public.profiles p ON p.id = tm.invited_by
     WHERE tm.token = p_token
     LIMIT 1;
END;
$$;

-- Member joins/role changes stream to the owner in realtime (for the toast).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tree_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Expose to authenticated clients.
GRANT EXECUTE ON FUNCTION public.update_member_role(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(text, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tree_members(text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_tree_role(text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation(text)                TO anon, authenticated;
