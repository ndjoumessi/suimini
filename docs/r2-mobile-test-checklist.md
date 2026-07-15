# Checklist — tester et flipper le storage R2 côté mobile

> Contexte : `ObjectStoreProvider` (R2) est écrit et type-checké côté mobile
> (`mobile/lib/storageProvider.ts`) mais **jamais exécuté** — aucun flag n'a
> été posé, ni en local ni sur EAS. Le web est déjà validé à 100 % en
> production (voir `docs/railway-auth-storage-migration.md`). Cette checklist
> couvre le dernier morceau (tâche #34 du tracker) et nécessite un vrai
> téléphone + un vrai compte connecté (pas le mode démo) — impossible à faire
> depuis l'agent, d'où ce guide pas-à-pas.

## 0. Pré-requis

- Un compte Suimini **réel et approuvé** (pas démo) sur le téléphone de test.
- Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`) et `cd mobile` pour toutes
  les commandes ci-dessous.
- Les valeurs R2 déjà utilisées côté web (mêmes credentials, pas besoin d'en
  recréer) :
  - `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` (racine du repo, `.env.local` ou Vercel)
    → à copier telle quelle dans `mobile/.env`.

## 1. Poser les variables en local (test rapide via `expo start`)

`mobile/.env` (gitignoré — ne touche à rien de commité) : ajouter, en plus des
`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` déjà présentes,

```
EXPO_PUBLIC_STORAGE_BACKEND=r2
EXPO_PUBLIC_R2_PUBLIC_BASE_URL=<même valeur que NEXT_PUBLIC_R2_PUBLIC_BASE_URL côté web>
```

⚠️ Piège déjà identifié dans `getStorageProvider()` (`mobile/lib/storageProvider.ts:118-124`) :
si `supabase` n'est pas configuré (client `null`) **ou** si l'app tourne en
mode démo, R2 n'est jamais atteint — le flag est silencieusement ignoré. Se
connecter avec un vrai compte avant de tester, pas juste "Continuer en démo".

Relancer le bundler pour que les nouvelles env vars soient prises en compte :

```bash
cd mobile
npx expo start -c   # -c = clear cache, sinon l'ancien bundle peut persister
```

Ouvrir dans Expo Go ou un dev build sur le téléphone, se connecter avec le
vrai compte.

## 2. Test positif — upload

1. Ouvrir une fiche personne → changer la photo de profil (galerie ou
   caméra) → ajuster → valider.
2. Résultat attendu : la photo s'affiche normalement (comme avant), sans
   erreur `photo.uploadErrorTitle` visible.
3. Vérifier dans le dashboard Cloudflare R2 (bucket utilisé par le web) qu'un
   nouvel objet est apparu sous `<userId>/<personId>-<timestamp>.webp`
   (même convention de chemin que le web, RLS-like check côté serveur :
   `sign-upload` renvoie 403 si le chemin ne commence pas par
   `${caller.userId}/`).
4. Recharger l'app (kill + reopen) → la photo doit continuer à s'afficher
   (`getPublicUrl` reconstruit l'URL depuis `EXPO_PUBLIC_R2_PUBLIC_BASE_URL`,
   donc une URL stable, pas une URL signée à durée de vie limitée).

## 3. Test négatif — AuthZ (rapide, optionnel mais recommandé)

Le web a déjà validé qu'un chemin ne commençant pas par son propre
`userId` prend un 403 sur `/api/storage/sign-upload`. Si tu veux la même
preuve côté mobile : ouvrir une session React Native debugger / logs et
vérifier qu'un essai de path falsifié échoue proprement (message d'erreur
visible dans `photo.uploadErrorBody`, pas de crash).

## 4. Test de suppression (optionnel)

Si une action de suppression de photo existe dans le flux mobile testé,
vérifier qu'elle appelle `/api/storage/delete` et renvoie bien un succès —
sinon ce n'est pas bloquant pour le flip (les photos orphelines sur R2 ne
coûtent presque rien et peuvent être nettoyées plus tard).

## 5. Rollback si quelque chose cloche

C'est un flag **build-time**, pas un flag runtime instantané comme
`data_layer` (Edge Config) :

- Retirer `EXPO_PUBLIC_STORAGE_BACKEND` de `mobile/.env` (ou le remettre à
  `supabase`) et relancer `npx expo start -c`.
- `getStorageProvider()` retombe immédiatement sur `SupabaseStorageProvider`
  — comportement identique à avant, aucune photo perdue (Supabase Storage
  n'a jamais été vidé, seulement copié vers R2 lors de la migration web).

## 6. Si le test local (§1-2) est concluant : passer sur un vrai build EAS

Poser les mêmes variables sur les 3 environnements EAS (comme déjà fait pour
les vars Supabase, voir CLAUDE.md section Mobile) :

```bash
cd mobile
eas env:create --name EXPO_PUBLIC_STORAGE_BACKEND --value "r2" \
  --environment development --environment preview --environment production \
  --visibility plaintext --scope project --non-interactive
eas env:create --name EXPO_PUBLIC_R2_PUBLIC_BASE_URL --value "<url>" \
  --environment development --environment preview --environment production \
  --visibility plaintext --scope project --non-interactive
```

Puis un build `preview` (`eas build -p android --profile preview`) et
refaire le test §2 sur l'APK installé — c'est la seule façon de valider que
le flag survit à un vrai build packagé (rappel CLAUDE.md : `mobile/.env`
n'est jamais inclus dans un build EAS, seules les env EAS comptent).

## 7. Une fois validé

Mettre à jour `docs/railway-auth-storage-migration.md` (§7, ligne "mobile
pas encore flippé") et cocher la tâche #34 du tracker — Phase A (Storage)
sera alors 100 % live des deux côtés, web et mobile.
