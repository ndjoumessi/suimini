# 🚀 Déploiement Suimini

## 1. Pousser sur GitHub

```bash
# Option A — GitHub CLI
gh repo create suimini --public --source=. --push

# Option B — Manuel
git remote add origin https://github.com/VOTRE_USERNAME/suimini.git
git branch -M main
git push -u origin main
```

## 2. Déployer sur Vercel

### Via CLI :
```bash
npm i -g vercel
vercel --prod
```

### Via l'interface web :
1. Aller sur https://vercel.com/new
2. Importer le repo GitHub `suimini`
3. Framework : **Next.js** (auto-détecté)
4. Cliquer **Deploy** — c'est tout !

## Variables d'environnement
Aucune requise. L'app tourne entièrement côté client avec localStorage.

## Build settings (Vercel, auto-détecté)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
