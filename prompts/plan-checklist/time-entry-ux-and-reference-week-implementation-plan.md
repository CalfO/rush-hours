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
7. ✅ **Lot B — sélecteur de langue** (§6) — `ToggleButtonGroup`, confirmé visuellement fonctionnel (FR/EN en boutons). Implémentation commitée `f3eb64a`. `dev-tester` a ajouté 13 tests (`DayCard.test.tsx`, `WeekCarousel.test.tsx`, extension `TimeEntryPage.test.tsx`) couvrant l'ordre `weekStartDay`, la navigation carousel sans boucle, le date-picker cross-semaine, et surtout une régression dédiée au bug pick-grille/stepper corrigé — 93 tests web verts. **Pas encore de review reviewer** — prochaine étape.
8. ⬜ **Lot C — semaine de référence front** — API client, `ConfirmDialog`, popup (§5.5), menu suppression (§5.6), switch (§5.7).
9. ⬜ **i18n** — clés du §8, FR + EN (au fil des lots B/C).
10. ⬜ **Qualité** — `npm run lint`/`build`/`test` verts sur les 3 workspaces.
11. ⬜ **Vérification manuelle bout en bout**.

## État git actuel

- Branche `feature/hours-input`, HEAD `405523f` ("chore: sync package-lock.json with @primereact/core dependency").
- Rien en cours au démarrage de cette initiative.

## Prochaines étapes immédiates

1. Correctifs directs (placeholder + padding modales).
2. Lancer `architect` sur le Lot A (backend semaine de référence).
3. `senior-developer` → `dev-tester` → `reviewer` sur le Lot A, commit.
4. Enchaîner sur le Lot B puis le Lot C.
