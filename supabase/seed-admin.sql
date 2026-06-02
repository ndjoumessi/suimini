-- ============================================================================
-- Suimini — Amorçage du premier superadmin
-- À exécuter UNE FOIS dans le SQL Editor Supabase, APRÈS schema.sql.
-- ============================================================================

-- 1. Promouvoir le compte en superadmin et l'approuver.
update public.profiles
set role = 'superadmin', status = 'approved'
where email = 'romel.djoumessi@gmail.com';

-- 2. Créer le tenant d'administration (idempotent).
insert into public.tenants (name, slug, owner_id, plan)
select 'Suimini Admin', 'suimini-admin', id, 'pro'
from auth.users
where email = 'romel.djoumessi@gmail.com'
on conflict (slug) do nothing;
