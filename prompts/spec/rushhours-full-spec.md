# RushHours — Spécification fonctionnelle & technique complète

> Ce document est un prompt d'implémentation destiné à un agent IA (Claude Code ou équivalent).
> Objectif : implémenter en une seule passe l'ensemble des fonctionnalités décrites ci-dessous, dans le monorepo existant (`apps/web` React/Vite, `apps/api` NestJS/Prisma/PostgreSQL — voir `CLAUDE.md` à la racine pour les conventions déjà en place : proxy Vite `/api`, `db:setup` automatique, `PrismaModule` global, etc.).
> Respecter les conventions déjà établies (pas de TypeScript côté web, modules Nest par feature côté api) et ne pas casser le comportement documenté dans `CLAUDE.md`.

---

## 1. Objectif produit

Application de suivi du temps de travail permettant à un salarié de :

1. Saisir jour par jour ses heures d'arrivée / de départ, et déclarer sa pause déjeuner (comprise entre 12h et 14h).
2. Configurer son nombre d'heures contractuelles hebdomadaires (35h, 37h, 40h ou toute valeur libre).
3. Visualiser, à trois niveaux (jour / semaine / mois), l'écart entre le temps attendu et le temps réellement réalisé, sous forme de crédit d'heures (vert) ou débit d'heures (rouge).
4. Visualiser le mois sous forme de calendrier coloré par jour selon l'écart, avec le cumul du mois affiché.
5. Consulter une seconde vue "Analyses" avec des graphiques sur ses données de pointage.

Authentification par **Passkeys (WebAuthn/FIDO2)**, avec deux comptes préexistants en base (`user`, `admin`). Première connexion → onboarding (nom, prénom, email, heures contractuelles hebdo).

---

## 2. Stack technique imposée et choix complémentaires

### Imposé par l'utilisateur

