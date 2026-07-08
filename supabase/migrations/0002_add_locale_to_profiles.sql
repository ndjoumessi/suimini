-- 0002 — Langue des notifications par utilisateur (profiles.locale).
-- Première migration « métier » versionnée. Idempotente ; pas de BEGIN/COMMIT.
--
-- Portée par la Edge Function send-birthday-notifications pour localiser chaque
-- push selon la langue du DESTINATAIRE (indépendante de la locale UI web).
-- Aucune policy RLS supplémentaire : `profiles_modify` (id = auth.uid()) laisse
-- déjà chaque user écrire SON locale ; le trigger privilégié ne bloque que
-- status/role/tenant_id. (Reprend supabase/add-locale-to-profiles.sql.)
alter table public.profiles
  add column if not exists locale text default 'fr'
    check (locale in ('fr', 'en'));

comment on column public.profiles.locale is
  'Langue préférée pour les notifications push (fr|en). Indépendante de la locale UI web. Défaut fr.';
