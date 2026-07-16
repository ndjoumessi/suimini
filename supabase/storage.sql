-- ============================================================================
-- ⚠️ MIROIR HISTORIQUE — NE PLUS ÉDITER CE FICHIER DIRECTEMENT (2026-07-16, Archi F14).
-- Source de vérité pour la prod : supabase/migrations/0006_storage.sql (framework de
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
-- Suimini — Supabase Storage : bucket "avatars" (photos de profil & galerie)
-- À exécuter une fois dans Supabase Dashboard → SQL Editor.
-- Idempotent : peut être relancé sans erreur.
-- ============================================================================

-- 1) Bucket public "avatars"
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2) Policies (on supprime d'abord pour pouvoir relancer le script)
drop policy if exists "avatar_upload" on storage.objects;
drop policy if exists "avatar_update" on storage.objects;
drop policy if exists "avatar_delete" on storage.objects;
drop policy if exists "avatar_read"   on storage.objects;

-- Un utilisateur authentifié peut écrire UNIQUEMENT dans son propre dossier
-- (le path est : {auth.uid()}/{personId}-{timestamp}.jpg).
create policy "avatar_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture publique (le bucket est public ; les images s'affichent via getPublicUrl).
create policy "avatar_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
