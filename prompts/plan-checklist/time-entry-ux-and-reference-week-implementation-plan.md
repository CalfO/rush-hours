# RushHours — Plan & état d'avancement : carousel de jours, saisie d'heure, semaine de référence

> Source de vérité de progression pour l'implémentation de `prompts/spec/time-entry-ux-and-reference-week.md`. Maintenu par l'orchestrateur via le skill `.claude/skills/plan-checklist/SKILL.md`, mis à jour après chaque étape de la pipeline `architect` → `senior-developer` → `dev-tester` → `reviewer` décrite dans `CLAUDE.md`. Initiative distincte de `rushhours-implementation-plan.md` (spec d'origine, déjà entièrement livrée).

## Comment l'utiliser

- **Avant de reprendre le travail** (nouvelle session, VM perdue) : lire ce fichier en premier.
- Légende : ✅ fait & commité · 🟡 fait, pas encore commité · 🚧 en cours · ⬜ pas commencé · ❌ bloqué

## Décisions / déviations par rapport au spec figé

- **2026-08-28 — Découpage en lots.** Le spec liste 6 points fonctionnels ; regroupés en lots exécutables via la pipeline pour limiter le nombre d'allers-retours tout en gardant chaque lot testable indépendamment :
  - **Correctifs directs** (§2 placeholder, §7 padding modales) : traités par l'orchestrateur directement, hors pipeline complète (bugs ponctuels bien circonscrits, cf. précédent déjà acté dans `rushhours-implementation-plan.md` pour le bug `requireUserVerification`).
  - **Lot A — Backend semaine de référence** (§5.2-5.4) : Prisma `ReferenceWeekEntry`, `packages/domain/reference-week.schema.ts`, endpoints `GET/PUT/DELETE /users/me/reference-week`.
  - **Lot B — Front carousel & saisie d'heure** (§3, §4.2, §6) : `DayForm`→`DayCard`, `WeekCarousel`, remontée du date-picker dans `TimeEntryPage`, grille d'heures en popover, sélecteur de langue en `ToggleButtonGroup`.
  - **Lot C — Front semaine de référence** (§5.5-5.7) : dépend du Lot A (API) et du Lot B (`WeekCarousel` existant) — `src/api/reference-week.ts`, `ConfirmDialog`, popup de proposition, item de menu suppression, switch de préremplissage.

## Checklist (ordre du §10 du spec, regroupé en lots ci-dessus)

1. ✅ **Correctifs directs** — placeholder heure (§2) + bug padding modales (§7, `tailwind.config.js` spacing scale). Commit `25c7d29`. Vérifié : CSS buildé contient bien `.p-4\.5{padding:1.125rem}`/`.px-4\.5{...}`, 80 tests web verts, lint/build propres.
2. ✅ **Lot A — Prisma** — `ReferenceWeekEntry` (§5.2), migration `20260828192440_add_reference_week_entry`.
3. ✅ **Lot A — `packages/domain`** — `reference-week.schema.ts` (§5.3) + `reference-week.schema.spec.ts` (42 tests domain au total, tous verts).
4. ✅ **Lot A — API** — endpoints `reference-week` (§5.4) + validation weekday ⊆ WorkingDaySchedule (commit `eb620f3`) + 10 tests e2e (commit `9b2e8b5`). Review : 1 bloquant (lint `no-unsafe-member-access`) + 1 non-bloquant réel (race TOCTOU dans `replaceReferenceWeek`) — les deux corrigés (`dev-tester`/`senior-developer`), re-vérifiés indépendamment par l'orchestrateur : lint/build/test (44)/e2e (51) tous verts. **Lot A backend terminé.**
5. ✅ **Lot B — `DayCard`/`WeekCarousel`** (§3) — extraction `DayForm`→`DayCard`, `WeekCarousel.tsx` (Carousel PrimeReact réel), remontée du date-picker dans `TimeEntryPage`. Vérifié manuellement en navigateur (Postgres local + WebAuthn virtuel CDP) : carousel, calendrier, indicateurs, placeholder heure (§2) tous fonctionnels. Note : bannière "Invalid PrimeUI License" globale pré-existante (`PrimeReactProvider` sans clé, hors scope).
6. ✅ **Lot B — grille d'heures en popover** (§4.2) — 2 bugs réels trouvés en vérification manuelle et corrigés : (1) le popover ne s'ouvrait jamais (`PopoverTrigger asChild` sur `PRDatePicker.Hour`, qui ignore les props JSX fusionnées sauf `children`) ; (2) un pick dans la grille était silencieusement écrasé par un clic +/- suivant (bug d'ordonnancement dans le `useEffect([props.value])` de la lib headless — contourné par un second `onValueChange` en microtask). Les deux corrections vérifiées indépendamment par l'orchestrateur en navigateur (`09:30` pick → `+1` → `10:30`, correct).
7. ✅ **Lot B — sélecteur de langue** (§6) — `ToggleButtonGroup`, confirmé visuellement fonctionnel (FR/EN en boutons). Implémentation commitée `f3eb64a`, tests `dev-tester` commités `5da29df` (93 tests verts). **Review reçue : clean, 0 finding bloquant.** 3 notes non-bloquantes signalées (aria-label manquant sur le trigger de la grille d'heures, pas de cleanup sur le `setTimeout` de contournement, couverture de test du wiring réel du Carousel PrimeReact incomplète) — les deux premières corrigées directement par l'orchestrateur (aria-label + `useRef`/`clearTimeout`, tests ajustés en conséquence), 93 tests toujours verts. La 3e (couverture carousel) notée comme dette technique mineure, non traitée. **Lot B terminé.**
8. 🟡 **Lot C — semaine de référence front** — `src/api/reference-week.ts`, `ui/ConfirmDialog.tsx` (générique, réutilisé pour le popup §5.5 et la suppression §5.6), état `referenceWeek` remonté dans `AppLayout` (fetch-once + `refreshReferenceWeek`, exposé via `Outlet context` — évite la staleness entre `Header` et `TimeEntryPage`, deux siblings), détection de complétion de semaine dans `TimeEntryPage.handleSaved` (transition `wasComplete`→`isComplete`, flag localStorage `referenceWeekPrompt:{userId}:{weekStartIso}`, limite documentée pour une semaine à cheval sur deux mois — cf. §9), item de menu masqué dans `Header`, switch de préremplissage non-destructif dans `WeekCarousel`/`DayCard` (remount par clé, jamais d'écrasement). **Vérifié bout en bout par l'orchestrateur en navigateur** (compte à 5 jours travaillés, Postgres local + WebAuthn virtuel CDP) : popup déclenché exactement sur la saisie qui complète la semaine (pas avant), padding de la modale correct, item "Delete reference week" visible immédiatement après acceptation (sans reload), switch visible sur le lundi de la semaine suivante, préremplissage confirmé (`08:00` injecté depuis la semaine de référence). 93 tests web verts, lint/build clean. **Pas encore de dev-tester/reviewer** — prochaine étape.
9. 🟡 **i18n** — clés `referenceWeek.*`/`header.deleteReferenceWeek`/`common.*` ajoutées FR+EN dans le cadre du Lot C.
10. 🟡 **Qualité** — lint/build/test verts sur `web` (93 tests) et `api`/`domain` (inchangés depuis Lot A). Build `web` non re-testé après Lot C côté `npm run build` racine multi-workspace — à faire en fin d'initiative.
11. ⬜ **Vérification manuelle bout en bout** finale (tous lots combinés, une fois dev-tester/reviewer passés sur le Lot C).

## État git actuel

- Branche `feature/hours-input`, dernier commit poussé `c9736c7` ("fix(web): address Lot B review notes"). Lot C implémenté par `senior-developer` mais pas encore commité (en attente de dev-tester/reviewer).

## Prochaines étapes immédiates

1. Committer l'implémentation Lot C.
2. `dev-tester` sur le Lot C (spec-as-test §5.5/§5.6/§5.7).
3. `reviewer` sur le Lot C, corriger si besoin.
4. Vérification manuelle bout en bout finale, `npm run build`/`test`/`lint` racine sur les 3 workspaces.
3. `senior-developer` → `dev-tester` → `reviewer` sur le Lot A, commit.
4. Enchaîner sur le Lot B puis le Lot C.
