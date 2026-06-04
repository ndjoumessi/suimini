# Installation des templates d'email Suimini

Ces templates HTML utilisent le design « Atelier — Warm Brutalist » et sont prêts à coller dans Supabase.

## Où coller

Supabase Dashboard → **Authentication** → **Email Templates**.

Pour chaque type de template Supabase, ouvre l'onglet correspondant, colle le HTML du fichier indiqué dans le champ **Message body (HTML)**, puis renseigne le **Subject** (ligne de sujet) indiqué.

| Template Supabase | Fichier | Sujet à définir |
| --- | --- | --- |
| **Confirm signup** | `email-templates/confirmation.html` | `Confirmez votre email — Suimini` |
| **Magic Link** | `email-templates/magic-link.html` | `Votre lien de connexion — Suimini` |
| **Reset Password** | `email-templates/reset-password.html` | `Réinitialisation mot de passe — Suimini` |
| **Invite user** | `email-templates/invite.html` | `Invitation à rejoindre Suimini` |

## Variable Go-template

Les fichiers contiennent `{{ .ConfirmationURL }}` : c'est la variable Go-template fournie par Supabase qui génère le lien d'action. **Garde-la verbatim** (espaces inclus), ne la remplace pas par une URL en dur — sinon le lien de confirmation/connexion ne fonctionnera pas.

## Cas particulier : `approved.html`

`email-templates/approved.html` n'est **pas** un template d'authentification natif Supabase. C'est un email **personnalisé** à envoyer par l'application ou le flux admin (par ex. via une API d'envoi d'email ou une Edge Function Supabase) **au moment où un administrateur approuve un utilisateur**.

Il est fourni prêt à l'emploi : son CTA pointe en dur vers `https://suimini.vercel.app` (pas de variable à substituer).

## Checklist

- [ ] Confirm signup ← `confirmation.html` + sujet
- [ ] Magic Link ← `magic-link.html` + sujet
- [ ] Reset Password ← `reset-password.html` + sujet
- [ ] Invite user ← `invite.html` + sujet
- [ ] `{{ .ConfirmationURL }}` conservée verbatim dans les 4 templates
- [ ] `approved.html` branché dans le flux d'approbation admin (envoi custom)
- [ ] Test d'envoi réel pour vérifier le rendu (le `box-shadow` peut ne pas s'afficher dans certains clients — comportement attendu)
