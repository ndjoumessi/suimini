-- ============================================================================
-- Suimini — Schéma Supabase (PostgreSQL)
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Idempotent : peut être ré-exécuté sans erreur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Profils (1-1 avec auth.users)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Arbres généalogiques (id = identifiant applicatif côté client, donc TEXT)
create table if not exists public.trees (
  id          text primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  settings    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Personnes (champs complexes stockés en JSON)
create table if not exists public.persons (
  id            text primary key,
  tree_id       text not null references public.trees(id) on delete cascade,
  first_name    text not null default '',
  last_name     text not null default '',
  gender        text,
  birth_date    text,
  birth_place   jsonb,
  death_date    text,
  death_place   jsonb,
  is_alive      boolean not null default true,
  occupation    text,
  bio           text,
  profile_photo text,
  dna_origins   jsonb,
  citations     jsonb,
  custom_fields jsonb,
  tags          jsonb,
  privacy       text,
  -- Catch-all pour les champs Person non normalisés (maidenName, nickName,
  -- nationality, religion, education, photos, events, notes, sources, media…)
  -- afin de ne perdre AUCUNE donnée lors de la synchronisation.
  extra         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Relations
create table if not exists public.relationships (
  id          text primary key,
  tree_id     text not null references public.trees(id) on delete cascade,
  type        text not null,
  person1_id  text not null,
  person2_id  text not null,
  start_date  text,
  end_date    text,
  is_active   boolean,
  notes       text,
  extra       jsonb -- marriageEvent / divorceEvent éventuels
);

-- Entrées de journal
create table if not exists public.journal_entries (
  id                   text primary key,
  tree_id              text not null references public.trees(id) on delete cascade,
  title                text not null default '',
  date                 text,
  content              text,
  mentioned_person_ids jsonb,
  photos               jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Partages d'arbres
create table if not exists public.tree_shares (
  id               uuid primary key default gen_random_uuid(),
  tree_id          text not null references public.trees(id) on delete cascade,
  shared_with_email text not null,
  permission       text not null default 'read' check (permission in ('read','write')),
  created_at       timestamptz not null default now(),
  unique (tree_id, shared_with_email)
);

-- ----------------------------------------------------------------------------
-- Index (tree_id, owner_id)
-- ----------------------------------------------------------------------------
create index if not exists idx_trees_owner            on public.trees(owner_id);
create index if not exists idx_persons_tree           on public.persons(tree_id);
create index if not exists idx_relationships_tree     on public.relationships(tree_id);
create index if not exists idx_journal_tree           on public.journal_entries(tree_id);
create index if not exists idx_tree_shares_tree       on public.tree_shares(tree_id);
create index if not exists idx_tree_shares_email      on public.tree_shares(shared_with_email);

-- ----------------------------------------------------------------------------
-- Helpers d'accès (utilisés par les policies)
-- ----------------------------------------------------------------------------
create or replace function public.can_read_tree(t_id text)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.trees where id = t_id and owner_id = auth.uid())
      or exists (select 1 from public.tree_shares where tree_id = t_id and shared_with_email = auth.email());
$$;

create or replace function public.can_write_tree(t_id text)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.trees where id = t_id and owner_id = auth.uid())
      or exists (select 1 from public.tree_shares
                 where tree_id = t_id and shared_with_email = auth.email() and permission = 'write');
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.trees           enable row level security;
alter table public.persons         enable row level security;
alter table public.relationships   enable row level security;
alter table public.journal_entries enable row level security;
alter table public.tree_shares     enable row level security;

-- Profiles : lecture par tout utilisateur authentifié (pour afficher "Partagé par …"),
-- écriture uniquement sur son propre profil.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_modify on public.profiles;
create policy profiles_modify on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Trees : le propriétaire OU un destinataire d'un partage peut lire ; seul le propriétaire modifie.
drop policy if exists trees_select on public.trees;
create policy trees_select on public.trees for select to authenticated
  using (owner_id = auth.uid()
         or exists (select 1 from public.tree_shares s where s.tree_id = trees.id and s.shared_with_email = auth.email()));
drop policy if exists trees_insert on public.trees;
create policy trees_insert on public.trees for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists trees_update on public.trees;
create policy trees_update on public.trees for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists trees_delete on public.trees;
create policy trees_delete on public.trees for delete to authenticated using (owner_id = auth.uid());

-- Persons / Relationships / Journal : accès gouverné par l'accès à l'arbre parent.
drop policy if exists persons_select on public.persons;
create policy persons_select on public.persons for select to authenticated using (public.can_read_tree(tree_id));
drop policy if exists persons_write on public.persons;
create policy persons_write on public.persons for all to authenticated using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));

drop policy if exists relationships_select on public.relationships;
create policy relationships_select on public.relationships for select to authenticated using (public.can_read_tree(tree_id));
drop policy if exists relationships_write on public.relationships;
create policy relationships_write on public.relationships for all to authenticated using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));

drop policy if exists journal_select on public.journal_entries;
create policy journal_select on public.journal_entries for select to authenticated using (public.can_read_tree(tree_id));
drop policy if exists journal_write on public.journal_entries;
create policy journal_write on public.journal_entries for all to authenticated using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));

-- Tree shares : le propriétaire de l'arbre gère ; le destinataire voit ses partages.
drop policy if exists tree_shares_select on public.tree_shares;
create policy tree_shares_select on public.tree_shares for select to authenticated
  using (shared_with_email = auth.email()
         or exists (select 1 from public.trees t where t.id = tree_shares.tree_id and t.owner_id = auth.uid()));
