# Archi F9 — domaine custom R2 : checklist manuelle

**Ne peut pas être exécuté par cet agent** : les étapes 1-3 nécessitent le
dashboard Cloudflare (aucun accès API/credentials fournis). Les étapes 4-6
peuvent être faites par l'agent SI l'utilisateur fournit le nouveau domaine —
en attendant, ce document sert de checklist à suivre manuellement.

## Constat (AUDIT-ARCHITECTURE.md, F9)

Le domaine public actuel du bucket R2 `suimini-avatars` est
`https://pub-294a3e5b78874be9a57f9627498a4c81.r2.dev` (`mobile/.env:5`) — une
URL **« Development »** Cloudflare : non contractuelle, peut changer/être
désactivée sans préavis (Cloudflare ne garantit pas de SLA dessus), et n'est
pas un domaine à l'image du produit. À remplacer par un domaine custom avant
que le volume de photos ne rende une migration d'URLs coûteuse.

## Checklist

1. **Choisir un sous-domaine** (ex. `media.suimini.app` ou `cdn.suimini.app`)
   — doit être sur une zone DNS déjà gérée par Cloudflare (ou transférable).
2. **Dashboard Cloudflare → R2 → bucket `suimini-avatars` → Settings →
   Public access → Custom Domains → Connect Domain** : entrer le sous-domaine
   choisi. Cloudflare demande une confirmation DNS (CNAME généralement posé
   automatiquement si la zone est déjà chez Cloudflare).
3. **Attendre la propagation** (quelques minutes à quelques heures selon le
   TTL DNS) — vérifier `https://<sous-domaine>/<un-chemin-de-photo-existant>`
   répond bien (comparer avec la même image via l'ancienne URL `pub-*.r2.dev`,
   qui doit rester accessible pendant la transition).
4. **Mettre à jour les 3 variables d'environnement** (server + client web +
   mobile, doivent toutes changer ENSEMBLE) :
   - Vercel (Production + Preview) : `R2_PUBLIC_BASE_URL` **et**
     `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` → `https://<sous-domaine>`
   - `mobile/.env` (local, gitignoré) : `EXPO_PUBLIC_R2_PUBLIC_BASE_URL` →
     `https://<sous-domaine>`
   - EAS (3 environnements, valeur publique donc `--visibility plaintext`,
     même commande que documentée dans CLAUDE.md § Mobile) :
     ```bash
     eas env:create --name EXPO_PUBLIC_R2_PUBLIC_BASE_URL --value "https://<sous-domaine>" \
       --environment development --environment preview --environment production \
       --visibility plaintext --scope project --non-interactive --force
     ```
5. **Redeploy** (web : `vercel --prod` ; mobile : le nouveau build EAS lira la
   variable — pas besoin de rebuild immédiat si aucun build n'est prévu, mais
   tout build futur doit avoir la variable EAS posée AVANT).
6. **URLs déjà écrites en base** (`profile_photo`, `photos[]`, `media[]`) :
   elles pointent encore vers l'ancien `pub-*.r2.dev` — ce domaine reste
   normalement actif après l'ajout d'un domaine custom (Cloudflare ne le
   désactive pas automatiquement), donc **aucune action requise dans
   l'immédiat**. Si vous voulez tout de même uniformiser vers le nouveau
   domaine (cohérence visuelle des URLs, ou si vous comptez désactiver l'accès
   `r2.dev` plus tard) : relancer `scripts/rewrite-photo-urls-to-r2.mjs` en
   adaptant son préfixe de recherche/remplacement (actuellement pensé pour
   `Supabase Storage → R2`, pas `r2.dev → domaine custom` — à généraliser
   avant réutilisation, ne pas le lancer tel quel).

## Note sur le rollback (déjà connu, F9)

Le flag `NEXT_PUBLIC_STORAGE_BACKEND` est **build-time** et ne re-route que les
**nouveaux** uploads — les URLs déjà écrites pointent vers R2 (`r2.dev` ou le
futur domaine custom) quoi qu'il arrive. Retirer le flag ne restaure PAS
l'affichage si R2/le domaine custom tombe : ce n'est pas un rollback réel,
juste un arrêt des nouvelles écritures vers R2. Rien de nouveau ici — cette
note existait déjà dans l'audit, reprise pour mémoire.
