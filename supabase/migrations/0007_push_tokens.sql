-- 0007 — porté depuis supabase/push-tokens.sql (framework de migrations versionnées).
-- Déjà appliqué en prod → ADOPTER PAR `baseline` (pas de rejeu). Idempotent
-- (drop-if-exists / create-or-replace / if-not-exists ; toute DML est dans un
-- corps de fonction, exécutée à l'appel, pas à l'application). Pas de BEGIN/COMMIT
-- (le runner enveloppe). Source d'origine conservée sous supabase/push-tokens.sql.
-- ============================================================================

-- ============================================================================
-- PUSH TOKENS — Expo Push Tokens des appareils mobiles (Suimini Mobile)
-- Migration manuelle : à exécuter dans le SQL Editor Supabase. Idempotente.
--
-- Le client mobile (mobile/lib/notifications.ts → savePushToken) envoie son
-- Expo Push Token à POST /api/push/register, qui upsert ici. Le backend pourra
-- ensuite pousser via l'API Expo (https://exp.host/--/api/v2/push/send).
--
-- RLS : chaque utilisateur ne voit/écrit que SES propres tokens (user_id =
-- auth.uid()). La route s'exécute avec le JWT de l'appelant → RLS s'applique.
-- ============================================================================

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,                 -- ExponentPushToken[...]
  platform    text,                                  -- 'ios' | 'android'
  provider    text default 'expo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Policies (drop-then-create pour rester ré-exécutable).
drop policy if exists push_tokens_select on public.push_tokens;
drop policy if exists push_tokens_insert on public.push_tokens;
drop policy if exists push_tokens_update on public.push_tokens;
drop policy if exists push_tokens_delete on public.push_tokens;

create policy push_tokens_select on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

create policy push_tokens_insert on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());

create policy push_tokens_update on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_delete on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());
