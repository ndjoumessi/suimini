-- 0001 — Table de suivi des migrations versionnées.
-- Appliquée par scripts/migrate.mjs. Ne PAS mettre de BEGIN/COMMIT (le runner
-- enveloppe). Idempotente.
--
-- RLS activée SANS policy : aucune app (anon/authenticated) ne peut la lire ni
-- l'écrire. Seul l'accès privilégié du runner (Management API / psql superuser,
-- qui contourne RLS) la manipule.
create table if not exists public.suimini_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

alter table public.suimini_migrations enable row level security;
