-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0005_rate_limits.sql (framework de
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
-- Rate limiting des routes IA (/api/narrative, /api/analyze-photo, /api/search…)
-- À exécuter MANUELLEMENT dans le SQL Editor Supabase. Idempotent.
--
-- Fenêtre fixe par (user, endpoint). Tout passe par la RPC SECURITY DEFINER
-- `consume_rate_limit` — la table n'a AUCUNE policy (inaccessible en direct).
-- Tant que la migration n'est pas exécutée, les routes « fail-open » (aucune
-- casse pré-migration), voir src/lib/rateLimit.ts.
-- ============================================================================

create table if not exists public.api_rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  count        integer not null default 0,
  window_start timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.api_rate_limits enable row level security;
-- Pas de policy : seul le DEFINER (la RPC) lit/écrit.

create or replace function public.consume_rate_limit(
  p_endpoint text, p_max int, p_window_seconds int
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  rec    api_rate_limits%rowtype;
  now_ts timestamptz := now();
  retry  int;
begin
  -- Anonyme (démo) : la RPC ne peut pas clé-er — le serveur applique un repli
  -- mémoire par IP (best-effort), voir src/lib/rateLimit.ts.
  if uid is null then
    return jsonb_build_object('allowed', true, 'anonymous', true);
  end if;

  insert into api_rate_limits (user_id, endpoint, count, window_start)
  values (uid, p_endpoint, 1, now_ts)
  on conflict (user_id, endpoint) do update set
    count = case
      when api_rate_limits.window_start < now_ts - make_interval(secs => p_window_seconds)
      then 1 else api_rate_limits.count + 1 end,
    window_start = case
      when api_rate_limits.window_start < now_ts - make_interval(secs => p_window_seconds)
      then now_ts else api_rate_limits.window_start end
  returning * into rec;

  if rec.count > p_max then
    retry := ceil(extract(epoch from (rec.window_start + make_interval(secs => p_window_seconds) - now_ts)));
    return jsonb_build_object('allowed', false, 'retry_after', greatest(retry, 1));
  end if;
  return jsonb_build_object('allowed', true, 'remaining', p_max - rec.count);
end $$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon;
grant  execute on function public.consume_rate_limit(text, int, int) to authenticated;

-- Contrepartie de consume_rate_limit : redonne 1 crédit sur la fenêtre en
-- cours (jamais sous 0), appelée par le serveur quand une requête déjà
-- décomptée échoue pour une raison qui N'EST PAS imputable à l'utilisateur
-- (panne/erreur Anthropic, clé API absente, réponse illisible…) — voir
-- src/lib/rateLimit.ts:releaseRateLimit. Ne touche pas window_start : une
-- libération ne doit jamais rouvrir/prolonger la fenêtre.
create or replace function public.release_rate_limit(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  update api_rate_limits
  set count = greatest(count - 1, 0)
  where user_id = uid and endpoint = p_endpoint;
end $$;

revoke execute on function public.release_rate_limit(text) from public, anon;
grant  execute on function public.release_rate_limit(text) to authenticated;

-- Purge d'entretien (optionnelle, à lancer de temps en temps) :
--   delete from public.api_rate_limits where window_start < now() - interval '2 days';
