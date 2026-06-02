-- ============================================================================
-- Suimini — Amorçage du premier superadmin
-- À exécuter UNE FOIS dans le SQL Editor Supabase, APRÈS schema.sql.
-- Robuste : couvre une ligne public.profiles absente (compte créé avant le
-- trigger) et une casse d'email différente.
-- ============================================================================

-- 1. Promouvoir (ou créer) le profil superadmin approuvé.
insert into public.profiles (id, email, display_name, role, status)
select u.id, u.email,
       coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1)),
       'superadmin', 'approved'
from auth.users u
where lower(u.email) = lower('romel.djoumessi@gmail.com')
on conflict (id) do update set role = 'superadmin', status = 'approved';

-- 2. Tenant d'administration (idempotent).
insert into public.tenants (name, slug, owner_id, plan)
select 'Suimini Admin', 'suimini-admin', u.id, 'pro'
from auth.users u
where lower(u.email) = lower('romel.djoumessi@gmail.com')
on conflict (slug) do nothing;

-- 3. Diagnostic : afficher le profil résultant (doit montrer superadmin / approved).
select id, email, role, status from public.profiles
where lower(email) = lower('romel.djoumessi@gmail.com');
