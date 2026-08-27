# ⏱️ RushHours

POC personnel pour s'exercer à la stack **React / NestJS / Prisma**, développé et exécuté entièrement dans un **GitHub Codespace**, avec l'assistance de Claude Code.

## 🎯 Objectif

Deux objectifs en parallèle :

1. **📚 Apprentissage** — découvrir et manipuler React (Vite), NestJS et Prisma dans un même projet, en environnement GitHub Codespaces, en s'appuyant sur un assistant IA pour la mise en place technique.
2. **🧮 Fonctionnel** — construire un petit outil de suivi du temps de travail : un salarié saisit son heure d'arrivée et son heure de départ pour chaque jour travaillé de la semaine, et le nombre d'heures travaillées dans le mois est recalculé à la volée à partir de ces saisies.

## 🧱 Stack technique

- ⚛️ **apps/web** — React 18 + Vite (JavaScript)
- 🐈 **apps/api** — NestJS + Prisma (TypeScript)
- 🐘 **PostgreSQL** — via Docker Compose

## 📁 Structure du repo

```
apps/
  web/              # frontend React (Vite)
  api/              # backend NestJS + Prisma
docker-compose.yml  # service PostgreSQL
```

## 🚀 Démarrage

Prérequis : Node.js et Docker, tous deux déjà disponibles dans ce Codespace.

```bash
npm install
npm run dev
```

- 🌐 Frontend : port `3000`
- 🔌 API : port `3001`

Au démarrage de l'API (`npm run dev`, `npm run dev:api`, ou `npm run start:dev --workspace api`), Docker Compose lance automatiquement le conteneur PostgreSQL, applique les migrations Prisma et exécute le seed de données — aucune étape manuelle n'est nécessaire.

## 📜 Scripts principaux

```bash
npm run dev             # web + api en parallèle
npm run dev:web          # frontend seul
npm run dev:api           # backend seul (démarre aussi la base de données)
npm run build              # build de tous les workspaces
npm run test                 # tests de tous les workspaces
npm run prisma:generate        # régénère le client Prisma
npm run prisma:migrate           # crée/applique une migration Prisma
```

## ⚠️ Particularité GitHub Codespaces

Le frontend et l'API tournent chacun sur un port forwardé par Codespaces (`*-3000.app.github.dev` et `*-3001.app.github.dev`). Un appel direct entre ces deux origines se heurte au proxy d'authentification de Codespaces (erreur CORS trompeuse). Pour l'éviter, le frontend appelle l'API via un chemin relatif (`/api/...`) que Vite proxifie en interne vers `http://localhost:3001` en développement — voir [CLAUDE.md](CLAUDE.md) pour le détail.

## 📌 Statut

Le socle technique est en place (monorepo, connexion frontend ↔ backend, base de données PostgreSQL avec migrations et seed automatiques). La fonctionnalité de saisie des heures et de calcul mensuel reste à implémenter.
