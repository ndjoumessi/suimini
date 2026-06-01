# 🌿 Suimini — Arbre Généalogique

Application de gestion d'arbre généalogique familial, élégante et complète.

## ✨ Fonctionnalités

### 🌳 Vue Arbre Interactive
- Visualisation hiérarchique de l'arbre avec pan/zoom (molette + glisser)
- Affichage des relations parents/enfants/conjoints
- Double-clic pour définir une personne comme racine
- Indicateurs de genre avec barre colorée
- Couronne pour la personne racine

### 👥 Vue Liste
- Liste complète avec filtres avancés (sexe, statut, années, lieu)
- Tri par nom, date de naissance ou décès
- Recherche full-text (nom, profession, biographie)
- Affichage avatar et badges

### 📅 Chronologie
- Tous les événements triés chronologiquement
- Groupement par décennie
- Types : naissance, décès, mariage, diplôme, immigration, etc.
- Icônes et couleurs par type d'événement

### 📊 Statistiques
- Tableau de bord avec indicateurs clés
- Répartition hommes/femmes (graphique)
- Distribution des naissances par décennie
- Top professions, pays d'origine, noms de famille
- Personne la plus âgée / la plus jeune

### 👤 Profil Complet
- Informations personnelles (noms, dates, lieux)
- Biographie, profession, nationalité, religion, éducation
- Événements de vie personnalisés
- Notes et tags
- Liens vers les proches (parents, enfants, conjoints, frères/sœurs)
- Ajout/suppression de relations

### 📁 Import / Export
- **Export JSON** natif (toutes données préservées)
- **Export GEDCOM** (.ged) — compatible Ancestry, MyHeritage, Généatique
- **Import JSON** Suimini
- **Import GEDCOM** depuis logiciels tiers

### 🌳 Multi-arbres
- Gérez plusieurs familles distinctes
- Sélecteur d'arbre actif
- Création et suppression d'arbres

## 🚀 Démarrer

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 🛠 Stack Technique

- **Next.js 16** (App Router)
- **TypeScript** strict
- **Tailwind CSS v4**
- **localStorage** pour la persistance
- **Playfair Display** + **Lato** pour la typographie

## 📦 Déploiement

Compatible Vercel, Netlify, ou tout hébergeur Node.js.

```bash
npm run build
npm start
```

---

*Suimini — Préservez l'histoire de votre famille*

## 🚀 Déploiement rapide

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/VOTRE_USERNAME/suimini)

Voir [DEPLOY.md](./DEPLOY.md) pour les instructions détaillées.