| Domaine | Choix |
|---|---|
| Validation (front + back) | **Zod** |
| Styling / design system | **Tailwind CSS uniquement**, Material Design en variante **flat** |
| Composants UI React | **PrimeReact v11** (https://primereact.dev/), couche **Primitive** uniquement — aucune autre librairie de composants/graphiques (voir design system ci-dessous et `.claude/skills/primereact`) |
| i18n | **react-i18next**, sélecteur de langue en liste déroulante dans le header, à gauche du menu avatar |
| Lint / format | **ESLint + Prettier**, config Prettier par défaut intégrée à ESLint, exécutée aussi lors du `build` |
| Logs (api) | **Winston ou Pino** |
| Auth | **Passkeys / WebAuthn / FIDO2** |

### Choix techniques complémentaires (à faire par l'agent, décisions figées ci-dessous pour éviter toute ambiguïté)

- **WebAuthn** : `@simplewebauthn/server` (api) + `@simplewebauthn/browser` (web). C'est la librairie de référence, agnostique du framework, activement maintenue, et s'intègre facilement à NestJS sans dépendance imposée côté serveur HTTP.
- **Logs** : **Pino** via `nestjs-pino` + `pino-http` (intégration officielle recommandée par la communauté NestJS, logs JSON structurés, faible overhead). Remplacer le logger Nest par défaut au bootstrap.
- **Validation Zod côté Nest** : `nestjs-zod` pour générer les pipes de validation et DTOs à partir de schémas Zod partagés/dupliqués entre front et back.
- **Formulaires front** : `react-hook-form` + `@hookform/resolvers/zod` (pairing standard avec Zod, évite d'écrire la validation à la main).
- **Routing front** : `react-router` (v6+), nécessaire pour distinguer les vues Connexion / Onboarding / Saisie / Analyses.
- **Graphiques** : **pas de librairie externe.** Le composant `Chart` de PrimeReact n'existe plus dans la version gratuite de PrimeReact v11 (passé dans l'offre commerciale PrimeUI Pro — voir `.claude/skills/primereact`). Contrainte du projet : rester uniquement sur PrimeReact, donc pas de `chart.js`/`react-chartjs-2` en dépendance supplémentaire. Les graphiques de la vue Analyses (§7.3) sont construits à la main en SVG/Tailwind (barres, ligne de tendance), éventuellement complétés par les primitives PrimeReact encore gratuites qui s'y prêtent (`MeterGroup`, `ProgressBar`, `Knob`) pour des indicateurs ponctuels.
- **Session applicative** : après succès de la cérémonie WebAuthn, l'API émet un **JWT signé stocké dans un cookie httpOnly, `SameSite=Lax`** (via `@nestjs/jwt`). Pas de store de session externe (Redis) : inutile pour ce POC. Un `AuthGuard` Nest lit ce cookie sur les routes protégées.

Ne pas introduire d'autres dépendances structurantes (state manager global, ORM alternatif, etc.) sans que ce soit strictement nécessaire.

### 2.1 Design system : Material flat, Tailwind seul

Contrainte explicite : **aucun thème CSS PrimeReact** (pas de preset Aura/Material/Lara/Nora, pas de package `primereact` classique). PrimeReact v11 se décline en plusieurs couches (Headless / Primitive / Tailwind / Styled, voir `.claude/skills/primereact` §1) — ce projet utilise exclusivement la couche **Primitive** :

- Composants ajoutés via `npx shadcn@latest add https://primereact.dev/r/<component>.json`, qui copie le code source localement dans `apps/web/src/components/ui/` (comportement/accessibilité PrimeReact inclus, zéro style imposé). Convertir immédiatement le fichier généré en `.jsx` sans annotations de type (le générateur produit du `.tsx` par défaut ; ce dépôt est JS/JSX uniquement, voir `CLAUDE.md`).
- Styliser directement ces fichiers copiés avec des classes Tailwind — pas de props `pt`/passthrough ni de `PrimeReactProvider` en mode `unstyled` à configurer, puisqu'il n'y a plus de thème runtime à désactiver : le fichier local est déjà 100 % vierge de style.
- Définir dans `tailwind.config.js` une palette inspirée Material (tokens `primary`, `secondary`, `surface`, `success`, `error`, `warning`) avec un seul jeu de nuances par rôle — pas de dégradés, pas d'ombres portées (`shadow-*` proscrit au profit de bordures fines `border-slate-200`/`border-slate-700` pour délimiter les surfaces). Coins légèrement arrondis (`rounded-md`) mais jamais de `rounded-full` hors avatar/icônes.
- États interactifs (hover/focus/active/disabled) gérés uniquement par variation de teinte Tailwind (`hover:bg-primary-600`, `focus-visible:ring-2`), jamais par élévation/ombre.
- Un seul composant `src/components/ui/Modal.jsx` (basé sur le `Dialog` Primitive copié localement, compound API `Dialog.Root`/`Dialog.Trigger`/`Dialog.Content`) sert de socle à toutes les modales de l'application (Paramètres, Semaine de travail, etc.) pour garantir une apparence cohérente.

---

## 3. Modèle de données (Prisma)

Étendre `apps/api/prisma/schema.prisma`. Le modèle `Hello` de démo peut être supprimé (il ne sert qu'au POC initial de connectivité).

```prisma
enum Role {
  USER
  ADMIN
}

enum Weekday {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model User {
  id                    String        @id @default(uuid())
  username              String        @unique // "user" / "admin" — identifiant de connexion stable, distinct de l'email
  email                 String?       @unique
  firstName             String?
  lastName              String?
  role                  Role          @default(USER)
  weeklyContractHours   Decimal       @default(35) @db.Decimal(5, 2)
  weekStartDay          Weekday       @default(MONDAY) // jour par lequel commence la semaine de l'utilisateur
  onboardingCompletedAt DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  credentials           Credential[]
  timeEntries           TimeEntry[]
  workingDaySchedules   WorkingDaySchedule[]

  @@map("users")
}

// Un enregistrement = un jour "travaillé" pour cet utilisateur + la part de weeklyContractHours
// attendue ce jour-là. L'absence d'enregistrement pour un jour de la semaine = jour non travaillé.
model WorkingDaySchedule {
  id            String   @id @default(uuid())
  weekday       Weekday
  targetMinutes Int      // heures attendues ce jour-là, exprimées en minutes

  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekday])
  @@map("working_day_schedules")
}

model Credential {
  id           String   @id @default(uuid()) // PK interne
  credentialId String   @unique // base64url de l'ID renvoyé par WebAuthn
  publicKey    Bytes
  counter      BigInt   @default(0)
  transports   String[] @default([])
  deviceLabel  String?
  createdAt    DateTime @default(now())

  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("credentials")
}

model TimeEntry {
  id               String   @id @default(uuid())
  date             DateTime @db.Date // jour concerné, sans heure
  arrivalTime      DateTime // horodatage complet (date + heure) du jour concerné
  departureTime    DateTime
  lunchBreakStart  DateTime
  lunchBreakEnd    DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@map("time_entries")
}
```

Notes d'implémentation :

- On ne **persiste aucun champ calculé** (heures travaillées, écart, cumul). Tout est recalculé à la volée côté API à partir des horodatages bruts. Raison : si l'utilisateur modifie son quota hebdomadaire **ou sa répartition de jours travaillés**, l'historique doit refléter la config actuelle sans migration de données ni historisation par date (limite POC assumée, voir §9).
- `weeklyContractHours` en `Decimal` pour accepter des valeurs libres (ex. 36.5h). C'est le total de référence ; `WorkingDaySchedule` doit toujours en être une répartition exacte (`sum(targetMinutes) === weeklyContractHours * 60`), contrôlé par Zod à l'écriture (§6, endpoint `work-schedule`).
- `weekStartDay` détermine la borne de découpage des semaines pour tous les calculs et affichages (agrégats, calendrier) — voir §4.5.

### Seed (`apps/api/prisma/seed.ts`)

Créer deux comptes, **sans credential associé** (ils seront enrôlés via WebAuthn au premier accès — voir §5) :

```ts
{ username: 'user',  role: 'USER'  }
{ username: 'admin', role: 'ADMIN' }
```

Pas d'email/prénom/nom au seed : ces champs sont vides tant que l'onboarding n'a pas été fait.

---

## 4. Règles de calcul (cœur métier — à isoler dans un module partagé/testable, ex. `apps/api/src/time-tracking/balance.util.ts`)

### 4.1 Temps travaillé d'un jour

```
workedMinutes(entry) = (departureTime - arrivalTime) - (lunchBreakEnd - lunchBreakStart)
```

### 4.2 Validation d'une saisie journalière (Zod)

- `arrivalTime < lunchBreakStart < lunchBreakEnd < departureTime`
- `lunchBreakStart >= 12:00` et `lunchBreakEnd <= 14:00` (bornes incluses)
- `lunchBreakEnd - lunchBreakStart > 0`
- Toutes les heures doivent être sur le même jour calendaire (`date`)

### 4.3 Cible journalière — configuration "semaine de travail"

Il n'y a plus d'hypothèse figée : chaque utilisateur configure sa propre semaine de travail via l'écran dédié du §5.5 (jours travaillés, répartition des heures, jour de début de semaine).

- `dailyTargetMinutes(date) = targetMinutes de la ligne WorkingDaySchedule dont le weekday correspond au jour de `date``.
- Si aucune ligne ne correspond (jour non coché comme travaillé par l'utilisateur), le jour est **non travaillé** : pas de cible, pas de saisie attendue, cellule neutre partout (formulaire du jour peut rester accessible en saisie libre, mais n'entre dans aucun calcul de cible/écart — voir aussi 4.4).
- Tant que l'utilisateur n'a pas complété la configuration de sa semaine de travail (première visite non terminée), `dailyTargetMinutes` est indéterminé : le blocage se fait en amont via l'onboarding obligatoire (§5.4/5.5), pas par un calcul de repli.

### 4.4 Écart (balance)

- `dailyBalanceMinutes = workedMinutes(entry) - dailyTargetMinutes(date)`, **uniquement pour les jours travaillés (ligne `WorkingDaySchedule` existante) ayant une saisie**. Un jour non travaillé, ou un jour travaillé sans saisie, est neutre : il n'entre dans aucun cumul (pas de pénalité rétroactive implicite, pas de couleur).
- `weeklyBalanceMinutes = somme des dailyBalanceMinutes des jours saisis de la semaine en cours` (bornes de semaine définies par `weekStartDay`, §4.5).
- `monthlyBalanceMinutes = somme des dailyBalanceMinutes des jours saisis du mois`.
- Couleur : `>= 0` → vert (crédit), `< 0` → rouge (débit). Afficher le signe et la magnitude au format `+1h30` / `-0h45`.

### 4.5 Semaine (bornes configurables)

La semaine ne suit plus systématiquement la convention ISO (lundi → dimanche) : elle commence au jour choisi par l'utilisateur (`user.weekStartDay`), sur 7 jours consécutifs (ex. `weekStartDay = WEDNESDAY` → semaine mercredi → mardi suivant inclus).

- Utilitaire partagé `getWeekRange(date, weekStartDay)` retournant `{ start, end }` (bornes incluses) — à utiliser à la fois pour les agrégats API (`summary`, `analytics`) et pour le regroupement du calendrier mensuel côté front (première colonne de chaque ligne = `weekStartDay`).
- La vue "semaine" affiche les 7 jours de la semaine courante (ou sélectionnée) dans cet ordre, avec un total en bas.

---

## 5. Authentification (WebAuthn / Passkeys)

### 5.1 Contrainte du POC

Il n'y a pas d'inscription libre : seuls les deux comptes seedés (`user`, `admin`) existent. Un compte sans credential doit pouvoir **enrôler sa première passkey** (cérémonie d'enregistrement WebAuthn) — cela remplace un mot de passe initial. Un compte avec au moins une credential ne peut plus refaire cette cérémonie via ce flux public (sécurité minimale du POC — voir §9).

### 5.2 Endpoints (`apps/api/src/auth/`, module dédié)

| Méthode | Route | Effet |
|---|---|---|
| POST | `/auth/webauthn/register/options` | body `{ username }`. Si `username` connu et **0 credential** → renvoie les `PublicKeyCredentialCreationOptions` (challenge stocké en cookie signé ou table temporaire courte durée). Sinon 409. |
| POST | `/auth/webauthn/register/verify` | body `{ username, attestationResponse }`. Vérifie, enregistre la `Credential`, pose le cookie de session JWT. |
| POST | `/auth/webauthn/login/options` | body `{ username }`. Si `username` connu et **≥1 credential** → renvoie les `PublicKeyCredentialRequestOptions`. Sinon 404. |
| POST | `/auth/webauthn/login/verify` | body `{ username, assertionResponse }`. Vérifie l'assertion, incrémente `counter`, pose le cookie de session JWT. |
| POST | `/auth/logout` | Efface le cookie de session. |
| GET | `/auth/me` | Retourne l'utilisateur courant (id, username, role, profil, `onboardingCompletedAt`) ou 401. |

`rpID`/`origin` WebAuthn à dériver de l'URL du front (dev : origin Codespaces ou `localhost`, configurable via variable d'env `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` dans `.env` / `.env.example`).

### 5.3 Écran de connexion (front)

- Champ "Identifiant" (`username`) + bouton "Se connecter avec une passkey".
- Logique : tenter `login/options`. Si 404 (aucune credential), proposer "Créer votre passkey pour ce compte" → lance `register/options` puis la cérémonie `@simplewebauthn/browser` `startRegistration`. Si credential(s) existante(s), lance `startAuthentication`.
- Après succès → redirection : si `onboardingCompletedAt` est vide, vers l'écran d'onboarding ; sinon vers la vue Saisie.

### 5.4 Onboarding (première connexion)

Parcours en **deux étapes**, non contournable tant qu'il n'est pas terminé (route dédiée `/onboarding`, ou wizard en modal — au choix de l'agent, mais les deux étapes doivent être présentées l'une après l'autre sans possibilité de sauter la seconde) :

1. **Profil** : nom, prénom, email. Validation Zod, soumission → `PATCH /users/me`.
2. **Semaine de travail** : ouvre directement l'écran de configuration décrit au §5.5 (le même composant que celui réutilisé plus tard depuis les Paramètres). Une fois cette étape enregistrée, `onboardingCompletedAt = now()` est posé côté API (dans le même endpoint que celui du §5.5, avec un flag ou en dérivant l'état "onboarding terminé" de la présence d'au moins un profil ET d'un `WorkingDaySchedule` non vide — au choix de l'implémentation, mais `onboardingCompletedAt` reste le champ de vérité lu par le guard de route `/onboarding`).

### 5.5 Écran modal "Ma semaine de travail" (indépendant, réutilisable)

Composant modal autonome (`src/components/WorkScheduleModal.jsx` ou équivalent), monté à deux endroits :
- Étape 2 de l'onboarding (§5.4)
- Menu avatar du header → "Ma semaine de travail" (§7.1), à tout moment après l'onboarding, pour modifier la configuration

Contenu du formulaire :
- **Heures contractuelles hebdomadaires** : champ numérique libre + raccourcis `ToggleButtonGroup` (nom v11 de l'ancien `SelectButton`) 35 / 37 / 40 (comme précédemment prévu dans l'onboarding, déplacé ici puisque indissociable de la répartition).
- **Jours travaillés** : 7 cases à cocher (Lundi → Dimanche, libellés traduits i18n), ordre d'affichage à partir de `weekStartDay` courant si déjà défini, sinon ordre Lundi→Dimanche par défaut.
- **Répartition des heures par jour coché** : un champ "heures" par jour travaillé (ex. `InputNumber` PrimeReact), avec un **indicateur en temps réel de l'écart entre la somme saisie et le total hebdomadaire** (`Δ = weeklyContractHours*60 - Σ targetMinutes`), affiché en vert si `Δ = 0`, en rouge sinon. **Le bouton Enregistrer est désactivé tant que `Δ ≠ 0`.**
  - Valeur par défaut proposée à l'ouverture initiale (aucune config existante) : répartition égale de `weeklyContractHours` sur les jours cochés (Lundi–Vendredi cochés par défaut).
  - Décocher un jour retire sa ligne de saisie et redistribue implicitement rien (l'utilisateur doit ajuster manuellement les autres jours pour que `Δ` revienne à 0 — pas de redistribution automatique, pour rester prévisible).
- **Jour de début de semaine** : `Select` PrimeReact (nom v11 de l'ancien `Dropdown`, les 7 jours), détermine `user.weekStartDay`. Doit être parmi les jours cochés comme travaillés n'est **pas** une contrainte obligatoire (l'utilisateur peut démarrer sa semaine un jour non travaillé, ex. semaine du dimanche au samedi avec dimanche non travaillé).

Soumission → `PUT /users/me/work-schedule` (§6). Validation Zod stricte côté front ET back (au moins 1 jour coché, `targetMinutes > 0` par jour coché, somme exacte).

---

## 6. API — endpoints métier (`apps/api/src/time-entries/`, `apps/api/src/users/`)

Toutes protégées par le guard de session (sauf `/auth/*`).

| Méthode | Route | Description |
|---|---|---|
| PATCH | `/users/me` | Met à jour le profil uniquement (firstName, lastName, email). Utilisé par l'étape 1 de l'onboarding et par la modal "Mon profil" des Paramètres. |
| GET | `/users/me/work-schedule` | Retourne `{ weeklyContractHours, weekStartDay, days: [{ weekday, targetMinutes }] }` pour l'utilisateur courant. |
| PUT | `/users/me/work-schedule` | Remplace intégralement la config (body identique à la lecture). Valide `sum(targetMinutes) === weeklyContractHours * 60`, ≥1 jour. Utilisé par l'étape 2 de l'onboarding et par la modal "Ma semaine de travail" (§5.5). Pose `onboardingCompletedAt` si absent. |
| GET | `/time-entries?month=YYYY-MM` | Liste des saisies brutes du mois pour l'utilisateur courant. |
| PUT | `/time-entries/:date` (`YYYY-MM-DD`) | Crée/remplace la saisie du jour (upsert). Body validé par le schéma Zod du §4.2. |
| DELETE | `/time-entries/:date` | Supprime une saisie (droit à l'erreur). |
| GET | `/time-entries/summary?month=YYYY-MM` | Retourne, pour le mois : liste des jours avec `{ date, workedMinutes, targetMinutes, balanceMinutes }`, les totaux par semaine ISO incluse dans le mois, et le cumul mensuel. Alimente le calendrier + la vue semaine/jour. |
| GET | `/time-entries/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Séries temporelles (mêmes champs que summary) sur une plage libre, pour la vue Analyses. |

---

## 7. Frontend — structure des vues

Routing (`react-router`) :

- `/login` — écran de connexion passkey (§5.3)
- `/onboarding` — formulaire première connexion, garde de route si `onboardingCompletedAt` absent
- `/` — **Vue Saisie** (vue principale)
- `/analytics` — **Vue Analyses**

Toutes les routes sauf `/login` sont protégées (redirection vers `/login` si `GET /auth/me` renvoie 401).

### 7.1 Header (sticky, présent sur toutes les vues protégées)

De gauche à droite :
1. Logo / titre "RushHours"
2. Navigation (PrimeReact `Tabs` — `TabMenu`/`Menubar` n'existent plus en v11, routage géré via `react-router`) : "Saisie" / "Analyses"
3. (droite) Sélecteur de langue — `Select` PrimeReact (nom v11 de l'ancien `Dropdown`), liste des langues i18next configurées (FR/EN minimum)
4. Bouton avatar utilisateur → ouvre un menu :
   - "Mon profil" → modal formulaire nom/prénom/email (§5.4 étape 1)
   - "Ma semaine de travail" → réutilise la modal indépendante du §5.5 (jours travaillés, répartition, jour de début de semaine)
   - "Déconnexion" → `POST /auth/logout`

### 7.2 Vue Saisie (`/`)

- **Formulaire du jour** : sélecteur de date (par défaut aujourd'hui), champs heure d'arrivée, heure de départ, début pause déjeuner, fin pause déjeuner (bornées 12h–14h dans le composant), bouton Enregistrer. Utiliser `DatePicker` PrimeReact (nom v11 de l'ancien `Calendar`) avec `timeOnly` pour les champs heure.
- **Indicateur du jour** : une fois la saisie faite pour le jour sélectionné, afficher une jauge/barre (composant simple Tailwind ou `Knob`/`ProgressBar` PrimeReact) montrant l'écart vs cible journalière, colorée vert/rouge, avec le libellé `+1h30` / `-0h45`.
- **Indicateur de la semaine** : même principe, agrégé sur la semaine ISO courante (utilise `GET /time-entries/summary`).
- **Calendrier du mois** : grille mensuelle custom Tailwind (7 colonnes, la première colonne correspondant à `user.weekStartDay`, pas nécessairement Lundi) où chaque cellule-jour est colorée selon `balanceMinutes` du jour (dégradé vert/rouge, neutre si jour non travaillé ou sans saisie), avec le cumul du mois affiché en en-tête de la grille. Navigation mois précédent/suivant.

### 7.3 Vue Analyses (`/analytics`)

Au moins :
- Graphique en barres : heures travaillées par jour sur la période sélectionnée (semaine/mois/plage libre).
- Graphique en ligne : évolution du cumul (balance) dans le temps, avec une ligne de référence à zéro.
- Graphique en barres : totaux hebdomadaires sur les dernières N semaines.
- Sélecteur de plage de dates (mois courant par défaut) réutilisant `GET /time-entries/analytics`.

**Pas de `Chart` PrimeReact** (retiré de la version gratuite en v11, voir §2). Construire ces trois graphiques comme des composants SVG/Tailwind faits maison dans `src/components/charts/` (ex. `BarChart.jsx`, `TrendLine.jsx`) — barres = `<rect>` proportionnels aux valeurs, ligne = `<polyline>`/`<path>` avec une ligne de référence à `y=0`. Rester volontairement simple (pas de zoom, tooltip riche, ou animation avancée) : le besoin est de représenter des séries courtes (jours d'un mois, N semaines), pas un tableau de bord général. `ProgressBar`/`Knob`/`MeterGroup` PrimeReact (couche Primitive) restent une option pour un indicateur ponctuel isolé, mais pas pour ces trois graphiques multi-points.

---

## 8. i18n, lint/format, logs — détails d'implémentation

### 8.1 react-i18next

- `apps/web/src/i18n/` : configuration `i18next` + `react-i18next`, détection de langue (localStorage puis navigateur), fichiers de traduction `fr.json` / `en.json` couvrant tous les libellés (header, formulaires, messages d'erreur Zod, calendrier, analytics).
- Dropdown de langue dans le header met à jour la langue et persiste le choix (localStorage).

### 8.2 ESLint + Prettier

- **apps/web** : ajouter une config ESLint flat (`eslint.config.js`) équivalente à celle d'`apps/api` mais adaptée React/JS (plugins `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` si pertinent) + `eslint-plugin-prettier/recommended` avec la **config Prettier par défaut** (pas de `.prettierrc` avec des overrides, sauf nécessité technique documentée). Ajouter script `"lint": "eslint ."` dans `apps/web/package.json`.
- Dans **chaque workspace** (`apps/web`, `apps/api`), ajouter un hook `"prebuild": "npm run lint"` afin que `npm run build` échoue si le lint échoue (répond à "rajoute cette validation au build"). Ne pas dupliquer cette logique au niveau racine : le `prebuild` par workspace suffit puisque le script racine `build` délègue déjà via `--workspaces --if-present`.
- Garder une configuration Prettier commune si utile (`.prettierrc` à la racine) pour que les deux workspaces partagent le même style ; sinon la config par défaut de Prettier est suffisante et ne nécessite aucun fichier.

### 8.3 Logs API (Pino)

- `nestjs-pino` branché dans `AppModule` (`LoggerModule.forRoot`), remplacer le logger Nest par défaut au bootstrap (`app.useLogger(app.get(Logger))` dans `main.ts`).
- Logs structurés JSON en production, format "pretty" (`pino-pretty`) en développement (`NODE_ENV !== 'production'`).
- Logger les échecs de cérémonie WebAuthn (niveau `warn`) et les erreurs de validation Zod (niveau `debug`), sans jamais logger les secrets/challenges/JWT.

---

## 9. Limites connues du POC (à documenter dans le code / README, ne pas tenter de les résoudre)

- La configuration de la semaine de travail (`WorkingDaySchedule`, `weekStartDay`) n'est **pas historisée** : la modifier recalcule rétroactivement l'écart de tous les jours passés avec la nouvelle config, il n'y a pas de "config valable du X au Y".
- Pas de gestion des congés/jours fériés : un jour travaillé sans saisie est neutre, jamais compté en débit — même s'il s'agit d'un jour normalement travaillé.
- Le rôle `ADMIN` est présent dans le modèle et le JWT mais ne donne accès à aucune fonctionnalité spécifique dans cette itération (pas d'écran d'administration) — prévu pour une itération future.
- L'enrôlement WebAuthn "premier accès" sur un compte seedé sans mot de passe préalable est une facilité de POC : en production, ce bootstrap devrait être protégé (lien d'invitation à usage unique, etc.).

---

## 10. Plan d'implémentation suggéré (ordre pour l'agent)

1. **Prisma** : mettre à jour `schema.prisma` (§3), créer la migration, mettre à jour `seed.ts`, supprimer le modèle `Hello` et son usage dans `AppController`/`AppService`.
2. **API — fondations** : installer et brancher `nestjs-pino`, `nestjs-zod`, `@simplewebauthn/server`, `@nestjs/jwt`, `cookie-parser`. Configurer `.env.example` (ajout `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `JWT_SECRET`).
3. **API — module Auth** : endpoints WebAuthn (§5.2), guard de session basé sur le cookie JWT.
4. **API — module Users** : `PATCH /users/me`, `GET`/`PUT /users/me/work-schedule` (avec validation Zod de la somme des minutes, §5.5).
5. **API — module TimeEntries** : CRUD + `summary` + `analytics`, module de calcul partagé (§4) prenant en compte `WorkingDaySchedule`/`weekStartDay`, avec tests unitaires Jest sur les règles de calcul (cas limites : jour non travaillé, pas de saisie, pause en dehors de 12h–14h, semaine à cheval sur deux mois, `weekStartDay` différent de lundi).
6. **Front — fondations** : Tailwind (tokens Material flat, §2.1), mise en place du générateur PrimeReact Primitive (`components.json` shadcn, voir `.claude/skills/primereact`), react-router, react-i18next, structure de dossiers (`src/pages`, `src/components`, `src/components/ui`, `src/components/charts`, `src/api`, `src/i18n`).
7. **Front — Auth** : écran login passkey, garde de route, appel `/auth/me` au démarrage (contexte React `AuthProvider`).
8. **Front — modal "Ma semaine de travail"** (§5.5), composant indépendant réutilisé ensuite à deux endroits.
9. **Front — Onboarding** (2 étapes, §5.4) + **modal "Mon profil"** des Paramètres.
10. **Front — Header** sticky (nav, sélecteur de langue, avatar avec les deux entrées Profil / Semaine de travail).
11. **Front — Vue Saisie** : formulaire du jour, indicateurs jour/semaine, calendrier mensuel coloré (grille alignée sur `weekStartDay`).
12. **Front — Vue Analyses** : graphiques SVG/Tailwind faits maison (§7.3, pas de dépendance de charting externe).
13. **Qualité** : configs ESLint/Prettier des deux workspaces + hooks `prebuild`, `npm run lint` et `npm run build` passants à la racine, tests existants (`npm run test`) toujours verts.
14. Vérification manuelle bout en bout dans le navigateur (enrôlement passkey, onboarding en 2 étapes, modification de la semaine de travail depuis les Paramètres, saisie d'une semaine complète avec un `weekStartDay` non standard, cohérence des couleurs jour/semaine/mois, vue Analyses, rendu Material flat).
