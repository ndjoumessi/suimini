#!/usr/bin/env bash
# ============================================================================
# Suimini — Copie inverse Railway → Supabase (script de rollback, F3)
# ============================================================================
#
# CONTEXTE. Depuis le cutover du 2026-07-11, Railway est la SOURCE DE VÉRITÉ du
# plan données d'arbre (DB_BACKEND=railway, 100% des appelants). Le « rollback
# instantané » documenté (flip Edge Config data_layer → direct) ne fait que
# rerouter le NAVIGATEUR vers Supabase — il ne touche à AUCUNE donnée. Or
# Supabase n'a plus été écrit depuis le cutover : toute édition faite depuis
# tourne sur Railway et est INVISIBLE de Supabase. Flipper sans courir ce
# script revient donc à servir aux utilisateurs un instantané périmé au
# 2026-07-11, pas un vrai retour arrière.
#
# CE SCRIPT copie l'état COURANT de Railway vers Supabase, pour que le
# rollback (flip Edge Config) redevienne un VRAI rollback sans perte. Il ne
# touche PAS au schéma Supabase (RLS/policies/colonnes déjà en place, jamais
# modifiées) — uniquement aux LIGNES des 10 tables du plan données d'arbre,
# qu'il remplace intégralement par leur contenu Railway actuel.
#
# ⚠️ DESTRUCTIF côté Supabase pour ces 10 tables : chaque table est VIDÉE puis
# re-remplie avec le contenu Railway. Toute ligne écrite UNIQUEMENT sur Supabase
# depuis le 2026-07-11 (ex. le bug F1 avant son correctif — partages/liens
# publics écrits en direct sur Supabase pendant la fenêtre où ce chemin était
# cassé) serait PERDUE par ce script. Vérifier ce cas AVANT de lancer (requête
# de diff fournie plus bas) si le doute existe.
#
# PRÉREQUIS : ce script a besoin d'un accès Postgres DIRECT aux deux bases —
# l'agent n'a JAMAIS ces credentials (pas de service_role Supabase, pas de mot
# de passe DB Railway/Supabase dans ce repo, par conception — voir CLAUDE.md
# « Variables d'environnement »). À LANCER MANUELLEMENT PAR L'UTILISATEUR,
# jamais par l'agent.
#
# Usage :
#   RAILWAY_SOURCE_URL='postgres://...@<unpooled-host>:<port>/railway' \
#   SUPABASE_TARGET_URL='postgres://postgres:<password>@<host>:5432/postgres' \
#     ./railway/reverse-copy-to-supabase.sh
#
#   RAILWAY_SOURCE_URL = URL Postgres DIRECTE (UNPOOLED) de l'env Railway
#     concerné (jamais l'URL poolée PgBouncer — cf. docs/railway-migration.md §6).
#   SUPABASE_TARGET_URL = « Connection string » Postgres directe de Supabase
#     (Dashboard → Project Settings → Database → Connection string → mode
#     « Session », PAS le pooler PgBouncer de Supabase non plus), rôle
#     `postgres` (contourne RLS — c'est le but, on écrit les données brutes).
#
# Sans confirmation explicite (variable CONFIRM=yes), le script s'arrête après
# avoir affiché le plan et les comptes de lignes, sans rien modifier.
# ============================================================================
set -euo pipefail

: "${RAILWAY_SOURCE_URL:?Variable RAILWAY_SOURCE_URL manquante (URL Postgres DIRECTE/unpooled Railway).}"
: "${SUPABASE_TARGET_URL:?Variable SUPABASE_TARGET_URL manquante (connection string Postgres directe Supabase).}"

# Ordre FK-safe (parent → enfant) pour l'INSERT ; l'ordre inverse sert au DELETE.
TABLES=(trees persons relationships journal_entries tree_shares tree_members person_comments person_suggestions scanned_documents photo_tags)

DUMP_FILE="$(mktemp -t suimini-railway-reverse-XXXXXX).dump"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "── Suimini — copie inverse Railway → Supabase ────────────────────────────"
echo "Source (Railway, unpooled) : ${RAILWAY_SOURCE_URL%%@*}@…(masqué)"
echo "Cible  (Supabase, directe) : ${SUPABASE_TARGET_URL%%@*}@…(masqué)"
echo "Tables (10, ordre FK)      : ${TABLES[*]}"
echo

