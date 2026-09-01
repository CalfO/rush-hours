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
8. ✅ **Lot C — semaine de référence front** — `src/api/reference-week.ts`, `ui/ConfirmDialog.tsx` (générique, réutilisé pour le popup §5.5 et la suppression §5.6), état `referenceWeek` remonté dans `AppLayout` (fetch-once + `refreshReferenceWeek`, exposé via `Outlet context`), détection de complétion de semaine dans `TimeEntryPage.handleSaved` (transition `wasComplete`→`isComplete`, flag localStorage, limite documentée semaine à cheval sur deux mois — cf. §9), item de menu masqué dans `Header`, switch de préremplissage non-destructif dans `WeekCarousel`/`DayCard`. Commit `8a0ea81`. **Vérifié bout en bout par l'orchestrateur en navigateur** (compte à 5 jours travaillés) : popup déclenché exactement sur la saisie complétant la semaine, item menu + switch apparaissent sans reload, préremplissage confirmé. `dev-tester` a ajouté 15 tests (transition du popup avec fixture 3-jours pour ne pas figer sur 5/7, propagation cross-sibling via `AppLayout` réel, non-écrasement du switch, masquage du menu) — 108 tests web verts, lint/build clean. **Pas encore de review reviewer** — prochaine étape.
9. ✅ **i18n** — clés `referenceWeek.*`/`header.deleteReferenceWeek`/`common.*` ajoutées FR+EN dans le cadre du Lot C.
10. ✅ **Qualité** — `npm run build`/`npm run test` racine (3 workspaces) + `npm run test:e2e --workspace api` tous verts après le fix du finding switch/dirty-state : 44 tests unitaires api + 51 e2e api + 42 tests domain + 109 tests web = **246 tests verts**, lint/build clean partout.
11. ✅ **Vérification manuelle bout en bout** — faite progressivement à chaque lot par l'orchestrateur en navigateur réel (Postgres local + WebAuthn virtuel CDP Playwright), pas en une passe finale isolée : placeholder heure, padding modales, carousel + calendrier + input calendrier synchronisés, popover heures/minutes +/-, grille d'heures 24 cases (2 bugs trouvés et corrigés), sélecteur de langue FR/EN, flux complet semaine de référence (popup de proposition déclenché exactement sur la saisie complétante, item menu + switch apparaissant sans reload, préremplissage sans écrasement) — tous confirmés fonctionnels en conditions réelles, pas seulement via les tests automatisés.

## Initiative terminée

Les 6 points fonctionnels du spec (placeholder, carousel, saisie d'heure simplifiée, semaine de référence, sélecteur de langue, padding modales) sont implémentés, testés et revus. 3 points de dette technique mineure acceptés (non bloquants, documentés dans "Review reçue (Lot C)" ci-dessus) — à traiter dans une future itération si besoin, pas avant. Spec déplacée vers `prompts/spec/done/` (convention déjà établie par ce repo pour `rushhours-full-spec.md`).

## État git actuel

- Branche `feature/hours-input`, dernier commit poussé `8a0ea81` ("feat(web): reference week save-prompt, deletion, prefill switch (Lot C)"). Tests `dev-tester` du Lot C implémentés, validés localement, pas encore commités.

## Review reçue (Lot C) — 0 finding bloquant, 1 corrigé, 3 dette technique acceptée

Le reviewer a re-vérifié indépendamment build/lint/test (108 tests confirmés), et tracé la conversion minutes du paiement PUT contre `reference-week.schema.ts` (compatible, puisque déjà validée par `timeEntrySchema` en amont dans `DayCard`).

- **✅ Corrigé et re-vérifié indépendamment** : activer le switch remontait (via changement de `key`) **toutes** les cards non-sauvegardées de la semaine simultanément — si l'utilisateur avait commencé à taper (sans enregistrer) dans une autre card que celle du switch, cette saisie était silencieusement perdue au remount. Fix : `DayCard` remonte son état "dirty" (`formState.isDirty`) via un nouveau prop `onDirtyChange`, `WeekCarousel` exclut les jours "touchés" du remount de préremplissage (garde la clé `iso` simple, pas de suffixe `:ref`) — une card en cours de saisie non sauvegardée n'est jamais écrasée. Régression prouvée par `dev-tester`-style aller-retour (test échoue sans le fix, passe avec). 109 tests web verts, lint/build clean.
- **⚠️ Dette technique acceptée, non corrigée** : `handleSaved`'s garde "dernière requête gagne" (héritée du Lot B) peut, dans une fenêtre de timing étroite (deux sauvegardes sur deux semaines différentes coup sur coup), abandonner l'évaluation de complétion d'une semaine sans réessai — le popup ne se déclenche alors jamais pour cette semaine-là.
- **⚠️ Dette technique acceptée, non corrigée** : le flag localStorage "déjà répondu" (refus) n'est jamais effacé — si la config `WorkingDaySchedule` change après un refus et fait redevenir la semaine incomplète puis à nouveau complète, le popup ne se redéclenche pas alors que le spec §5.5 (dernière phrase) le prévoit.
- **⚠️ Dette technique acceptée, non corrigée** : `AppLayout.refreshReferenceWeek` n'a pas de garde de séquencement de requêtes (contrairement au `refreshSequence` déjà établi ailleurs dans ce repo) — deux appels concurrents (accepter le popup + supprimer depuis le menu, coup sur coup) pourraient laisser gagner la réponse la plus ancienne. S'auto-corrige au prochain refresh explicite.

## Prochaines étapes immédiates

Aucune — initiative terminée (voir "Initiative terminée" ci-dessus). Reprendre uniquement si un des 3 points de dette technique acceptés doit être traité, ou pour une nouvelle évolution du spec.
