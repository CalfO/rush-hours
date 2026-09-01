# RushHours — Évolutions Vue Saisie : carousel de jours, saisie d'heure simplifiée, semaine de référence

> Ce document est un prompt d'implémentation destiné à un agent IA (Claude Code ou équivalent), à traiter via la pipeline `architect` → `senior-developer` → `dev-tester` → `reviewer` décrite dans `CLAUDE.md` ("Agent team & workflow for feature development"), en s'appuyant sur `.claude/skills/plan-checklist` pour le suivi (créer/mettre à jour `prompts/plan-checklist/` pour cette initiative).
>
> Contexte : `prompts/spec/done/rushhours-full-spec.md` est la spec fonctionnelle d'origine, déjà entièrement implémentée (voir `prompts/plan-checklist/rushhours-implementation-plan.md`). Ce document ne la remplace pas — il la complète avec un lot d'évolutions ciblées sur la **Vue Saisie** (`§7.2` de la spec d'origine) et introduit une nouvelle notion, la **semaine de référence**. Toutes les conventions déjà en place restent valables et ne sont pas répétées ici : TypeScript de bout en bout, Zod, Tailwind seul / Material flat, PrimeReact v11 couche **Primitive** uniquement (voir `.claude/skills/primereact`), `react-hook-form` + `@hookform/resolvers/zod`, schémas/utilitaires dual-usage dans `packages/domain`, modules Nest par feature, tests spec-as-test.
>
> Respecter en particulier la convention UTC-wall-clock déjà établie dans `apps/web/src/components/DayForm.tsx` (commentaires `toUtcMidnight`/`toPickerDate`/`combineDateAndTime`) pour toute nouvelle manipulation de date/heure côté front.

---

## 1. Périmètre de ce lot

1. **Bug** — le placeholder affiché dans les champs d'heure (arrivée, départ, début/fin de pause) est un placeholder de date (`mm/dd/yy`) au lieu d'un placeholder d'heure.
2. **Carousel de jours** — la saisie d'un jour est présentée dans un carousel de cards, une card par jour de la semaine de l'utilisateur, tout en gardant un input calendrier pour aller directement à un jour donné.
3. **Saisie d'heure simplifiée** — clic sur un champ heure → sélecteur heures/minutes avec +/- (déjà en place, à vérifier non régressé) ; clic sur la valeur des heures dans ce sélecteur → grille de toutes les heures de la journée en popover, pour une sélection en un clic.
4. **Semaine de référence** — si une semaine complète est saisie, proposer de l'enregistrer comme semaine de référence (une seule par utilisateur) ; nouvelle entrée de menu utilisateur pour la supprimer ; switch sur le premier jour de la semaine pour réutiliser ses valeurs sur toute la semaine.
5. **Sélecteur de langue** — remplacer le `Select` (dropdown) actuel du header par un `SelectButton`/`ToggleButtonGroup` PrimeReact.
6. **Bug** — le contenu de toutes les modales (`Modal.tsx`) colle aux bords, padding interne cassé.

Chaque point est détaillé ci-dessous avec les décisions techniques figées nécessaires pour lever toute ambiguïté (même esprit que `rushhours-full-spec.md` §2 "choix complémentaires").

---

## 2. Correctif — placeholder des champs heure

**Fichier** : `apps/web/src/components/ui/datepicker.tsx`, fonction `DatePickerInput` (l. 234-263) — `placeholder = "mm/dd/yy"` est la valeur par défaut du composant, utilisée telle quelle par les 4 champs `timeOnly` de `apps/web/src/components/DayForm.tsx` (`arrivalTime`, `departureTime`, `lunchBreakStart`, `lunchBreakEnd`, l. 288, 327, 375, 423) qui ne surchargent pas cette prop.

**Fix** :
- Ne pas changer le défaut global de `DatePickerInput` (il reste correct pour le vrai champ `date` de `DayForm` et pour `MonthCalendar`/tout futur usage date pure).
- Sur chacun des 4 champs heure de `DayForm.tsx` (et de tout composant qui les remplace au point 3 ci-dessous, cf. `DayCard`), passer explicitement `placeholder={t("timeEntry.timePlaceholder")}` avec une nouvelle clé i18n `timeEntry.timePlaceholder` = `"hh:mm"` (FR et EN, un format horaire n'a pas besoin de traduction mais garder la clé i18n pour cohérence avec le reste de l'app).

---

## 3. Carousel de cards — un jour de la semaine par card

### 3.1 Comportement attendu

- La zone de saisie du jour (actuellement le formulaire unique de `DayForm.tsx` dans `TimeEntryPage.tsx`) devient un **carousel de 7 cards**, une par jour de la semaine de l'utilisateur courant, dans l'ordre déterminé par `user.weekStartDay` (même logique d'ordonnancement que `MonthCalendar`/`getWeekRange` de `packages/domain`, spec d'origine §4.5).
- Chaque card affiche les 4 champs de saisie du jour concerné (arrivée, départ, début pause, fin pause) + bouton Enregistrer — reprend le contenu actuel de `DayForm.tsx` **moins** le champ `date` (voir 3.2).
- Navigation dans le carousel (flèches précédent/suivant, ou swipe) = jour précédent/suivant **de la semaine affichée**. Arriver après le 7ᵉ jour ne fait pas automatiquement changer de semaine (la navigation inter-semaines reste le rôle du calendrier mensuel `MonthCalendar`, déjà en place et inchangé).
- Le jour "actif" du carousel doit toujours correspondre à `selectedDate` (état déjà possédé par `TimeEntryPage`) : changer de card via le carousel met à jour `selectedDate` (même effet que `MonthCalendar.onSelectDate` aujourd'hui), et changer `selectedDate` par un autre biais (calendrier mensuel, input calendrier ci-dessous) fait défiler le carousel jusqu'à la card correspondante.
- Un jour non travaillé (pas de `WorkingDaySchedule`, cf. spec d'origine §4.3) garde sa card dans le carousel et reste éditable en saisie libre — comportement déjà établi, ne pas le restreindre.

### 3.2 Input calendrier conservé

Le point d'entrée "choisir directement un jour" (actuellement le `DatePicker` du champ `date` en tête de `DayForm.tsx`, l. 240-267) est **conservé mais sort de la card** puisqu'il n'est plus spécifique à un jour — c'est un contrôle de niveau page. Le remonter dans `TimeEntryPage.tsx`, au-dessus du carousel (par exemple à côté du titre `h1`), avec le même comportement qu'aujourd'hui (`onValueChange` → `handleDateChange`, qui pilote déjà `selectedDate`/`currentMonth`). Un clic sur une date dans ce calendrier doit faire défiler le carousel jusqu'à la card du jour choisi (peut nécessiter de changer de semaine affichée si la date choisie est hors de la semaine courante — dans ce cas le carousel doit se re-render sur la semaine contenant la date choisie, pas juste scroller au-delà de ses 7 cards).

### 3.3 Composants à faire évoluer

- **Renommer/restructurer `DayForm.tsx`** en un composant plus étroit (nom suggéré `DayCard.tsx`) qui ne gère plus que les 4 champs heure + bouton Enregistrer pour **un** jour donné (garde `date`/`existingEntry`/`onSaved` en props, perd `onDateChange` qui n'a plus de sens à ce niveau). Toute la logique de conversion UTC déjà en place (`toUtcMidnight`, `toPickerDate`, `combineDateAndTime`, `clampLocalTimeOfDay`, `toTimeEntryInput`, `dayFormResolver`) reste valable et doit être réutilisée telle quelle, pas ré-écrite.
- **Nouveau composant `WeekCarousel.tsx`** (`apps/web/src/components/`) : reçoit la semaine à afficher (dérivée de `selectedDate` + `weekStartDay` via `getWeekRange`/`getWeekdayForDate` de `@rushhours/domain`), une map des entrées existantes par date (déjà disponible dans `TimeEntryPage` via `entriesByDate`), rend les 7 `DayCard`, gère l'index actif et les callbacks de navigation. C'est ce composant qui héberge aussi le switch du point 4.3 (sur la card du `weekStartDay` uniquement) et qui détecte la complétion d'une semaine (point 4.1).
- **`TimeEntryPage.tsx`** : remplace le montage de `DayForm` par `WeekCarousel`, ajoute le `DatePicker` de sélection de jour (3.2) en contrôle de page, garde son état/effects existants (`selectedDate`, `currentMonth`, fetch de `summary`/`listMonth`/`getWorkSchedule`) quasiment inchangés — seule la façon dont `selectedDate` est piloté depuis "l'intérieur" de la zone de saisie change (carousel au lieu du date-picker unique de `DayForm`).

### 3.4 Composant Carousel

Vérifier si un composant `Carousel` existe dans la couche **Primitive** gratuite de PrimeReact v11 (`npx shadcn@latest add https://primereact.dev/r/carousel.json`, à confirmer dans `.claude/skills/primereact/references/llm-full.md`). Si oui, l'adopter comme base (même méthode que `DatePicker`/`Dialog`/`Select`/`Menu`/`Tabs` déjà tirés dans ce repo) et le styliser Material flat comme les autres composants `src/components/ui/`. **Si ce composant n'est pas disponible gratuitement** (même situation que `Chart`, voir `.claude/skills/primereact` §4), construire un carousel maison en Tailwind (`flex` + `overflow-x-auto`/`scroll-snap-x` + boutons prev/next `ChevronLeft`/`ChevronRight`, mêmes icônes `@primeicons/react` déjà utilisées dans `datepicker.tsx`) — rester simple, pas d'auto-play ni de boucle infinie, ce n'est pas un slider marketing.

---

## 4. Saisie d'heure simplifiée

### 4.1 Ce qui existe déjà (ne pas régresser)

Le clic sur un champ heure ouvre déjà un popover heures/minutes avec boutons +/-. Ce comportement repose sur le composant PrimeReact `Calendar` — renommé `DatePicker` en v11 (voir `.claude/skills/primereact` §3, table "Spec said (v10 name) → Actual v11 name") — utilisé avec son option **`timeOnly`** (+ `hourFormat="24"`), déjà adopté et local à ce repo dans `apps/web/src/components/ui/datepicker.tsx` (`DatePickerTime`/`TimePicker`, l. 324-400 — `PRDatePicker.Hour`/`PRDatePicker.Minute` encadrés de `PRDatePicker.Increment`/`PRDatePicker.Decrement`). C'est exactement le socle attendu pour ce sous-point (et pour le point 4.2 ci-dessous) — **ne pas introduire un composant différent**, s'assurer que ce comportement reste intact après la restructuration du point 3 (les 4 champs heure de `DayCard` gardent leur `<DatePickerPopup><DatePickerTime /></DatePickerPopup>`).

### 4.2 Nouveau — grille d'heures en popover au clic sur la valeur des heures

Au clic sur la valeur numérique des **heures** (le `PRDatePicker.Hour` actuel, dans `TimePicker type="hour"`), ouvrir un second popover imbriqué contenant une **grille de toutes les heures de la journée** (0 à 23, en grille par ex. 6 colonnes × 4 lignes ou 4×6), permettant de sélectionner l'heure en un clic au lieu d'incrémenter/décrémenter. Cette grille est une extension du même composant `DatePicker`/`timeOnly` déjà en place (4.1) — pas un composant de saisie d'heure alternatif. Après sélection dans la grille, le popover d'heures se referme et rend la main au popover minutes/heures existant (ou se ferme entièrement si l'UX choisie par le `senior-developer` le justifie — au choix, du moment que l'heure choisie est bien appliquée).

**Note technique pour l'implémentation** (ne pas deviner, vérifier avant de coder) : `datepicker.tsx` s'appuie sur `useDatePickerContext()` (`primereact/datepicker`) pour lire/modifier l'état interne du picker (voir usage dans `DayTableBody`/`MonthTableBody`/`DatePickerTime`, et les types `UseDatePickerMonthData`/`UseDatePickerMonthOptions`/`UseDatePickerYearOptions` déjà importés depuis `@primereact/types/headless/datepicker`). Avant d'écrire la grille d'heures :
1. Inspecter l'API exposée par ce contexte (`grep` dans `node_modules/primereact/datepicker` et `node_modules/@primereact/types/headless/datepicker`, ou `.claude/skills/primereact/references/llm-full.md`) pour trouver comment fixer directement une valeur d'heure (probable équivalent de ce que font en interne `PRDatePicker.Hour`/`Increment`/`Decrement` — par ex. un setter exposé par le contexte, à confirmer sur la version installée).
2. Si aucune API contextuelle adaptée n'existe, alternative valable : construire la grille **au niveau de `DayCard`** (pas dans `datepicker.tsx`), en s'appuyant sur le fait que chaque champ heure y est déjà entièrement contrôlé via `Controller`/`field.value`/`field.onChange` (React Hook Form) — un bouton de la grille peut directement appeler `field.onChange(new Date(...))` en ne changeant que l'heure et en conservant les minutes actuelles, exactement comme le fait déjà `clampLocalTimeOfDay` pour les champs de pause.
3. Réutiliser les primitives de popover déjà en place dans ce repo pour un menu imbriqué (`Portal`/`Positioner`/`Popup`, motif déjà utilisé par `DatePicker`, `Select` et `Menu` dans `src/components/ui/`) plutôt que d'introduire un nouveau mécanisme de positionnement.

Ce sous-point s'applique aux 4 champs heure de `DayCard` (arrivée, départ, début/fin pause) — même comportement partout, un seul composant à faire évoluer dans `datepicker.tsx` (ou un nouveau petit composant dédié `HourGridPopover` si la structure s'y prête mieux), pas 4 implémentations séparées.

---

## 5. Semaine de référence

### 5.1 Définition

Une **semaine de référence** est un jeu d'heures type (arrivée, départ, début/fin pause), un par jour de la semaine, que l'utilisateur peut enregistrer une fois puis réutiliser pour préremplir une semaine de saisie. **Un seul jeu de semaine de référence par utilisateur** (contrainte explicite de l'utilisateur) — l'enregistrer à nouveau remplace intégralement le précédent (même sémantique que `PUT /users/me/work-schedule`, spec d'origine §5.5).

Une semaine de référence n'a pas de date propre : elle est indexée par jour de semaine (`Weekday`), pas par `Date`. Elle ne couvre que les jours travaillés de l'utilisateur au moment de l'enregistrement (`WorkingDaySchedule`) — un jour non travaillé n'a pas de ligne de référence.

**Ce qui définit "une semaine complète" est entièrement piloté par les paramètres de l'utilisateur, pas par une hypothèse figée sur 5 ou 7 jours.** `WorkingDaySchedule` (spec d'origine §3/§4.3) est déjà une liste libre de 1 à 7 lignes par utilisateur (jours cochés dans la modal "Ma semaine de travail", §5.5 de la spec d'origine) — un utilisateur peut très bien n'avoir que 3 ou 4 jours travaillés. Une "semaine complète" = **tous les jours présents dans le `WorkingDaySchedule` actuel de l'utilisateur ont une `TimeEntry` pour la semaine affichée**, quel que soit ce nombre (1 à 7). `ReferenceWeekEntry` (5.2) hérite naturellement de cette flexibilité : c'est déjà une table à lignes libres par `(userId, weekday)`, sans hypothèse de cardinalité — aucun ajustement structurel du modèle n'est nécessaire au-delà de ce qui suit.

### 5.2 Modèle de données (Prisma)

Étendre `apps/api/prisma/schema.prisma` :

```prisma
model ReferenceWeekEntry {
  id                     String   @id @default(uuid())
  weekday                Weekday
  arrivalMinutes         Int      // minute du jour (0-1439), heure murale locale — même convention que les DatePicker front, pas de fuseau
  departureMinutes       Int
  lunchBreakStartMinutes Int
  lunchBreakEndMinutes   Int
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekday])
  @@map("reference_week_entries")
}
```

Ajouter la relation `referenceWeekEntries ReferenceWeekEntry[]` sur `User`. Pas de modèle "en-tête" séparé (`ReferenceWeek`) : la collection des lignes de l'utilisateur **est** sa semaine de référence, et "il n'y a qu'une semaine de référence par utilisateur" se traduit par `@@unique([userId, weekday])` + remplacement intégral côté service (transaction Prisma : `deleteMany` puis `createMany`, même motif que `UsersService.replaceWorkSchedule`).

Créer la migration correspondante (`npx prisma migrate dev` côté `apps/api`, voir `CLAUDE.md`).

**Scripts d'initialisation (`apps/api/prisma/seed.ts`)** : aucun changement nécessaire. Le seed actuel ne crée que les deux comptes `user`/`admin` (`username`, `role`) — il ne crée déjà aucune ligne `WorkingDaySchedule` (configurée uniquement via l'onboarding/la modal "Ma semaine de travail", spec d'origine §5.4/§5.5). `ReferenceWeekEntry` suit la même logique : c'est une donnée strictement issue d'une action utilisateur explicite (§5.5 ci-dessous), jamais pré-remplie — aucune ligne à seeder pour les comptes de démo.

### 5.3 Schéma partagé (`packages/domain`)

Nouveau fichier `packages/domain/src/reference-week.schema.ts`, exporté depuis `packages/domain/src/index.ts` (ré-exports nommés explicites, **pas** de `export *` — voir la décision déjà actée le 2026-08-28 dans `prompts/plan-checklist/rushhours-implementation-plan.md`, ce piège Vite/ESM a déjà cassé l'app une fois).

- `referenceWeekDaySchema` : `{ weekday: Weekday, arrivalMinutes, departureMinutes, lunchBreakStartMinutes, lunchBreakEndMinutes }`, minutes toutes dans `[0, 1439]`.
- Règles de cohérence par jour, transposées de `time-entry.schema.ts` (spec d'origine §4.2) en version "minutes du jour" : `arrivalMinutes < lunchBreakStartMinutes < lunchBreakEndMinutes < departureMinutes`, `lunchBreakStartMinutes >= 12*60` et `lunchBreakEndMinutes <= 14*60`.
- `referenceWeekSchema` : tableau de `referenceWeekDaySchema`, `weekday` unique dans le tableau, **1 à 7 entrées** — la borne haute suit celle, tout aussi libre, de `workScheduleSchema` (spec d'origine §5.5, "au moins 1 jour coché"), pas une supposition de semaine standard.

### 5.4 API (`apps/api/src/users/`, même module que `work-schedule` — même pattern d'URL)

| Méthode | Route | Effet |
|---|---|---|
| GET | `/users/me/reference-week` | Retourne `{ exists: boolean, days: [...] }` — `exists: false`, `days: []` si l'utilisateur n'en a jamais enregistré. |
| PUT | `/users/me/reference-week` | Remplace intégralement (body validé par `referenceWeekSchema`/DTO nestjs-zod, transaction `deleteMany`+`createMany`). |
| DELETE | `/users/me/reference-week` | Supprime toutes les lignes de l'utilisateur courant (`deleteMany`). Idempotent (pas d'erreur si déjà vide). |

Suivre exactement le pattern déjà en place pour `work-schedule` (`apps/api/src/users/users.service.ts`, `users.controller.ts`, `dto/work-schedule.dto.ts`) : DTO nestjs-zod dédié, tests unitaires + e2e couvrant au minimum le remplacement intégral, la suppression, et l'isolation multi-utilisateur (déjà le standard de ce repo, voir checklist étape 4).

**Validation supplémentaire côté service, au-delà du schéma Zod** : `PUT /users/me/reference-week` doit rejeter (400) toute entrée dont le `weekday` n'appartient pas au `WorkingDaySchedule` **actuel** de l'utilisateur — cohérent avec 5.1 ("elle ne couvre que les jours travaillés") et avec la nature 1-à-7-jours de `WorkingDaySchedule`. Concrètement : charger le `WorkingDaySchedule` de l'utilisateur dans le même service avant d'écrire, comparer l'ensemble des `weekday` du body à celui de `WorkingDaySchedule`, 400 si le body en contient un absent. Ça évite qu'une semaine de référence dérive silencieusement d'une config de semaine de travail obsolète dès l'écriture (voir aussi §7, la dérive *a posteriori* si `WorkingDaySchedule` change après-coup reste une limite assumée, non résolue ici).

### 5.5 Popup "Enregistrer comme semaine de référence ?"

- **Déclencheur** : juste après un enregistrement de jour (`PUT /time-entries/:date` réussi) qui fait que **tous les jours travaillés de la semaine actuellement affichée dans le carousel** (bornes `getWeekRange(selectedDate, weekStartDay)`, jours filtrés par `WorkingDaySchedule`) ont désormais une saisie. "Semaine complète" = ce critère exact, pas un simple nombre de jours saisis.
- **Contenu** : `Modal`/confirmation réutilisant `apps/web/src/components/ui/Modal.tsx` (même socle que `WorkScheduleModal`/`ProfileModal`) avec deux actions "Oui, enregistrer" / "Non merci". Si une semaine de référence existe déjà, adapter le texte pour prévenir qu'elle sera remplacée (`GET /users/me/reference-week` → `exists`).
- **Oui** → `PUT /users/me/reference-week` avec, pour chaque jour travaillé de la semaine affichée, ses heures actuelles converties en minutes du jour (même transformation heure murale que les DatePicker front, cf. convention UTC déjà documentée dans `DayForm.tsx`).
- **Non / fermeture** → ne pas rappeler ce popup pour cette même semaine tant qu'elle reste complète et inchangée. Pas de champ persistant prévu pour ça : mémoriser côté front (`localStorage`, clé du type `referenceWeekPrompt:{userId}:{weekStartIso}`) pour éviter de re-solliciter à chaque rechargement de page. Si l'utilisateur modifie ensuite un jour de cette semaine (donc elle redevient "en cours" puis re-complète), le popup peut se redéclencher normalement.
- Construire ce popup comme un composant de confirmation générique réutilisable au-dessus de `Modal.tsx` (ex. `ConfirmDialog.tsx`, props `title`/`description`/`confirmLabel`/`cancelLabel`/`onConfirm`) — il sert aussi à la confirmation de suppression du point 5.6, éviter de dupliquer deux fois la même mécanique Oui/Non.

### 5.6 Menu utilisateur — suppression de la semaine de référence

Dans `apps/web/src/components/Header.tsx`, ajouter un item dans le `Menu` avatar (après "Ma semaine de travail", avant "Déconnexion" ou dans un groupe séparé par un `MenuSeparator` supplémentaire) : **"Supprimer la semaine de référence"**.

- Visible uniquement si une semaine de référence existe (`GET /users/me/reference-week` → `exists: true`) — le masquer plutôt que le désactiver s'il n'y en a pas, pour rester cohérent avec le principe "une seule semaine de référence, qui peut ne pas exister" plutôt que d'exposer une action sans effet.
- Au clic → `ConfirmDialog` (5.5) de confirmation → `DELETE /users/me/reference-week` → rafraîchir l'état `exists` (et masquer l'item).
- `Header.tsx` ne fait aujourd'hui aucun fetch de données domaine (seulement `useAuth()`) — ajouter le fetch de l'état `exists` de la semaine de référence au montage (même pattern fetch-once que `TimeEntryPage`/`WorkScheduleModal`), et l'exposer aussi à `WeekCarousel` (point 5.7) pour piloter l'affichage du switch — voir 5.7 pour la question de propriété de cet état.

### 5.7 Switch "utiliser la semaine de référence" sur le premier jour

- Sur la **card du `weekStartDay`** dans `WeekCarousel` (le premier jour configuré de la semaine de l'utilisateur, pas nécessairement la première card affichée si le carousel est repositionné sur un autre jour) : afficher un `ToggleButton` (composant Primitive déjà présent, `apps/web/src/components/ui/togglebutton.tsx`, déjà utilisé comme sélecteur 35/37/40 dans `WorkScheduleModal` — ici utilisé seul, en guise de switch on/off) intitulé "Utiliser la semaine de référence pour toute la semaine", **visible uniquement si une semaine de référence existe** (même état `exists` que 5.6).
- **Activation (OFF → ON)** : préremplit, pour chaque jour travaillé de la semaine actuellement affichée dans le carousel **qui n'a pas déjà de saisie enregistrée**, les 4 champs de sa card avec les valeurs correspondantes de la semaine de référence (par `weekday`) — décision figée pour éviter toute ambiguïté : **ne jamais écraser une saisie déjà enregistrée**, pour ne pas risquer une perte de données silencieuse. Les jours non travaillés (pas de `WorkingDaySchedule`) restent inchangés (pas de ligne de référence pour eux de toute façon, cf. 5.1).
- Le préremplissage renseigne les champs des formulaires (état React Hook Form de chaque `DayCard`), il **n'enregistre rien automatiquement** — l'utilisateur valide toujours chaque jour via le bouton Enregistrer existant de sa card, comme pour une saisie manuelle.
- **Désactivation (ON → OFF)** : n'annule pas ce qui a déjà été préremplli/enregistré — c'est une action ponctuelle de préremplissage, pas un binding permanent vers la semaine de référence. Le switch peut donc revenir visuellement à OFF après action, ou rester ON jusqu'à navigation vers une autre semaine (au choix du `senior-developer`, ce point n'a pas d'impact fonctionnel).

---

## 6. Sélecteur de langue — `SelectButton`

**Fichier** : `apps/web/src/components/Header.tsx`, l. 109-131 — le sélecteur de langue (FR/EN) utilise actuellement le `Select` Primitive (`src/components/ui/select.tsx`, dropdown).

**Fix** : remplacer par le composant que l'utilisateur appelle `SelectButton` — nom v10, renommé **`ToggleButtonGroup`** en v11 (voir `.claude/skills/primereact` §3, même renommage déjà exploité dans ce repo pour le raccourci 35/37/40 de `WorkScheduleModal`, spec d'origine §5.5). **Aucun nouveau composant à tirer via shadcn** : `apps/web/src/components/ui/togglebuttongroup.tsx` existe déjà dans ce repo, l'utiliser tel quel comme socle (`ToggleButtonGroup` + `ToggleButton`/options, même pattern que dans `WorkScheduleModal.tsx` l. 446-466).

- Deux options FR/EN (mêmes `LANGUAGE_OPTIONS` déjà définies en tête de `Header.tsx`, l. 35-38 — valeur = code langue, libellé = `"FR"`/`"EN"`, inchangés).
- Comportement conservé à l'identique : sélection → `i18n.changeLanguage(value)`, valeur active dérivée de `i18n.language`.
- Retirer l'import du `Select` seulement pour cet usage précis — le sélecteur de jour de début de semaine (`WorkScheduleModal`) et tout autre usage de `Select` dans l'app restent inchangés, ce point ne concerne que le header.

---

## 7. Bug — padding du contenu des modales

**Cause racine identifiée** : `apps/web/src/components/ui/dialog.tsx` utilise les classes Tailwind `p-4.5` (`DialogHeader`, l. 111), `px-4.5 pb-4.5` (`DialogContent`, l. 99) et `pt-0 px-4.5 pb-4.5` (`DialogFooter`, l. 144) — mais `4.5` **n'existe pas** dans l'échelle d'espacement par défaut de Tailwind v3 (`apps/web/package.json` : `tailwindcss@^3.4.19`), qui saute de `4` à `5`. Une classe référençant une clé d'échelle inexistante ne génère **aucune règle CSS** (JIT Tailwind v3) — ces classes sont donc des no-ops silencieux depuis leur création, et le contenu de **toutes** les modales (`Modal.tsx`, donc `WorkScheduleModal`, `ProfileModal`, et tout ce qui en découle dans ce lot — `ConfirmDialog`, §5.5/§5.6) colle réellement aux bords, exactement le même type de bug déjà rencontré une fois dans ce repo avec la palette `surface` incomplète (voir `prompts/plan-checklist/rushhours-implementation-plan.md`, entrée "Trouvé et corrigé avant la 1ère review... palette Tailwind `surface`").

Un `grep` rapide montre que **`4.5` n'est pas un cas isolé** : `apps/web/src/components/ui/checkbox.tsx` (`size-4.5`) et `apps/web/src/components/ui/avatar.tsx` (`size-10.5`) utilisent le même genre de clé hors-échelle, avec le même effet silencieux (case à cocher et avatar rendus à une taille par défaut du navigateur/inattendue plutôt que la taille prévue par le design shadcn-généré).

**Fix (root cause, pas un patch au cas par cas)** : suivre le même principe déjà appliqué pour `surface` — étendre `theme.extend.spacing` dans `apps/web/tailwind.config.js` avec les clés manquantes réellement utilisées dans `src/components/ui/` (`4.5: "1.125rem"`, `10.5: "2.625rem"` — valeurs cohérentes avec la progression `0.25rem` par unité de l'échelle Tailwind par défaut), plutôt que de réécrire chaque classe `*-4.5`/`*-10.5` individuellement. Ce fix corrige en une fois le padding des modales **et**, en bonus vérifiable, la taille des checkboxes et de l'avatar — le signaler explicitement dans le rapport final (ce n'est pas du hors-scope, c'est la même cause racine).

Après le fix, vérifier visuellement (navigateur) qu'au moins une modale existante (`WorkScheduleModal` ou `ProfileModal`) a désormais un espacement interne cohérent entre son contenu et ses bords, header et footer compris.

---

## 8. i18n

Ajouter au minimum ces clés dans `apps/web/src/i18n/locales/{fr,en}.json`, groupe `timeEntry.*` existant (et un nouveau groupe `referenceWeek.*`) :

- `timeEntry.timePlaceholder` (§2)
- `timeEntry.hourGridLabel` / libellés d'accessibilité de la grille d'heures (§4.2)
- `referenceWeek.saveTitle`, `referenceWeek.saveDescription`, `referenceWeek.saveConfirm`, `referenceWeek.saveDecline` (§5.5)
- `referenceWeek.useSwitchLabel` (§5.7)
- `header.deleteReferenceWeek`, `referenceWeek.deleteConfirmTitle`, `referenceWeek.deleteConfirmDescription` (§5.6)

Pas de nouvelle clé nécessaire pour §6 (sélecteur de langue) : `LANGUAGE_OPTIONS` garde ses libellés `"FR"`/`"EN"` non traduits, comme aujourd'hui.

---

## 9. Limites assumées pour ce lot (à documenter, ne pas tenter de résoudre)

- Comme pour `WorkingDaySchedule` (spec d'origine §9), la semaine de référence n'est pas historisée : si la configuration "jours travaillés" change ensuite (après l'enregistrement de la semaine de référence), une semaine de référence peut contenir des jours qui ne sont plus travaillés (elle reste utilisable telle quelle, simplement ignorée pour ces jours-là au moment du préremplissage) — la validation du §5.4 n'empêche que la dérive *à l'écriture*, pas *a posteriori*.
- Pas de multi-semaines de référence (ex. "semaine haute"/"semaine basse" en alternance) — hors scope, une seule par utilisateur comme demandé.
- Le popup de proposition (§5.5) ne se déclenche que sur un enregistrement qui complète la semaine à l'instant T ; il ne rescanne pas rétroactivement les semaines déjà complètes plus anciennes à l'ouverture de l'app.

---

## 10. Plan d'implémentation suggéré (ordre pour l'agent)

1. **Front — bug padding modales** (§7) et **bug placeholder heure** (§2) : deux correctifs rapides et indépendants du reste, à traiter en premier.
2. **Prisma** : `ReferenceWeekEntry` (§5.2), migration, pas de changement de seed nécessaire (justifié §5.2).
3. **`packages/domain`** : `reference-week.schema.ts` (§5.3), tests unitaires (spec-as-test, cas limites minutes hors bornes / pause hors 12h-14h / doublon de weekday).
4. **API** : endpoints `reference-week` dans le module `users` existant (§5.4), y compris la validation "weekday ⊆ WorkingDaySchedule actuel", tests unitaires + e2e.
5. **Front — `DayCard`/`WeekCarousel`** (§3) : extraction de `DayForm` → `DayCard`, nouveau `WeekCarousel`, remontée du date-picker de sélection de jour dans `TimeEntryPage`. Vérifier manuellement en navigateur que la synchronisation carousel ↔ calendrier mensuel ↔ input calendrier reste cohérente dans les deux sens.
6. **Front — grille d'heures en popover** (§4.2), après investigation de l'API `useDatePickerContext()` (ou repli sur l'implémentation au niveau `DayCard`, voir §4.2 point 2).
7. **Front — semaine de référence** : `src/api/reference-week.ts`, `ConfirmDialog.tsx` générique, popup de proposition (§5.5), item de menu + confirmation de suppression (§5.6), switch de préremplissage (§5.7).
8. **Front — sélecteur de langue** (§6), indépendant du reste, peut être fait à tout moment.
9. **i18n** : clés du §8, FR + EN.
10. **Qualité** : `npm run lint`/`npm run build`/`npm run test` verts sur les trois workspaces (`domain`, `api`, `web`), comme à chaque lot précédent.
11. **Vérification manuelle bout en bout** : padding des modales et sélecteur de langue visuellement corrects ; saisir une semaine complète (avec un utilisateur configuré sur moins de 7 jours travaillés, pour vérifier que la définition 1-7 jours de §5.1 est bien respectée) ; accepter la proposition de semaine de référence ; changer de semaine ; activer le switch de préremplissage sur le jour de début de semaine ; vérifier le non-écrasement des jours déjà saisis ; supprimer la semaine de référence depuis le menu utilisateur et vérifier que le switch/l'item de menu disparaissent en conséquence.
