#!/bin/bash
# ============================================
# Suimini — Push GitHub + Deploy Vercel
# Exécuter depuis /Users/nelson/Documents/Projets/suimini
# ============================================

set -e
echo "🌿 Suimini — Déploiement automatique"
echo "======================================"

# 1. Copier le projet dans le bon dossier (déjà fait si vous avez cloné)
# cd /Users/nelson/Documents/Projets/suimini

# 2. S'assurer que git est initialisé
if [ ! -d ".git" ]; then
  git init
  git config user.email "ndjoumessi@gmail.com"
  git config user.name "Nelson Ndjoumessi"
fi

# 3. Configurer le remote GitHub
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/ndjoumessi/suimini.git
git branch -M main

# 4. Commit final si besoin
git add -A
git diff --cached --quiet || git commit -m "chore: ready for deployment"

# 5. Pousser sur GitHub
echo ""
echo "📤 Push vers GitHub..."
git push -u origin main --force
echo "✅ GitHub: https://github.com/ndjoumessi/suimini"

# 6. Installer Vercel CLI si besoin
if ! command -v vercel &> /dev/null; then
  echo ""
  echo "📦 Installation Vercel CLI..."
  npm install -g vercel
fi

# 7. Déployer sur Vercel
echo ""
echo "🚀 Déploiement Vercel..."
vercel --prod --yes \
  --name suimini \
  --build-env NODE_ENV=production

echo ""
echo "======================================"
echo "✅ Déploiement terminé !"
echo "🌐 GitHub  : https://github.com/ndjoumessi/suimini"
echo "🚀 Vercel  : https://suimini.vercel.app"
echo "======================================"
