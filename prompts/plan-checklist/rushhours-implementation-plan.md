# RushHours — Plan & état d'avancement

> Source de vérité de progression pour l'implémentation de `prompts/spec/rushhours-full-spec.md`. Maintenu par l'orchestrateur via le skill `.claude/skills/plan-checklist/SKILL.md`, mis à jour après chaque étape de la pipeline `architect` → `senior-developer` → `dev-tester` → `reviewer` décrite dans `CLAUDE.md`.

## Comment l'utiliser

- **Avant de reprendre le travail** (nouvelle session, VM Codespace perdue) : lire ce fichier en premier. Pas besoin de rescanner tout le repo pour savoir où on en est.
- Légende : ✅ fait & commité · 🟡 fait, pas encore commité · 🚧 en cours · ⬜ pas commencé · ❌ bloqué

## Décisions / déviations par rapport au spec figé

- **2026-08-27 — TypeScript de bout en bout.** Le spec imposait initialement "pas de TypeScript côté web" (voir historique git de `prompts/spec/rushhours-full-spec.md`). L'utilisateur est revenu dessus explicitement en cours de session pour uniformiser tout le monorepo en TypeScript ("je veux une uniformité en utilisant du typescript de partout"). `CLAUDE.md`, le spec (intro + §2.1 + noms de fichiers futurs `.jsx`→`.tsx`), et `.claude/agents/architect.md`/`senior-developer.md` ont été mis à jour en conséquence.
- **2026-08-27 — `packages/domain`.** Nouveau workspace, pas prévu explicitement par le spec, introduit pour mutualiser les éléments explicitement dual-usage front+back : schémas Zod (§4.2 saisie journalière, §5.5/§6 semaine de travail, §5.4 profil) + `getWeekRange`/`getWeekdayForDate`/`Weekday` (§4.5, le spec l'appelle littéralement "utilitaire partagé"). TypeScript pur, compilé en **CommonJS** vers `dist/` (jamais ESM — évite le piège d'interop déjà rencontré une fois sur ce projet avec les deps WebAuthn), consommé à l'identique par `apps/api` et `apps/web` comme une dépendance npm normale. Build one-shot (pas de `tsc --watch`) intégré via des hooks `predev`/`prebuild`/`pretest` à la racine + `apps/api`/`apps/web` `prestart`. `balance.util.ts` (§4.1/§4.4) reste côté `apps/api/src/time-tracking/` : pas dual-usage, le front ne fait qu'afficher les totaux déjà calculés par l'API.

## Checklist (ordre du §10 du spec)

1. ✅ **Prisma** — schema complet (`User`, `WorkingDaySchedule`, `Credential`, `TimeEntry`, `WebauthnChallenge`), migrations, `seed.ts`, modèle `Hello` supprimé. Commit `7f6efba`.
2. ✅ **API — fondations** — `nestjs-pino`, `nestjs-zod`, `@simplewebauthn/server`, `@nestjs/jwt`, `cookie-parser`, `.env.example` (`WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`/`JWT_SECRET`). Commit `7f6efba`.
3. ✅ **API — module Auth** — endpoints WebAuthn complets (§5.2), `AuthGuard` global + `@Public()`. Review passée (2 findings bloquants corrigés : fuite du JWT de session dans les logs pino, lint des tests). Commit `7f6efba`.
4. ✅ **API — module Users** — `apps/api/src/users/` : `PATCH /users/me`, `GET`/`PUT /users/me/work-schedule` (transaction Prisma, remplacement intégral, pose `onboardingCompletedAt`). Implémenté + testé (e2e, isolation multi-utilisateur, remplacement intégral). **Commité (`04436c3`). ⚠️ Review pas encore reçue — voir "État git actuel" et "Prochaines étapes".**
5. ✅ **API — module TimeEntries** — `apps/api/src/time-entries/` : CRUD + `summary` + `analytics`, réutilise `balance.util.ts` (préexistant) + `getWeekRange` de `packages/domain`. Tests unitaires + e2e couvrant les cas limites du spec (jour non travaillé, jour travaillé sans saisie, pause hors 12h-14h, semaine à cheval sur deux mois, `weekStartDay` ≠ lundi). **Commité (`04436c3`). ⚠️ Review pas encore reçue.**
   - ✅ `packages/domain` créé dans la foulée (voir décisions ci-dessus) — **commité (`04436c3`)**, même statut review-pas-encore-reçue.
   - ✅ Migration TypeScript complète d'`apps/web` (étape "front — fondations" partielle, uniquement l'outillage, voir point 6) — **commité (`04436c3`)** dans le même commit, review pas encore reçue non plus.
6. ⬜ **Front — fondations** — Tailwind (tokens Material flat §2.1), setup PrimeReact Primitive via shadcn (`components.json`), react-router, react-i18next, structure de dossiers (`src/pages`, `src/components`, `src/components/ui`, `src/components/charts`, `src/api`, `src/i18n`). **Non commencé** — seule la coquille Vite par défaut a été migrée en TypeScript (`App.tsx`/`index.tsx`/`vite.config.ts`, ESLint + typecheck), aucune dépendance produit ni structure de dossiers du spec n'existe encore.
7. ⬜ **Front — Auth** — écran login passkey (`@simplewebauthn/browser`), garde de route, `AuthProvider` (`GET /auth/me` au démarrage).
8. ⬜ **Front — modal "Ma semaine de travail"** (§5.5), composant indépendant réutilisé ensuite à 2 endroits.
9. ⬜ **Front — Onboarding** (2 étapes, §5.4) + modal "Mon profil" des Paramètres.
10. ⬜ **Front — Header** sticky (nav, sélecteur de langue, avatar → Profil/Semaine de travail/Déconnexion).
11. ⬜ **Front — Vue Saisie** (`/`) — formulaire du jour, indicateurs jour/semaine, calendrier mensuel coloré aligné sur `weekStartDay`.
12. ⬜ **Front — Vue Analyses** (`/analytics`) — graphiques SVG/Tailwind faits main (§7.3, pas de lib de charting externe).
13. 🚧 **Qualité** — `apps/web` a maintenant son propre `lint`/`typecheck`, et un `prebuild` qui lance le typecheck. **Manque encore** : `apps/api` n'a pas de hook `prebuild: npm run lint` (demandé explicitement par le §8.2 du spec dans **chaque** workspace) ; `apps/web`'s `prebuild` ne lance que le typecheck, pas le lint — à compléter dans les deux. Pas de `.prettierrc` racine (accepté, la config par défaut suffit selon le spec).
14. ⬜ **Vérification manuelle bout en bout** dans le navigateur — bloquée tant que le front (étapes 6-12) n'existe pas.

