-- ============================================================================
-- Suimini — Schéma DATA pour Railway PostgreSQL (staging → prod)
-- ============================================================================
-- Cible : Postgres 18 « nu » (pas de Supabase Auth, pas de RLS, pas de realtime).
--
-- PÉRIMÈTRE : uniquement le PLAN DONNÉES D'ARBRE. L'IDENTITÉ (profiles, tenants,
-- admin_notifications, api_rate_limits, push_tokens/subscriptions) et l'AUTH
-- (GoTrue) RESTENT sur Supabase — on ne les migre pas. Les colonnes qui, sous
-- Supabase, référençaient `auth.users(id)` deviennent donc de simples `uuid`
-- SANS clé étrangère (l'utilisateur vit dans une autre base) :
--   trees.owner_id, tree_members.user_id, tree_members.invited_by,
--   person_comments.author_id, person_suggestions.author_id.
--
-- SÉCURITÉ : il n'y a PAS de RLS ici. La connexion applicative est un rôle
-- privilégié unique ; l'AUTORISATION est portée à 100 % par la couche applicative
-- (`src/lib/authz.ts` + `RailwayStore`), miroir exact des anciennes policies.
--
-- Idempotent : `create table if not exists` / `add column if not exists`.
-- Types/défauts/CHECK repris VERBATIM du schéma Supabase (voir l'inventaire
-- des migrations 0003-0017). Les ID d'arbre/personne/relation/journal sont TEXT
-- (générés côté client), PAS des uuid — ne pas « corriger ».
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Arbres
-- ---------------------------------------------------------------------------
create table if not exists trees (
  id          text primary key,
  owner_id    uuid not null,                 -- (ex-FK auth.users ; identité sur Supabase)
  name        text not null,
  description text,
  settings    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_public   boolean default false,         -- 0009_share_public
  public_slug text unique                     -- 0009_share_public
);

-- ---------------------------------------------------------------------------
-- Personnes
-- ---------------------------------------------------------------------------
create table if not exists persons (
  id            text primary key,
  tree_id       text not null references trees(id) on delete cascade,
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
  privacy       text,                         -- 'public' | 'private' (convention, pas de CHECK)
  extra         jsonb,                        -- catch-all champs Person non normalisés
  deleted_at    timestamptz,                  -- tombstone (soft-delete, UPSERT-only)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Relations (pas de created_at/updated_at, comme le schéma d'origine)
-- ---------------------------------------------------------------------------
create table if not exists relationships (
  id          text primary key,
  tree_id     text not null references trees(id) on delete cascade,
  type        text not null,
  person1_id  text not null,                  -- pas de FK (texte simple, comme l'origine)
  person2_id  text not null,
  start_date  text,
  end_date    text,
  is_active   boolean,
  notes       text,
  extra       jsonb,                          -- marriageEvent / divorceEvent éventuels
  deleted_at  timestamptz                     -- tombstone
);

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------
create table if not exists journal_entries (
  id                   text primary key,
  tree_id              text not null references trees(id) on delete cascade,
  title                text not null default '',
  date                 text,
  content              text,
  mentioned_person_ids jsonb,
  photos               jsonb,
  deleted_at           timestamptz,           -- tombstone
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Partage par email (legacy) + membres (multi-membres)
-- ---------------------------------------------------------------------------
create table if not exists tree_shares (
  id                uuid primary key default gen_random_uuid(),
  tree_id           text not null references trees(id) on delete cascade,
  shared_with_email text not null,
  permission        text not null default 'read' check (permission in ('read','write')),
  created_at        timestamptz not null default now(),
  unique (tree_id, shared_with_email)
);

create table if not exists tree_members (
  id          uuid primary key default gen_random_uuid(),
  tree_id     text not null references trees(id) on delete cascade,
  user_id     uuid,                           -- NULL jusqu'à l'acceptation (ex-FK auth.users)
  email       text not null,
  role        text not null default 'viewer' check (role in ('viewer','editor','admin')),
  invited_by  uuid,                           -- (ex-FK auth.users)
  invited_at  timestamptz default now(),
  accepted_at timestamptz,
  status      text default 'pending' check (status in ('pending','accepted','declined')),
  token       text unique,                    -- 0011_sharing_token
  expires_at  timestamptz default (now() + interval '7 days'),  -- 0011_sharing_token
  unique (tree_id, email)
);

-- ---------------------------------------------------------------------------
-- Collaboration : commentaires + suggestions d'édition
-- ---------------------------------------------------------------------------
create table if not exists person_comments (
  id          uuid primary key default gen_random_uuid(),
  tree_id     text not null references trees(id) on delete cascade,
  person_id   text not null,
  author_id   uuid,                           -- (ex-FK auth.users)
  author_name text,
  content     text not null,
  created_at  timestamptz default now()
);

create table if not exists person_suggestions (
  id              uuid primary key default gen_random_uuid(),
  tree_id         text not null references trees(id) on delete cascade,
  person_id       text not null,
  author_id       uuid,                       -- (ex-FK auth.users)
  author_name     text,
  field           text not null,
  current_value   text,
  suggested_value text not null,
  status          text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Documents scannés (OCR) + tags photo
-- ---------------------------------------------------------------------------
create table if not exists scanned_documents (
  id             uuid primary key default gen_random_uuid(),
  tree_id        text references trees(id) on delete cascade,
  person_id      text,
  document_url   text not null,
  document_type  text,
  extracted_data jsonb,
  confidence     double precision,
  created_at     timestamptz default now()
);

create table if not exists photo_tags (
  id           uuid primary key default gen_random_uuid(),
  tree_id      text not null references trees(id) on delete cascade,
  photo_url    text not null,
  person_id    text not null references persons(id) on delete cascade,
  bounding_box jsonb,
  confidence   double precision,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Index (repris des migrations Supabase, y compris les index partiels « live »)
-- ---------------------------------------------------------------------------
create index if not exists idx_trees_owner            on trees(owner_id);
create index if not exists idx_trees_public_slug      on trees(public_slug) where public_slug is not null;
create index if not exists idx_persons_tree           on persons(tree_id);
create index if not exists idx_relationships_tree     on relationships(tree_id);
create index if not exists idx_journal_tree           on journal_entries(tree_id);
create index if not exists idx_tree_shares_tree       on tree_shares(tree_id);
create index if not exists idx_tree_shares_email      on tree_shares(shared_with_email);
create index if not exists idx_persons_live       on persons(tree_id)         where deleted_at is null;
create index if not exists idx_relationships_live on relationships(tree_id)   where deleted_at is null;
create index if not exists idx_journal_live       on journal_entries(tree_id) where deleted_at is null;
create index if not exists tree_members_user_idx  on tree_members(user_id, status);
create index if not exists tree_members_tree_idx  on tree_members(tree_id);
create index if not exists person_comments_lookup_idx    on person_comments(tree_id, person_id, created_at);
create index if not exists person_suggestions_lookup_idx on person_suggestions(tree_id, person_id, status);
create index if not exists scanned_documents_lookup_idx  on scanned_documents(tree_id, person_id, created_at);
create index if not exists photo_tags_tree_id_idx        on photo_tags(tree_id);
create index if not exists photo_tags_person_id_idx      on photo_tags(person_id);

-- ---------------------------------------------------------------------------
-- Temps réel : trigger LISTEN/NOTIFY (canal 'tree_changes')
-- ---------------------------------------------------------------------------
-- Réplique de railway/realtime-notify.sql (gardé aussi en script autonome pour
-- un rejeu ciblé). Émet un pg_notify compact à chaque écriture de contenu
-- d'arbre ; consommé par le service relais (scripts/realtime-relay/) qui le
-- rediffuse aux clients via WebSocket. Voir docs/railway-realtime-plan.md.
-- ⚠️ Le relais DOIT écouter sur une connexion DIRECTE (unpooled) — LISTEN/NOTIFY
-- ne passe pas PgBouncer transaction-mode.
create or replace function notify_tree_change() returns trigger as $$
declare
  v_tree_id text;
begin
  if (tg_op = 'DELETE') then
    v_tree_id := old.tree_id;
  else
    v_tree_id := new.tree_id;
  end if;
  if v_tree_id is not null then
    perform pg_notify(
      'tree_changes',
      json_build_object('t', v_tree_id, 'tbl', tg_table_name, 'op', tg_op)::text
    );
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_change on persons;
create trigger trg_notify_change
  after insert or update or delete on persons
  for each row execute function notify_tree_change();

drop trigger if exists trg_notify_change on relationships;
create trigger trg_notify_change
  after insert or update or delete on relationships
  for each row execute function notify_tree_change();

drop trigger if exists trg_notify_change on journal_entries;
create trigger trg_notify_change
  after insert or update or delete on journal_entries
  for each row execute function notify_tree_change();

drop trigger if exists trg_notify_change on tree_members;
create trigger trg_notify_change
  after insert or update or delete on tree_members
  for each row execute function notify_tree_change();
