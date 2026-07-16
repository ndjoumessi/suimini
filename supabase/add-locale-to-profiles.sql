-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0002_add_locale_to_profiles.sql (framework de
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
-- Migration MANUELLE — langue des notifications par utilisateur
--
-- À exécuter une fois dans le SQL Editor Supabase (rôle privilégié → RLS
-- contournée). Idempotente : ré-exécutable sans risque.
--
-- Ajoute `profiles.locale` ('fr' | 'en', défaut 'fr'), utilisée par l'Edge
-- Function `send-birthday-notifications` pour localiser chaque push selon la
-- langue choisie par le DESTINATAIRE (indépendante de la locale d'UI web).
--
-- Aucune policy RLS supplémentaire n'est nécessaire :
--   • la policy existante `profiles_modify` (`id = auth.uid()`) laisse déjà
--     chaque user écrire SON propre `locale` ;
--   • le trigger `guard_profile_privileged_columns` ne protège que
--     status/role/tenant_id — il ne bloque PAS `locale`.
-- ============================================================================

alter table public.profiles
  add column if not exists locale text default 'fr'
    check (locale in ('fr', 'en'));

comment on column public.profiles.locale is
  'Langue préférée pour les notifications push (fr|en). Indépendante de la locale UI web. Défaut fr.';
