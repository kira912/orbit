# Orbit

App mobile de partage de position, pensée pour aller plus loin que le partage
live de WhatsApp/Google Maps : cercles de partage, géofencing (alertes
arrivée/départ), historique/replay de trajet, et sessions de partage
temporaires avec ETA et arrêt automatique à l'arrivée.

## Stack

- **Monorepo pnpm workspaces** (`apps/*`, `packages/*`), pas de Turborepo/Nx —
  overkill pour 3 packages.
- **`apps/api`** — NestJS + PostgreSQL (Prisma) + Socket.IO. Pas de PostGIS ni
  de Redis au stade MVP : les cercles sont petits, un calcul haversine en
  applicatif suffit, et une seule instance API n'a pas besoin d'un adaptateur
  Socket.IO distribué. À réévaluer si l'app scale.
- **`apps/mobile`** — Expo / React Native (SDK 57), expo-router v6 (fichiers
  sous `src/app`), React Query pour l'état serveur, Zustand pour l'état
  réactif local (auth, positions live, ETA, feed d'événements). Carte via
  **MapLibre** (`@maplibre/maplibre-react-native`) avec le style vectoriel
  gratuit **OpenFreeMap "liberty"** — pas de compte ni de clé API à
  configurer, contrairement à Google Maps (dont l'absence de clé cause
  justement l'écran noir classique sur Android).
- **`packages/shared`** — schémas **zod** (contrat HTTP + WebSocket, unique
  source de vérité entre client et serveur, exploités par le
  `ZodValidationPipe` côté API et par `apiRequest` côté mobile) + logique géo
  pure (haversine, ETA, génération de polygone pour dessiner un rayon de
  géofencing sur une carte vectorielle) + génération de code d'invitation.

## Pourquoi ce découpage des fonctionnalités

- **Cercles** = l'unité de partage (au lieu d'un simple 1-à-1). On rejoint un
  cercle par code d'invitation, et on partage sa position avec tout le cercle
  d'un coup.
- **Géofencing** et **ETA/arrivée automatique** utilisent tous les deux le
  même flux : chaque ping de position (`LocationsService.recordPing`) déclenche
  en série la diffusion aux membres du cercle, l'évaluation des zones
  (`GeofencingService`) et l'avancement des sessions de partage actives
  (`ShareSessionsService`). Un seul point d'entrée, pas de logique dupliquée.
- **Historique** : chaque ping est persisté (`LocationPing`), interrogeable
  par plage de dates — sert au "replay" de trajet sur la carte.
- Le suivi en tâche de fond n'est actif **que pendant une session de partage**
  (pas de tracking ambiant permanent) : c'est ce qui permet le geofencing tout
  en restant respectueux de la batterie et de la vie privée — on ne peut
  recevoir d'alerte sur quelqu'un que s'il partage activement avec le cercle.

## Démarrer en local

```bash
pnpm install

# 1. Backend
pnpm db:up                      # Postgres via docker compose
cp apps/api/.env.example apps/api/.env
pnpm --filter @orbit/shared build
cd apps/api && npx prisma migrate dev --name init
npx prisma db seed              # crée des comptes de test, voir ci-dessous
pnpm dev:api                    # http://localhost:3333

# 2. Mobile (autre terminal)
pnpm dev:mobile                 # expo start
```

### Ajouter un utilisateur de test

Le mot de passe est stocké hashé (bcrypt) : impossible d'insérer une ligne
`User` directement via `prisma studio` ou du SQL brut et de s'en servir pour
se logger. Deux façons de faire :

- **Un compte ponctuel** : `POST /auth/register` avec `curl` ou l'app —
  c'est le chemin normal, testé de bout en bout.
- **Un jeu de données répété pour dev/tests** : `apps/api/prisma/seed.ts`
  crée deux comptes (`ada@test.dev` / `bob@test.dev`, mot de passe
  `password123`), un cercle partagé entre eux (code d'invitation
  `TESTCLE1`) et un lieu "Maison". Lancer avec `npx prisma db seed` (depuis
  `apps/api`) — c'est idempotent (upsert), donc rejouable sans dupliquer.

`npx prisma studio` reste utile pour **consulter/modifier** les données
existantes (cercles, lieux, sessions...), juste pas pour créer un mot de
passe à la main.

L'URL de l'API mobile est dérivée automatiquement de l'IP du serveur Metro
(`Constants.expoConfig.hostUri`), comme dans le projet Smile Life — un
téléphone physique sur le même réseau la joint sans configuration. Override
possible via `EXPO_PUBLIC_API_URL`.

### Important : build de développement requis (pas Expo Go)

Deux raisons obligent à sortir d'Expo Go :

- Le suivi de position en arrière-plan (`expo-location` +
  `expo-task-manager`) n'est **pas supporté par Expo Go** depuis les
  dernières versions du SDK.
- La carte utilise **MapLibre** (`@maplibre/maplibre-react-native`), un
  module natif — pas de rendu possible dans Expo Go, il faut un *dev client*.

```bash
cd apps/mobile
npx expo prebuild
npx expo run:ios      # ou run:android
```

À rejouer (`prebuild --clean` puis `run:ios`/`run:android`) à chaque fois
qu'un module natif change (ajout/suppression de dépendance native, upgrade de
SDK) — un simple reload JS ne suffit pas dans ce cas.

Sans dev client, l'app fonctionne quand même pour l'essentiel (auth, cercles,
lieux) mais ni la carte ni le partage de position en arrière-plan ne
démarreront.

## Tests

```bash
pnpm test        # vitest (shared) + jest (api) + jest (mobile) — 58 tests
pnpm typecheck    # tsc --noEmit sur les 3 packages
```

Les tests couvrent la logique métier (auth/JWT rotation, appartenance à un
cercle, transitions enter/exit du geofencing, calcul ETA/arrivée, formatage,
client API avec refresh de token) via des mocks de Prisma/fetch — pas besoin
d'une base de données pour les lancer.

L'API a été testée de bout en bout manuellement (register → login → refresh
rotation → création de cercle/lieu → ping de position → réception temps réel
du `friend-update` et du `geofence:event` sur le WebSocket → historique).

## Limites connues du MVP (volontairement hors scope)

- **Pas de notifications push** natives (APNs/FCM) : les alertes de
  géofencing/arrivée s'affichent seulement in-app, en direct, tant que l'app
  a une connexion WebSocket ouverte. C'est la prochaine brique naturelle
  (`expo-notifications` + envoi serveur) une fois le MVP validé.
- **ETA à vol d'oiseau**, pas d'itinéraire routier — pas d'API de routing
  (Google Directions, Mapbox...) intégrée pour rester gratuit au démarrage.
- **UI non vérifiée visuellement** : les écrans compilent (`tsc`, bundling
  Metro réussi) et la logique est testée unitairement, mais je n'ai pas de
  simulateur/appareil dans cet environnement pour un test visuel réel — à
  faire avant tout lancement.
- Géofencing évalué avec une requête par lieu (`findFirst` du dernier
  événement) : suffisant pour des cercles de quelques lieux, à optimiser
  (requête groupée) si ça grossit.
