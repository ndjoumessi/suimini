#!/usr/bin/env bash
# ============================================================================
# Copie des avatars existants : Supabase Storage (bucket "avatars") → Cloudflare
# R2 (bucket "suimini-avatars"), via rclone (les deux exposent une API S3).
#
# ⚠️ SCRIPT MANUEL, À LANCER PAR LE USER — pas par l'agent (voir CLAUDE.md
# "Écriture prod bloquée depuis l'agent" : ni service_role Supabase, ni
# credentials R2/Supabase S3 dans le sandbox de l'agent). Ce script ne fait
# QUE COPIER (jamais de DELETE côté Supabase) — Supabase Storage reste intact
# et lisible tant que la Phase A (docs/railway-auth-storage-migration.md §4)
# n'est pas soakée. Voir §4.4 étape 5 de ce doc.
#
# Prérequis :
#   1. rclone installé (brew install rclone / apt install rclone / …).
#   2. Activer le protocole S3 sur Supabase Storage : Dashboard du projet →
#      Project Settings → Storage → S3 Connection → "Enable S3 Storage" →
#      générer une paire access key / secret key (⚠️ le secret n'est affiché
#      qu'UNE FOIS à la création — le noter immédiatement).
#      Voir https://supabase.com/docs/guides/storage/s3/authentication
#   3. La clé S3 R2 déjà créée pour l'app (celle utilisée par R2_ACCESS_KEY_ID /
#      R2_SECRET_ACCESS_KEY côté Vercel) fonctionne aussi ici — pas besoin d'en
#      créer une nouvelle, tant qu'elle a les droits Object Read & Write sur
#      "suimini-avatars".
#
# Usage :
#   1. Renseigne les variables ci-dessous (ou exporte-les avant d'appeler ce
#      script — jamais de valeur en dur committée dans le repo).
#   2. Lance d'abord en DRY-RUN (par défaut, voir DRY_RUN plus bas) pour voir
#      ce qui SERAIT copié sans rien écrire.
#   3. Repasse DRY_RUN=0 pour la copie réelle.
#   4. Le script termine par une réconciliation de comptage (façon 71/122 de
#      la migration data) — les deux comptes doivent être égaux.
# ============================================================================
set -euo pipefail

# --- À renseigner (ou exporter avant d'appeler le script) -------------------
: "${SUPABASE_PROJECT_REF:?Renseigne SUPABASE_PROJECT_REF (ex: abcdefghijklmnop, visible dans le dashboard, onglet Project Settings ou dans l URL)}"
: "${SUPABASE_S3_ACCESS_KEY_ID:?Renseigne SUPABASE_S3_ACCESS_KEY_ID (Project Settings → Storage → S3 Connection)}"
: "${SUPABASE_S3_SECRET_ACCESS_KEY:?Renseigne SUPABASE_S3_SECRET_ACCESS_KEY (idem, affiché une seule fois)}"
: "${SUPABASE_S3_REGION:=us-east-1}"  # cf. doc S3 Connection du projet — souvent indépendant de la région réelle du projet

: "${R2_ACCOUNT_ID:?Renseigne R2_ACCOUNT_ID (même valeur que Vercel)}"
: "${R2_ACCESS_KEY_ID:?Renseigne R2_ACCESS_KEY_ID (même valeur que Vercel)}"
: "${R2_SECRET_ACCESS_KEY:?Renseigne R2_SECRET_ACCESS_KEY (même valeur que Vercel)}"

SUPABASE_BUCKET="avatars"
R2_BUCKET="suimini-avatars"
DRY_RUN="${DRY_RUN:-1}"  # 1 = dry-run (défaut, sûr) ; passer DRY_RUN=0 pour copier pour de vrai

SUPABASE_S3_ENDPOINT="https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/s3"
R2_S3_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "== rclone via variables d'environnement (pas de fichier de config partagé) =="
echo "Supabase endpoint : ${SUPABASE_S3_ENDPOINT}"
echo "R2 endpoint       : ${R2_S3_ENDPOINT}"
echo "Dry-run           : ${DRY_RUN} (1 = simulation, 0 = copie réelle)"
echo

