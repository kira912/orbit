# Orbit

App mobile de partage de position **temporaire et consenti** : on partage un
trajet le temps qu'il faut, et ça s'arrête tout seul (à l'arrivée, à l'heure
prévue, ou quand le rendez-vous se termine). Cercles de partage, géofencing
(alertes arrivée/départ), rendez-vous à plusieurs avec l'ETA de chacun, lien
de suivi web pour les personnes sans l'app, notifications push, historique
court (7 jours).

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
  Les lieux servent donc surtout de destinations (« Maison » en un tap), avec
  l'arrêt automatique à l'arrivée.

## Les fonctionnalités clés

- **Partager mon trajet** (bouton principal de la carte) : destination parmi
  les lieux du cercle, durée max, ETA en direct, arrêt automatique à
  l'arrivée. Le GPS en arrière-plan se coupe dès que le serveur dit qu'il ne
  reste plus de session active (`reconcileTracking`).
- **Lien de suivi web** : `GET /s/:token` sert une page autonome (MapLibre GL
  JS + OpenFreeMap) qui interroge `GET /public/sessions/:token` toutes les 5 s.
  Le token (24 caractères aléatoires) n'expose que les positions reçues
  *pendant* la session, et plus rien du tout une fois qu'elle est terminée.
- **Rendez-vous** (`/meetups`) : un point de rendez-vous proposé au cercle
  (appui long sur la carte) ; chaque participant le rejoint avec une session
  dont la destination est ce point, et tout le monde voit les ETA. Terminer
  le rendez-vous arrête les sessions encore en route.
- **Notifications push** via le service Expo (`ExpoPushClient`, simple
  `fetch`, pas de SDK) : arrivée/départ d'un lieu, début de partage, arrivée à
  destination, nouveau rendez-vous, nouveau membre. Jamais à l'auteur de
  l'action. Dans l'app ouverte, ce sont des bannières animées qui prennent le
  relais (socket).
- **Activité** : timeline des 7 derniers jours d'un cercle, reconstruite à
  partir des tables existantes (`GET /circles/:id/activity`).
- **Maintenance** (`MaintenanceService`) : toutes les minutes, expire les
  sessions/rendez-vous échus même sans ping ; toutes les heures, supprime les
  positions plus vieilles que `PING_RETENTION_DAYS` (7 par défaut).

## Design

Système de design dans `apps/mobile/src/theme` (tokens couleurs, typo Plus
Jakarta Sans, rayons, ombres, ressorts) et composants dans
`src/components/ui` (boutons avec retour haptique et ressort, chips et
segmented animés, sheet à glisser, bannières, logo animé). Animations via
Reanimated 4 (entrées décalées, transitions de layout, ressorts).

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

## Version web (PWA)

Pour les utilisateurs iPhone sans passer par l'App Store, la même app tourne
dans le navigateur et s'installe sur l'écran d'accueil (Safari → Partager →
« Sur l'écran d'accueil »).

```bash
pnpm --filter @orbit/mobile web        # dev, http://localhost:8081
pnpm --filter @orbit/mobile build:web  # export statique dans apps/mobile/dist
```

Les écrans sont partagés ; seules les briques natives ont une version web :

| Natif | Web |
|---|---|
| `@maplibre/maplibre-react-native` | `src/web/maplibre` (maplibre-gl, alias dans `metro.config.js`) |
| `token-storage.ts` (keychain) | `token-storage.web.ts` (localStorage) |
| `background-location-task.ts` | `.web.ts` : position au premier plan + écran maintenu allumé (Wake Lock) |
| `google-sign-in.ts` | `.web.ts` : flux OAuth par redirection |

**Limites** : le navigateur ne partage la position que **tant que l'app est à
l'écran** (écran verrouillé ou autre app = plus de mises à jour) ; pas encore de
notifications push sur le web (les alertes in-app fonctionnent app ouverte).

La géolocalisation exige **HTTPS** (sauf `localhost`) : un iPhone sur
`http://192.168.x.x` n'aura pas de position.

### Déployer l'API sur Render (+ Postgres Neon)

L'API tourne sur Render (`render.yaml` à la racine), la base sur Neon.

1. **Neon** → créer un projet (région proche, ex. Frankfurt) → *Connect* →
   copier la chaîne de connexion **directe** : désactiver *Connection pooling*,
   car les migrations Prisma ne passent pas par le pooler. Elle doit finir par
   `?sslmode=require`.
2. **Render** → *New* → *Blueprint* → choisir le dépôt. Render lit
   `render.yaml` et demande les variables marquées `sync: false` :
   - `DATABASE_URL` = la chaîne Neon ;
   - `GOOGLE_CLIENT_IDS` = l'ID du client OAuth Web (vide = Google désactivé).
   Les secrets JWT sont générés automatiquement.
3. Au démarrage, l'API applique les migrations puis répond sur `/health`.
   Son URL (`https://orbit-api-xxxx.onrender.com`) est la valeur
   d'`EXPO_PUBLIC_API_URL` côté Vercel.

**Offre gratuite Render** : le service s'endort après ~15 min sans requête, et
le réveil prend environ une minute. Pendant le sommeil, les partages expirés ne
sont clos et les alertes « Rentre bien » ne partent qu'au réveil suivant. Ça
suffit pour tester ; pour un vrai usage, passer sur une offre payante.

### Déployer la PWA sur Vercel

