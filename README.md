# LUDO Online 🎲🎮

Un jeu de Ludo multijoueur en ligne construit avec **Astro**, **Socket.IO** et **Express**.

## Fonctionnalités

- 🎮 **Multijoueur en temps réel** — Jouez avec 2 à 4 joueurs
- 🏠 **Système de salles** — Créez ou rejoignez des salles privées
- 🎲 **Dé animé** avec effets sonores
- 🎨 **Plateau coloré** rendu en SVG haute qualité
- 💬 **Chat en jeu** entre les joueurs
- 📱 **Interface responsive** — Mobile et desktop
- 🏆 **Écran de victoire** avec option de rejouer
- ⚡ **Haute performance** — Animations CSS fluides

## Lancer en local

### Prérequis
- [Node.js](https://nodejs.org/) v18+
- npm

### Installation

```bash
# Cloner ou accéder au dossier du projet
cd "new game"

# Installer les dépendances
npm install

# Construire le frontend Astro
npm run build

# Lancer le serveur
npm run dev
```

Le jeu sera accessible sur **http://localhost:3000**

### Mode développement

Pour développer avec le hot-reload d'Astro :

```bash
# Terminal 1 : Lancer Astro en mode dev (port 4321)
npx astro dev

# Terminal 2 : Lancer le serveur Socket.IO (port 3000)
node server.js
```

## Déploiement sur Vercel

Ce projet utilise un serveur Socket.IO qui nécessite WebSockets. Pour un déploiement complet avec multijoueur :

### Option 1 : Déployer sur un serveur Node.js (Recommandé)

1. Déployez sur **Railway**, **Render**, ou **Fly.io** :

```bash
# Build
npm run build

# Le serveur sert les fichiers statiques et gère les WebSockets
npm start
```

### Option 2 : Vercel (Frontend uniquement) + Serveur séparé

1. Déployez le frontend Astro sur Vercel :
```bash
npx vercel
```

2. Déployez le serveur Socket.IO sur Railway/Render

3. Mettez à jour l'URL du serveur dans `game-client.js`

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT`   | Port du serveur | `3000` |

## Structure du projet

```
├── src/
│   ├── components/
│   │   ├── LandingPage.astro    # Page d'accueil
│   │   ├── RoomLobby.astro      # Salle d'attente
│   │   └── Board.astro          # Plateau de jeu + dé + victoire
│   ├── layouts/
│   │   └── Layout.astro         # Layout principal
│   ├── pages/
│   │   └── index.astro          # Point d'entrée
│   └── scripts/
│       ├── board-renderer.js    # Rendu SVG du plateau
│       └── game-client.js       # Client Socket.IO + logique UI
├── server.js                    # Serveur Express + Socket.IO
├── package.json
├── astro.config.mjs
└── README.md
```

## Règles du jeu

- Chaque joueur a **4 pions** de sa couleur
- Lancez un **6** pour sortir un pion de la base
- Déplacez vos pions selon le résultat du dé
- **Capturez** les pions adverses en atterrissant sur leur case
- Les cases avec ★ sont des **zones sûres**
- Un **6** donne un tour supplémentaire (max 3 consécutifs)
- Le premier joueur à amener ses 4 pions au centre **gagne** !

## Technologies

- [Astro](https://astro.build/) — Framework frontend
- [Socket.IO](https://socket.io/) — Communication temps réel
- [Express](https://expressjs.com/) — Serveur HTTP
- SVG — Rendu du plateau
- Web Audio API — Effets sonores

---

Créé par **yassou** 😇
