-- ============================================================================
-- Suimini — Partage public d'arbre (lecture seule) + Realtime admin
-- À exécuter manuellement dans le SQL editor Supabase. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- E) Partage public : colonnes is_public / public_slug sur trees
-- ----------------------------------------------------------------------------
alter table public.trees add column if not exists is_public  boolean default false;
alter table public.trees add column if not exists public_slug text unique;

create index if not exists idx_trees_public_slug on public.trees(public_slug) where public_slug is not null;

-- RLS : lecture publique (anon + authenticated) quand l'arbre est marqué public.
-- Ces policies s'AJOUTENT (OR) aux policies "authenticated" existantes.
drop policy if exists trees_public_read on public.trees;
create policy trees_public_read on public.trees
  for select using (is_public = true);

-- Persons : exposés uniquement si l'arbre est public ET la personne n'est pas
-- marquée « privé » (les fiches privées ne fuitent jamais via le lien public).
drop policy if exists persons_public_read on public.persons;
create policy persons_public_read on public.persons
  for select using (
    coalesce(persons.privacy, 'public') <> 'private'
    and exists (select 1 from public.trees t where t.id = persons.tree_id and t.is_public = true)
  );

-- Relationships : exposées seulement si l'arbre est public ET aucune des deux
-- personnes liées n'est privée (sinon on déduirait l'existence d'une fiche privée).
drop policy if exists relationships_public_read on public.relationships;
create policy relationships_public_read on public.relationships
  for select using (
    exists (select 1 from public.trees t where t.id = relationships.tree_id and t.is_public = true)
    and not exists (
      select 1 from public.persons p
      where (p.id = relationships.person1_id or p.id = relationships.person2_id)
        and coalesce(p.privacy, 'public') = 'private'
    )
  );

-- Journal : volontairement NON exposé publiquement (contenu narratif sensible).
-- L'UI publique ne lit pas le journal ; on retire toute policy de lecture publique.
drop policy if exists journal_public_read on public.journal_entries;

-- ----------------------------------------------------------------------------
-- A) Realtime : exposer les tables admin au flux supabase_realtime
--    (nécessaire pour les notifications temps réel du tableau de bord admin)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.admin_notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end $$;
