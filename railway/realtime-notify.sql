-- ============================================================================
-- Suimini — Relais temps réel Railway : trigger LISTEN/NOTIFY
-- ============================================================================
-- Depuis le passage à 100% `DB_BACKEND=railway`, TOUTES les écritures de données
-- d'arbre atterrissent dans Railway Postgres — les tables Supabase homonymes ne
-- bougent plus, donc le canal Realtime historique (`postgres_changes` Supabase de
-- `SuiminiApp.tsx`) ne se déclenche JAMAIS pour un vrai changement. Ce script
-- rétablit un signal temps réel NATIF Postgres : à chaque écriture de contenu
-- d'arbre, un `pg_notify('tree_changes', …)` est émis, consommé par le service
-- relais (`scripts/realtime-relay/`) qui le rediffuse aux clients via WebSocket.
--
-- IDEMPOTENT (`create or replace` / `drop trigger if exists`). Peut être rejoué.
--
-- ⚠️ À EXÉCUTER SUR L'URL **DIRECTE (UNPOOLED)** via psql — comme toute DDL
-- (cf. docs/railway-migration.md : « migrations/psql/DDL = URL UNPOOLED directe »).
-- Le trigger vit DANS la base (indépendant du chemin de connexion), mais le
-- rappel vaut pour la cohérence : ne jamais faire de DDL à travers PgBouncer.
--
-- ⚠️ Le SERVICE RELAIS, lui, DOIT écouter sur une connexion DIRECTE (unpooled) :
--   LISTEN/NOTIFY NE FONCTIONNE PAS à travers PgBouncer en mode transaction
--   (la session LISTEN n'est pas « collée » à une connexion serveur). Voir le
--   README du relais et docs/railway-realtime-plan.md.
-- ============================================================================

-- Canal unique : 'tree_changes'. Payload = JSON compact { t, tbl, op } :
--   t   = tree_id (l'arbre concerné → le relais filtre par abonnement client)
--   tbl = nom de table (persons | relationships | journal_entries | tree_members)
--   op  = INSERT | UPDATE | DELETE
-- pg_notify a une limite de 8000 octets ; ce payload est minuscule (aucune donnée
-- de fiche n'y transite — le client refait un GET /api/data/trees/[id] authentifié
-- et re-passe par l'AuthZ applicative pour obtenir le contenu réel).
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
  return null;  -- AFTER trigger : la valeur de retour est ignorée
end;
$$ language plpgsql;

-- Tables de contenu d'arbre. On couvre les MÊMES tables que le canal Supabase
-- historique (persons/relationships) + journal_entries (le journal bougeait déjà
-- via la sync) + tree_members (acceptation d'invitation → toast « membre a
-- rejoint », déjà écouté sur Supabase auparavant).
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

-- NB : un UPSERT applicatif ré-écrit plusieurs lignes → une rafale de NOTIFY par
-- arbre. Le relais COALESCE par tree_id (petit debounce) avant de rediffuser, et
-- les clients throttlent déjà le toast « un collaborateur a modifié » → un seul
-- signal utile par rafale. Aucun besoin d'un trigger statement-level (qui rendrait
-- le tree_id ambigu si un jour un statement touchait plusieurs arbres).