## État git actuel

- Branche : `feature/hours-input`.
- Dernier commit : `04436c3 feat: add time-entries/users API on a shared domain package, migrate web to TSX` (au-dessus de `7f6efba`, fondations + Auth déjà review-validées). **Commité par l'utilisateur directement** (pas via le flow "review clean → commit" habituel de la pipeline — la review n'a donc pas encore eu lieu sur ce contenu).
- Working tree : propre (`git status` vide) au moment de la rédaction.
- Tout est implémenté et testé — 100 % vert sur `build`/`test`/`test:e2e`/`lint` des 3 workspaces (`@rushhours/domain`, `api`, `web`) d'après les rapports des agents d'implémentation (pas encore re-vérifié par un reviewer indépendant).

## Review reçue (commit `04436c3`) — 2 findings à corriger, rien de structurellement remis en cause

Le reviewer a rendu son verdict (build/test/lint/e2e re-vérifiés indépendamment par lui, y compris un rebuild propre `rm -rf */dist && npm run build` depuis la racine — tout passe). Détail complet dans la transcription de l'agent si besoin, résumé ici :

- **✅ `packages/domain`** : pas bloquant. UTC cohérent partout (time-entry.schema.ts / week-range.ts), transaction/refine Zod corrects, tests spec-as-test de bonne qualité.
- **⚠️ `apps/api/src/users` + `time-entries`** : 1 bug à corriger — **`PATCH /users/me` renvoie 500 (pas un 4xx propre) sur un email en doublon** (`apps/api/src/users/users.service.ts:19-37`, `prisma.user.update` sans try/catch sur la contrainte unique `email`, pas de filtre d'exception global dans l'app). Facilement atteignable : 2 comptes seedés (`user`/`admin`), l'un peut reprendre l'email de l'autre en onboarding. À corriger (mapper `P2002` → 409, ou au moins un `BadRequestException` propre). Tout le reste validé : transaction `replaceWorkSchedule` correcte, isolation multi-utilisateur réelle et testée, §4.4/§4.5 corrects et bien spec-as-testés. Nitpick non bloquant : `month`/`from,to`/`:date` ne valident que le format regex, pas la validité calendaire (`2026-02-30` accepté, roll-over silencieux) — POC-scope, pas de sécurité en jeu.
- **⚠️ Migration TS `apps/web`** : confirme le gap déjà noté dans ce fichier — **`apps/web`'s `prebuild` ne lance que `typecheck`, pas `lint`**, donc `npm run build --workspace web` ne peut pas échouer sur un lint error, contrairement à ce que demande le §8.2 du spec. `apps/api` n'a même pas de hook `prebuild` du tout (gap pré-existant, pas introduit par ce lot). Tout le reste clean : `strict: true` réellement respecté (zéro `any`/`@ts-ignore`/`@ts-expect-error` en dehors de `node_modules`), `vite-env.d.ts` correct et nécessaire, `defineConfig` de `vitest/config` fonctionne bien en pratique. Point à surveiller (pas bloquant maintenant, pas de code front réel encore) : `apps/web/eslint.config.mjs` utilise `tseslint.configs.recommended` alors qu'`apps/api` utilise `recommendedTypeChecked` (type-aware) — à aligner avant le lot Front Auth/Onboarding, où des handlers async WebAuthn/`fetch` vont apparaître et où `no-floating-promises` deviendrait utile.
- **✅ Ordre de build monorepo** : confirmé fiable sur un rebuild à froid complet.

## Prochaines étapes immédiates

1. Corriger le bug `PATCH /users/me` → 500 sur email en doublon (`apps/api/src/users/users.service.ts`) — via `senior-developer`, puis re-vérifier avec `dev-tester`/tests e2e.
2. Ajouter `prebuild: npm run lint` (ou `typecheck && lint`) sur `apps/web`, et un hook `prebuild: npm run lint` sur `apps/api` (actuellement absent) — §8.2 du spec.
3. Optionnel avant le lot front Auth/Onboarding : aligner `apps/web/eslint.config.mjs` sur `recommendedTypeChecked` comme `apps/api`.
4. Ces corrections partiront en commit(s) séparé(s) de `04436c3` (déjà poussé/committé), sauf si l'utilisateur demande explicitement un amend.
5. Une fois ces 2 findings corrigés (ou l'utilisateur décide de les traiter plus tard) : démarrer le lot **Front — fondations** (étape 6 de la checklist) via `architect` — préalable bloquant pour 7 à 12.
6. Enchaîner ensuite : Front Auth → WorkScheduleModal → Onboarding → Header → Vue Saisie → Vue Analyses.
7. Vérification manuelle bout en bout (étape 14) en toute fin de lot front.