RCLONE_COMMON_FLAGS=(
  --s3-list-version 2   # Supabase Storage : la v1 tronque parfois les listings paginés (bug connu rclone/Supabase)
  --progress
)

if [ "${DRY_RUN}" = "1" ]; then
  RCLONE_COMMON_FLAGS+=(--dry-run)
fi

# Remotes déclarés inline via variables d'env RCLONE_CONFIG_<NAME>_<KEY>
# (évite d'écrire des secrets dans ~/.config/rclone/rclone.conf).
export RCLONE_CONFIG_SBSTORAGE_TYPE=s3
export RCLONE_CONFIG_SBSTORAGE_PROVIDER=Other
export RCLONE_CONFIG_SBSTORAGE_ENDPOINT="${SUPABASE_S3_ENDPOINT}"
export RCLONE_CONFIG_SBSTORAGE_ACCESS_KEY_ID="${SUPABASE_S3_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SBSTORAGE_SECRET_ACCESS_KEY="${SUPABASE_S3_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SBSTORAGE_REGION="${SUPABASE_S3_REGION}"

export RCLONE_CONFIG_R2STORAGE_TYPE=s3
export RCLONE_CONFIG_R2STORAGE_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2STORAGE_ENDPOINT="${R2_S3_ENDPOINT}"
export RCLONE_CONFIG_R2STORAGE_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export RCLONE_CONFIG_R2STORAGE_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_R2STORAGE_REGION=auto

echo "--- Comptage AVANT copie -----------------------------------------------"
# ⚠️ stderr n'est PLUS masqué ici (contrairement à une version précédente) :
# une erreur rclone (creds, région, bucket introuvable…) doit s'afficher en
# clair au lieu de disparaître silencieusement avec un comptage à 0.
set +e
SRC_COUNT_BEFORE=$(rclone lsf --s3-list-version 2 "sbstorage:${SUPABASE_BUCKET}" -R --files-only | wc -l | tr -d ' ')
SRC_RC=$?
DST_COUNT_BEFORE=$(rclone lsf "r2storage:${R2_BUCKET}" -R --files-only | wc -l | tr -d ' ')
DST_RC=$?
set -e
if [ "${SRC_RC}" -ne 0 ] || [ "${DST_RC}" -ne 0 ]; then
  echo "❌ Échec du listing rclone (voir le message rclone ci-dessus) — arrêt avant toute copie."
  exit 1
fi
echo "Supabase (${SUPABASE_BUCKET})      : ${SRC_COUNT_BEFORE} objets"
echo "R2 (${R2_BUCKET})            : ${DST_COUNT_BEFORE} objets"
echo

echo "--- Copie (rclone copy — n'efface RIEN côté source ni côté destination) ---"
# `copy` (pas `sync`) : n'efface jamais un objet déjà présent côté R2 qui
# n'existerait plus côté Supabase. On ne veut qu'AJOUTER, jamais retirer.
rclone copy "sbstorage:${SUPABASE_BUCKET}" "r2storage:${R2_BUCKET}" "${RCLONE_COMMON_FLAGS[@]}"

echo
echo "--- Comptage APRÈS copie ------------------------------------------------"
if [ "${DRY_RUN}" = "1" ]; then
  echo "(dry-run : rien n'a été écrit, comptage inchangé côté R2)"
else
  SRC_COUNT_AFTER=$(rclone lsf --s3-list-version 2 "sbstorage:${SUPABASE_BUCKET}" -R --files-only | wc -l | tr -d ' ')
  DST_COUNT_AFTER=$(rclone lsf "r2storage:${R2_BUCKET}" -R --files-only | wc -l | tr -d ' ')
  echo "Supabase (${SUPABASE_BUCKET})      : ${SRC_COUNT_AFTER} objets"
  echo "R2 (${R2_BUCKET})            : ${DST_COUNT_AFTER} objets"
  if [ "${SRC_COUNT_AFTER}" = "${DST_COUNT_AFTER}" ]; then
    echo "✅ Comptes égaux — réconciliation OK."
  else
    echo "⚠️  Comptes DIFFÉRENTS — à investiguer avant de flipper NEXT_PUBLIC_STORAGE_BACKEND=r2."
  fi
fi
