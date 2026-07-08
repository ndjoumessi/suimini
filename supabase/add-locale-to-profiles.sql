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
