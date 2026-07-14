-- 0019 — RPC SECURITY DEFINER pour lire les tokens push d'un PROPRIÉTAIRE d'arbre.
-- Idempotent (create-or-replace / grant). Pas de BEGIN/COMMIT (le runner enveloppe).
-- Source d'origine miroir : supabase/push-tokens-rpc.sql.
-- ============================================================================
--
-- Contexte : quand un membre accepte une invitation, on veut notifier le
-- PROPRIÉTAIRE de l'arbre par push (analogue à l'email best-effort déjà envoyé
-- via /api/send-approval-email). Mais la notif part d'une route Next.js exécutée
-- SOUS L'IDENTITÉ DE L'APPELANT (le nouveau membre), pas d'une Edge Function
-- service_role. Or la RLS de push_tokens est `user_id = auth.uid()` → le membre
-- ne peut PAS lire les tokens du propriétaire en direct.
--
-- ⚠️ Les tokens push sont SENSIBLES : quiconque détient un ExponentPushToken peut
-- pousser une notif sur l'appareil via l'API publique Expo. On ne peut donc PAS
-- exposer une RPC générique `get_push_tokens_for_user(uuid)` ouverte à tout
-- authentifié (moisson + spam de n'importe quel appareil). Cette RPC est donc
-- SCOPÉE au cas d'usage « notifier le propriétaire d'un arbre que je viens de
-- rejoindre » et VÉRIFIE l'autorisation : l'appelant doit être le propriétaire
-- OU un membre accepté de l'arbre visé.
--
-- Renvoie aussi la locale de notification du destinataire (profiles.locale, 0002)
-- pour un message localisé côté serveur ; défaut 'fr' si nulle.
--
-- tree_id est TEXT pour matcher trees.id (ids applicatifs base36), comme 0013.

CREATE OR REPLACE FUNCTION public.get_tree_owner_push_targets(p_tree_id text)
  RETURNS TABLE (user_id uuid, token text, locale text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.trees WHERE id = p_tree_id;
  IF v_owner IS NULL THEN
    RETURN; -- arbre introuvable → aucune cible (pas d'erreur, best-effort)
  END IF;

  -- Autorisation : appelant = propriétaire OU membre accepté de CET arbre.
  IF v_owner <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.tree_members tm
     WHERE tm.tree_id = p_tree_id
       AND tm.user_id = auth.uid()
       AND tm.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT pt.user_id, pt.token, COALESCE(pr.locale, 'fr')
      FROM public.push_tokens pt
      LEFT JOIN public.profiles pr ON pr.id = pt.user_id
     WHERE pt.user_id = v_owner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tree_owner_push_targets(text) TO authenticated;
