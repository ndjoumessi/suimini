-- ============================================================================
-- Suimini — Soft-delete (tombstones) pour l'architecture de sync UPSERT-only
-- À exécuter MANUELLEMENT dans le SQL Editor Supabase. Idempotent.
--
-- Contexte : la couche de sync (src/lib/supabaseSync.ts + mobile) n'émet plus
-- AUCUN DELETE sur les tables enfants :
--   • suppression dans l'app  = UPDATE deleted_at = now()  (tombstone)
--   • push                    = UPSERT pur avec deleted_at = null
--                               (présent localement = vivant → un undo ranime)
--   • lecture                 = filtre deleted_at côté client
--   • récupération d'urgence  = UPDATE … SET deleted_at = NULL WHERE …
--
-- Tant que cette migration n'est pas exécutée, l'app fonctionne en repli
-- automatique (upsert sans la colonne + DELETE dur) : l'ordre déploiement /
-- migration est indifférent.
-- ============================================================================

alter table public.persons         add column if not exists deleted_at timestamptz;
alter table public.relationships   add column if not exists deleted_at timestamptz;
alter table public.journal_entries add column if not exists deleted_at timestamptz;

-- Index partiels sur les lignes vivantes (les seules réellement lues).
create index if not exists idx_persons_live       on public.persons(tree_id)         where deleted_at is null;
create index if not exists idx_relationships_live on public.relationships(tree_id)   where deleted_at is null;
create index if not exists idx_journal_live       on public.journal_entries(tree_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Purge des tombstones plus vieux que `retention_days` (défaut 90 jours).
-- À lancer manuellement dans le SQL Editor : select * from public.purge_tombstones();
-- EXECUTE révoqué aux rôles applicatifs : seul un contexte privilégié purge.
-- ----------------------------------------------------------------------------
create or replace function public.purge_tombstones(retention_days int default 90)
returns table (persons_purged bigint, relationships_purged bigint, journal_purged bigint)
language plpgsql as $$
declare
  cutoff timestamptz := now() - make_interval(days => retention_days);
begin
  delete from public.persons where deleted_at is not null and deleted_at < cutoff;
  get diagnostics persons_purged = row_count;
  delete from public.relationships where deleted_at is not null and deleted_at < cutoff;
  get diagnostics relationships_purged = row_count;
  delete from public.journal_entries where deleted_at is not null and deleted_at < cutoff;
  get diagnostics journal_purged = row_count;
  return next;
end $$;

revoke execute on function public.purge_tombstones(int) from public, anon, authenticated;