drop policy if exists tree_shares_modify on public.tree_shares;
create policy tree_shares_modify on public.tree_shares for all to authenticated
  using (exists (select 1 from public.trees t where t.id = tree_shares.tree_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trees t where t.id = tree_shares.tree_id and t.owner_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Compteur public "familles préservées" pour la landing page
-- ----------------------------------------------------------------------------
create or replace function public.family_count()
returns integer language sql security definer stable set search_path = public as $$
  select count(*)::int from public.trees;
$$;
grant execute on function public.family_count() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Realtime : publier persons et relationships (et journal) pour les souscriptions
-- ----------------------------------------------------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.persons'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.relationships'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.journal_entries'; exception when others then null; end;
end $$;

-- ============================================================================
-- MULTITENANT + VALIDATION DES COMPTES PAR UN ADMINISTRATEUR
-- (idempotent : add column if not exists / create if not exists / drop policy if exists)
-- NOTE : après cette migration, les comptes existants passent en status 'pending'
-- (DEFAULT). Exécuter ensuite supabase/seed-admin.sql pour approuver le superadmin.
-- ============================================================================

-- A. Statuts & rôles de compte sur profiles ----------------------------------
alter table public.profiles add column if not exists
  status text not null default 'pending'
  check (status in ('pending','approved','rejected','suspended'));
alter table public.profiles add column if not exists
  role text not null default 'user'
  check (role in ('user','admin','superadmin'));
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists approved_by uuid references auth.users(id);
alter table public.profiles add column if not exists rejection_reason text;
alter table public.profiles add column if not exists organization text;

-- B. Tenants (organisations) -------------------------------------------------
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  owner_id    uuid references auth.users(id),
  plan        text default 'free' check (plan in ('free','family','pro')),
  max_trees   int default 1,
  max_members int default 50,
  created_at  timestamptz default now(),
  is_active   boolean default true
);
alter table public.tenants enable row level security;

-- Policies tenants : les admins gèrent ; un user voit son propre tenant.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin'))
    or exists (select 1 from public.profiles where id = auth.uid() and tenant_id = tenants.id)
  );
drop policy if exists tenants_admin_write on public.tenants;
create policy tenants_admin_write on public.tenants for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')));

-- C. Lier profiles à tenants -------------------------------------------------
alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id);

-- D. Notifications admin -----------------------------------------------------
create table if not exists public.admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  payload    jsonb,
  is_read    boolean default false,
  created_at timestamptz default now()
);
alter table public.admin_notifications enable row level security;
drop policy if exists admin_notif_select on public.admin_notifications;
create policy admin_notif_select on public.admin_notifications for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','superadmin')
  ));

-- E. Création du profil à l'inscription — étendue pour capturer l'organisation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, organization)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'organization', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- E bis. Notifier les admins à chaque nouveau profil --------------------------
create or replace function public.notify_admin_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.admin_notifications (type, payload, created_at)
  values (
    'new_user',
    jsonb_build_object(
      'user_id', new.id,
      'email', new.email,
      'display_name', new.display_name,
      'created_at', new.created_at
    ),
    now()
  );
  return new;
end; $$;

drop trigger if exists on_new_user_notify on public.profiles;
create trigger on_new_user_notify
  after insert on public.profiles
  for each row execute function public.notify_admin_new_user();

-- F. RPC SECURITY DEFINER (validation des comptes, admin-only) ----------------

-- Approuver un user
create or replace function public.approve_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  update public.profiles set
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid()
  where id = target_user_id;
  update public.admin_notifications set is_read = true
  where type = 'new_user' and payload->>'user_id' = target_user_id::text;
end; $$;

-- Rejeter un user
create or replace function public.reject_user(target_user_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  update public.profiles set
    status = 'rejected',
    rejection_reason = reason
  where id = target_user_id;
  update public.admin_notifications set is_read = true
  where type = 'new_user' and payload->>'user_id' = target_user_id::text;
end; $$;

-- Suspendre / réactiver un user
create or replace function public.set_user_status(target_user_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  update public.profiles set status = new_status where id = target_user_id;
end; $$;

-- Promouvoir / rétrograder (superadmin only)
create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin') then
    raise exception 'Unauthorized';
  end if;
  update public.profiles set role = new_role where id = target_user_id;
end; $$;

-- Lister tous les users (admin only)
create or replace function public.list_all_users()
returns table (
  id uuid, email text, display_name text,
  status text, role text, organization text,
  tenant_id uuid, created_at timestamptz,
  approved_at timestamptz, rejection_reason text
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  return query
    select p.id, p.email, p.display_name, p.status, p.role, p.organization,
           p.tenant_id, p.created_at, p.approved_at, p.rejection_reason
    from public.profiles p
    order by p.created_at desc;
end; $$;

-- Lister les notifications non lues (admin only)
create or replace function public.get_unread_notifications()
returns table (id uuid, type text, payload jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  return query
    select n.id, n.type, n.payload, n.created_at
    from public.admin_notifications n
    where n.is_read = false
    order by n.created_at desc;
end; $$;

-- Marquer toutes les notifications comme lues (admin only)
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Unauthorized';
  end if;
  update public.admin_notifications set is_read = true where is_read = false;
end; $$;

grant execute on function public.approve_user(uuid)                 to authenticated;
grant execute on function public.reject_user(uuid, text)            to authenticated;
grant execute on function public.set_user_status(uuid, text)        to authenticated;
grant execute on function public.set_user_role(uuid, text)          to authenticated;
grant execute on function public.list_all_users()                   to authenticated;
grant execute on function public.get_unread_notifications()         to authenticated;
grant execute on function public.mark_all_notifications_read()      to authenticated;