echo "── 1/4 — Comptes de lignes AVANT copie (Railway = source, Supabase = cible actuelle) ──"
printf '%-24s %12s %12s\n' "table" "railway" "supabase(avant)"
for t in "${TABLES[@]}"; do
  r_count=$(psql "$RAILWAY_SOURCE_URL" -Atqc "select count(*) from ${t};")
  s_count=$(psql "$SUPABASE_TARGET_URL" -Atqc "select count(*) from ${t};" 2>/dev/null || echo "?")
  printf '%-24s %12s %12s\n' "$t" "$r_count" "$s_count"
done
echo

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "Mode DRY-RUN (aucune écriture). Relancer avec CONFIRM=yes pour exécuter réellement :"
  echo "  RAILWAY_SOURCE_URL=... SUPABASE_TARGET_URL=... CONFIRM=yes $0"
  echo
  echo "⚠️  Avant de confirmer, vérifier qu'aucune ligne n'existe UNIQUEMENT côté Supabase"
  echo "    depuis le 2026-07-11 (ex. incident F1) — sinon elle serait perdue. Exemple de"
  echo "    vérification manuelle (à adapter par table, ex. tree_shares) :"
  echo "      psql \"\$SUPABASE_TARGET_URL\" -c \"select * from tree_shares where created_at > '2026-07-11';\""
  echo "    Comparer avec la même requête côté Railway (\$RAILWAY_SOURCE_URL) — toute ligne"
  echo "    présente à gauche et absente à droite doit être portée manuellement AVANT de lancer."
  exit 0
fi

echo "── 2/4 — Dump data-only de Railway (format custom, ordre FK géré par pg_restore) ──"
TABLE_ARGS=()
for t in "${TABLES[@]}"; do TABLE_ARGS+=(--table="$t"); done
pg_dump "$RAILWAY_SOURCE_URL" --data-only --format=custom "${TABLE_ARGS[@]}" --file="$DUMP_FILE"
echo "Dump écrit : $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo

echo "── 3/4 — Vidage des 10 tables côté Supabase (ordre INVERSE, respecte les FK) ──"
DELETE_SQL=""
for ((i=${#TABLES[@]}-1; i>=0; i--)); do
  DELETE_SQL+="delete from ${TABLES[$i]};"
done
psql "$SUPABASE_TARGET_URL" -v ON_ERROR_STOP=1 -c "begin; $DELETE_SQL commit;"
echo "Tables vidées."
echo

echo "── 4/4 — Restauration du dump Railway dans Supabase (triggers désactivés le temps du restore) ──"
pg_restore --data-only --disable-triggers --dbname="$SUPABASE_TARGET_URL" "$DUMP_FILE"
echo

echo "── Vérification finale — comptes de lignes source == destination ────────"
FAIL=0
printf '%-24s %12s %12s %8s\n' "table" "railway" "supabase(après)" "statut"
for t in "${TABLES[@]}"; do
  r_count=$(psql "$RAILWAY_SOURCE_URL" -Atqc "select count(*) from ${t};")
  s_count=$(psql "$SUPABASE_TARGET_URL" -Atqc "select count(*) from ${t};")
  if [ "$r_count" = "$s_count" ]; then status="OK"; else status="⚠️ ÉCART"; FAIL=1; fi
  printf '%-24s %12s %12s %8s\n' "$t" "$r_count" "$s_count" "$status"
done
echo

if [ "$FAIL" -ne 0 ]; then
  echo "⚠️  Au moins un écart de comptage — NE PAS considérer le rollback comme sûr avant"
  echo "    d'avoir compris pourquoi (contrainte FK ayant fait échouer un insert, etc.)."
  exit 1
fi

echo "✅ Comptes identiques sur les 10 tables. Supabase reflète maintenant l'état Railway"
echo "   courant — le flip Edge Config (data_layer → direct) peut être fait sans perte."
