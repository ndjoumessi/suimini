-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0019_push_tokens_rpc.sql (framework de
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

-- ============================================================================
-- PUSH TOKENS — RPC de lecture des tokens d'un PROPRIÉTAIRE d'arbre (SECURITY DEFINER)
-- Migration manuelle : à exécuter dans le SQL Editor Supabase. Idempotente.
-- Miroir de supabase/migrations/0019_push_tokens_rpc.sql (framework versionné).
--
-- Permet à une route Next.js exécutée sous l'identité d'un MEMBRE (RLS push_tokens
-- = user_id = auth.uid()) de lire les tokens push du PROPRIÉTAIRE de l'arbre pour
-- le notifier (ex. « un membre a rejoint votre arbre »). Analogue à la RPC
-- get_public_profiles() utilisée par /api/send-approval-email.
--
-- ⚠️ Les tokens push sont sensibles (l'API Expo est publique) → la RPC est SCOPÉE
-- au cas d'usage et vérifie que l'appelant est propriétaire OU membre accepté de
-- l'arbre visé (jamais une lecture ouverte des tokens de n'importe qui).
-- ============================================================================

create or replace function public.get_tree_owner_push_targets(p_tree_id text)
  returns table (user_id uuid, token text, locale text)
  language plpgsql
  security definer
  stable
  set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id into v_owner from public.trees where id = p_tree_id;
  if v_owner is null then
    return;
  end if;

  if v_owner <> auth.uid() and not exists (
    select 1 from public.tree_members tm
     where tm.tree_id = p_tree_id
       and tm.user_id = auth.uid()
       and tm.status = 'accepted'
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
    select pt.user_id, pt.token, coalesce(pr.locale, 'fr')
      from public.push_tokens pt
      left join public.profiles pr on pr.id = pt.user_id
     where pt.user_id = v_owner;
end;
$$;

grant execute on function public.get_tree_owner_push_targets(text) to authenticated;
