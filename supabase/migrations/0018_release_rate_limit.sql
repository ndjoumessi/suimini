-- 0018 — contrepartie de consume_rate_limit (0005/supabase/rate-limits.sql).
-- Idempotent (create-or-replace). Pas de BEGIN/COMMIT (le runner enveloppe).
-- Source d'origine : supabase/rate-limits.sql.
-- ============================================================================
--
-- Contexte : consume_rate_limit décompte 1 crédit AU DÉBUT de chaque route IA,
-- avant même l'appel à Anthropic — nécessaire pour protéger le coût. Mais tant
-- qu'aucune contrepartie n'existait, un incident purement serveur (ex. modèle
-- Anthropic retiré → 404 sur /v1/messages pendant plusieurs jours) rognait le
-- quota horaire réel des utilisateurs sans qu'ils y soient pour rien. Cette
-- RPC permet au serveur de redonner ce crédit sur les échecs qui NE SONT PAS
-- imputables à l'utilisateur (panne/erreur Anthropic, clé API absente,
-- réponse illisible…) — voir src/lib/rateLimit.ts:releaseRateLimit, appelée
-- depuis /api/{analyze-photo,narrative,narrative-person,search,ocr-document}.
-- Les erreurs imputables à l'utilisateur (image invalide, corps de requête
-- malformé) restent décomptées normalement.
--
-- Ne touche jamais window_start : une libération ne doit jamais rouvrir ou
-- prolonger la fenêtre horaire, seulement redonner un essai dans la fenêtre
-- en cours (jamais sous 0).
-- ============================================================================

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
