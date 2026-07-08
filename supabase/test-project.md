# Projet Supabase de TEST (tests d'intégration réel-cloud)

Procédure pour créer un projet Supabase **dédié aux tests** et exécuter
`e2e/integration/supabase-sync.spec.ts` contre une vraie base — en local et en CI.

> ⚠️ **Ne jamais** utiliser le projet de **production**. Les tests créent/suppriment
> des utilisateurs auth jetables et des arbres de test. Un projet séparé isole
> totalement ces données et protège la prod.

Sans les variables d'env `SUPABASE_TEST_*`, le fichier de spec s'**auto-skippe**
(`describe.skip`) : la suite e2e normale reste 100 % verte sans configuration.

---

## 1. Créer le projet de test (plan gratuit)

1. Aller sur <https://supabase.com/dashboard> → **New project**.
2. Nom : par ex. `suimini-test`. Choisir une région, un mot de passe DB fort.
3. Attendre la fin du provisioning (~2 min).

## 2. Récupérer les clés (URL / anon / service_role)

Dashboard du projet de test → **Project Settings → API** :

| Variable d'env                 | Où la trouver                                  |
| ------------------------------ | ---------------------------------------------- |
| `SUPABASE_TEST_URL`            | *Project URL*                                  |
| `SUPABASE_TEST_ANON_KEY`       | *Project API keys → `anon` `public`*           |
| `SUPABASE_TEST_SERVICE_KEY`    | *Project API keys → `service_role` `secret`*   |

> 🔐 La clé **`service_role` bypasse RLS**. Elle sert **uniquement** au
> setup/teardown des tests (créer un user auth jetable, insérer/supprimer l'arbre
> de test). Ne jamais l'exposer côté client ni la committer.

## 3. Appliquer le schéma (PRÉ-REQUIS, à faire UNE FOIS)

Le schéma doit être **pré-appliqué** au projet de test : la CI ne l'applique pas.

Dans le Dashboard du projet de test → **SQL Editor**, exécuter **dans cet ordre** :

1. Copier-coller tout `supabase/schema.sql` → **Run**.
2. Copier-coller tout `supabase/soft-delete.sql` → **Run**.

Les deux scripts sont idempotents (ré-exécutables sans erreur). `soft-delete.sql`
ajoute les colonnes `deleted_at` (tombstones) indispensables aux tests 3, 4 et à
l'architecture UPSERT-only. `schema.sql` publie déjà `persons`/`relationships`/
`journal_entries` dans `supabase_realtime` (nécessaire au test 6 Realtime).

> Si un test échoue en `PGRST204 … deleted_at` ou ne reçoit aucun événement
> Realtime : le schéma n'est pas (entièrement) appliqué — relancer l'étape 3.

## 4. Lancer les tests en local

```bash
source ~/.nvm/nvm.sh && nvm use 22
cp .env.test.example .env.test   # puis remplir les 3 valeurs

# Charger .env.test dans l'environnement du shell, puis lancer la spec d'intégration.
# (E2E_BASE_URL évite que Playwright build + démarre le serveur Next : ces tests
#  parlent directement à Supabase, ils n'ont pas besoin de l'app locale.)
set -a && source .env.test && set +a
E2E_BASE_URL=http://localhost:3001 npx playwright test e2e/integration
```

- Sans `.env.test` (variables absentes) : les tests s'auto-skippent (0 échec).
- `E2E_BASE_URL` désactive le `webServer` managé de `playwright.config.ts`.

## 5. Configurer les secrets GitHub (pour la CI)

Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
Créer les **3** secrets (mêmes noms que les variables d'env) :

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_KEY`

Le workflow `.github/workflows/integration-tests.yml` les mappe en variables d'env
via `env:` (jamais interpolées dans un `run:`). Sans ces secrets, les tests
s'auto-skippent également en CI (la CI reste verte).

---

## Récapitulatif des étapes manuelles

1. Créer le projet Supabase de test (plan gratuit).
2. Copier les 3 clés (URL, anon, service_role) depuis Project Settings → API.
3. **Pré-appliquer** `schema.sql` puis `soft-delete.sql` dans le SQL Editor du projet de test.
4. Poser les 3 secrets GitHub (`SUPABASE_TEST_URL/ANON_KEY/SERVICE_KEY`).
5. En local : `.env.test` + `E2E_BASE_URL=… npx playwright test e2e/integration`.