Seule la PWA va sur Vercel. L'API (NestJS + socket.io + Postgres) a besoin
d'un serveur qui tourne en continu et reste hébergée ailleurs, en HTTPS.
La config est dans `apps/mobile/vercel.json`.

1. Vercel → *Add New Project* → importer le dépôt, puis :
   - **Root Directory** : `apps/mobile`, en laissant cochée *Include files
     outside the root directory* (le monorepo et `packages/shared` en ont besoin) ;
   - **Framework Preset** : *Other*. Les commandes d'install et de build
     viennent de `vercel.json`, ne pas les surcharger.
2. *Environment Variables*, valables pour le build (elles sont figées dans le
   bundle, donc un changement demande un redéploiement) :
   - `EXPO_PUBLIC_API_URL` = URL **https** de l'API de prod. Le build échoue
     si elle manque ou n'est pas en https ;
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = l'ID du client OAuth Web.
3. Côté API de prod : `CORS_ORIGIN` doit autoriser le domaine Vercel (ou
   rester `*`) ; le WebSocket passe automatiquement en `wss://`.
4. Google : ajouter `https://<domaine>.vercel.app/` (voir ci-dessous). Les
   déploiements *preview* ont une URL différente à chaque fois, donc la
   connexion Google n'y marche pas : tester Google sur le domaine de prod.

Le build installe les dépendances avec pnpm 12.8.1 (fixé dans `packageManager`
et `vercel.json`, nécessaire pour `nodeLinker: hoisted`), compile
`@orbit/shared` puis exporte le site statique dans `apps/mobile/dist`.

**Connexion Google sur le web** : la PWA passe par une redirection vers Google,
qui revient sur la racine du site. Dans Google Cloud Console → Identifiants →
client OAuth **Web** → « URI de redirection autorisés », ajouter l'adresse
exacte de la PWA **avec le `/` final** (ex. `https://orbit.example.com/` ;
en local `http://localhost:8081/`). Sans ça, Google affiche « Accès bloqué :
redirect_uri_mismatch ». La prise en compte peut prendre quelques minutes.

## Tests

```bash
pnpm test        # vitest (shared) + jest (api) + jest (mobile)
pnpm typecheck    # tsc --noEmit sur les 3 packages
```

Les tests couvrent la logique métier (auth/JWT rotation, appartenance à un
cercle, transitions enter/exit du geofencing, calcul ETA/arrivée, formatage,
client API avec refresh de token) via des mocks de Prisma/fetch — pas besoin
d'une base de données pour les lancer.

L'API a été testée de bout en bout manuellement (register → login → refresh
rotation → création de cercle/lieu → ping de position → réception temps réel
du `friend-update` et du `geofence:event` sur le WebSocket → historique).

### Activer les notifications push

Le code est en place, mais un jeton Expo exige un projet EAS :

1. `cd apps/mobile && npx eas init` (ajoute `extra.eas.projectId` dans
   `app.json`) ;
2. Android : ajouter les identifiants FCM au projet EAS
   (`google-services.json`, voir la doc Expo « Push notifications setup ») ;
   iOS : `eas credentials` s'occupe de la clé APNs.

Sans `projectId`, l'app le signale dans les logs et continue sans push (les
bannières in-app fonctionnent toujours).

### Activer la connexion Google

Le serveur vérifie le jeton d'identité Google (`POST /auth/google`) puis
connecte le compte lié, ou lie un compte existant au même email **vérifié par
Google**, ou en crée un (sans mot de passe).

1. Google Cloud Console → « Écran de consentement OAuth » (mode Externe, s'ajouter
   en utilisateur test).
2. Créer deux ID client OAuth :
   - **Web** : aucun réglage ; c'est son ID qui sert partout ci-dessous ;
   - **Android** : package `com.orbit.app` + SHA-1 du keystore qui signe l'APK
     (debug : `keytool -J-Duser.language=en -list -v -keystore apps/mobile/android/app/debug.keystore -storepass android`).
3. Renseigner l'ID du client **Web** :
   - `apps/api/.env` : `GOOGLE_CLIENT_IDS="xxxx.apps.googleusercontent.com"` ;
   - `apps/mobile/.env` : `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="xxxx.apps.googleusercontent.com"`.
4. Redémarrer l'API et Metro (`--clear`, les variables `EXPO_PUBLIC_*` sont
   injectées au bundling).

Le bouton « Continuer avec Google » n'apparaît que si l'ID est renseigné et hors
Expo Go (module natif). iOS demandera en plus l'option `iosUrlScheme` du plugin
`@react-native-google-signin/google-signin` dans `app.json`.

## Limites connues du MVP (volontairement hors scope)

- **ETA de session à vol d'oiseau** côté serveur (l'itinéraire routier OSRM
  n'est utilisé que pour « Itinéraire vers un membre », côté app).
- **Lien de suivi servi par l'API** : en production, il faut une URL
  publique (le lien est construit à partir de `API_URL`).
- **UI non vérifiée visuellement** : les écrans compilent (`tsc`, bundling
  Metro réussi) et la logique est testée unitairement, mais je n'ai pas de
  simulateur/appareil dans cet environnement pour un test visuel réel — à
  faire avant tout lancement.
- Géofencing évalué avec une requête par lieu (`findFirst` du dernier
  événement) : suffisant pour des cercles de quelques lieux, à optimiser
  (requête groupée) si ça grossit.
