-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0016_birthday_cron.sql (framework de
-- migrations versionnées, runner `scripts/migrate.mjs`, voir CLAUDE.md
-- § « Migrations SQL »). Ce fichier est conservé pour mémoire (la migration
-- ci-dessus le cite comme source d'origine et en a repris le contenu tel
-- quel) mais n'est plus la voie d'exécution : le SQL Editor + copier-coller
-- de CE fichier n'appliquerait rien de nouveau, tout est déjà en prod.
-- Toute évolution future du schéma correspondant doit passer par une
-- NOUVELLE migration `NNNN_*.sql`, jamais par une édition ici — sinon les
-- deux fichiers divergent silencieusement (c'est précisément le risque que
-- cette recommandation visait à éliminer).
-- ============================================================================

-- ============================================================================
-- Cron quotidien — notifications push anniversaires & commémorations
-- À exécuter MANUELLEMENT dans le SQL Editor Supabase, APRÈS avoir :
--   1. déployé la fonction :
--        supabase functions deploy send-birthday-notifications --no-verify-jwt
--   2. posé le secret :
--        supabase secrets set CRON_SECRET=<chaîne aléatoire longue>
--   3. remplacé les deux placeholders ci-dessous :
--        <PROJECT_REF>  → ref du projet (ex. abcdefghijklmnop)
--        <CRON_SECRET>  → la même valeur que le secret de la fonction
-- Idempotent : unschedule avant schedule.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supprime une éventuelle planification précédente (ré-exécutable sans erreur).
do $$
begin
  perform cron.unschedule('birthday-notifications');
exception when others then null;
end $$;

-- Tous les jours à 8h00 UTC.
select cron.schedule(
  'birthday-notifications',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://bhthavcnlxflhhevdneo.supabase.co/functions/v1/send-birthday-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Vérification : select jobname, schedule, active from cron.job;
-- Historique   : select * from cron.job_run_details order by start_time desc limit 10;
