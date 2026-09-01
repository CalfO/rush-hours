# Mise en place de skills & d'une équipe de subagents (NestJS / React / Prisma)

> Ce document est un prompt d'implémentation destiné à un agent Claude Code.
> Objectif : équiper ce dépôt (`rush-hours`) de deux choses complémentaires :
> 1. Des **skills** Claude Code qui encodent les bonnes pratiques de la communauté pour NestJS, React et Prisma, adaptées au code réel de ce monorepo (voir `CLAUDE.md` à la racine pour les conventions déjà en vigueur).
> 2. Une **équipe de subagents projet** (orchestrateur, architecte, développeur senior, dev-testeur, reviewer) qui s'appuie sur ces skills pour mener l'implémentation de features de bout en bout selon un protocole de collaboration défini (§4).
> Ce travail est indépendant de la spécification fonctionnelle RushHours (`prompts/spec/rushhours-full-spec.md`) : il prépare l'outillage qui servira ensuite à implémenter et réviser cette spec dans les règles de l'art. Ne pas implémenter les fonctionnalités RushHours dans le cadre de ce prompt.

---

## 0. Avant de commencer : vérifier le format actuel des skills/subagents Claude Code

Le format exact des fichiers `SKILL.md` et des définitions de subagents peut évoluer. **Ne pas se fier uniquement à sa mémoire** : avant d'écrire le moindre fichier, confirmer le format courant en consultant l'agent `claude-code-guide` (disponible dans cet environnement) ou la documentation officielle (docs.claude.com, section Claude Code / Agent Skills / Subagents).

Points à vérifier explicitement :
- Emplacement attendu des skills projet (`.claude/skills/<nom>/SKILL.md` à la racine, et le mécanisme de **skills scopés à un répertoire** — ex. un skill posé sous `apps/web/.claude/skills/...` ou `apps/api/.claude/skills/...` n'est proposé que quand le fichier en cours de travail est dans ce sous-arbre).
- Champs de frontmatter obligatoires/recommandés d'un `SKILL.md` (`name`, `description`, éventuellement `argument-hint`, etc.) et convention de description (une phrase déclenchante claire, orientée "quand l'utiliser").
- Emplacement et format des subagents projet (`.claude/agents/<nom>.md`), frontmatter (`name`, `description`, `tools`, `model` éventuel).
- Bonnes pratiques de taille : garder `SKILL.md` concis (les gros contenus de référence vont dans un sous-dossier `references/` chargé à la demande, les scripts exécutables dans `scripts/`).

Si le format constaté diverge de ce que ce document suppose plus bas, **suivre le format réel** plutôt que ce document.

---

## 1. Sources à récupérer

### 1.1 NestJS

Dépôt de référence : https://github.com/Kadajett/agent-nestjs-skills/tree/main/skills/nestjs-best-practices

- Lister le contenu du dossier via l'API GitHub : `https://api.github.com/repos/Kadajett/agent-nestjs-skills/contents/skills/nestjs-best-practices`
- Récupérer le contenu brut de chaque fichier trouvé (SKILL.md + éventuels fichiers de référence) via `https://raw.githubusercontent.com/Kadajett/agent-nestjs-skills/main/skills/nestjs-best-practices/<fichier>`
- Lire l'intégralité avant de synthétiser — ne pas s'arrêter au seul `SKILL.md` si des fichiers de référence existent à côté.

### 1.2 React

Dépôt de référence : https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

- Même démarche : lister via `https://api.github.com/repos/vercel-labs/agent-skills/contents/skills/react-best-practices`, puis récupérer chaque fichier via `https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/<fichier>`.

### 1.3 Prisma

Aucun dépôt n'a été fourni pour Prisma. Rechercher activement :
- La documentation officielle Prisma (guides "best practices", "production checklist", gestion des migrations, transactions, N+1, pooling de connexions) sur `prisma.io/docs`.
- D'éventuels dépôts communautaires équivalents aux deux ci-dessus (recherche GitHub type `"prisma-best-practices" skill` ou `agent-skills prisma`), pour voir si un skill packagé existe déjà et suivre le même niveau d'exigence/format que les sources NestJS/React.
- Synthétiser une base solide même en l'absence d'un unique dépôt de référence : schéma (naming, index, relations), migrations (`prisma migrate dev` vs `deploy`, ne jamais éditer une migration déjà appliquée en prod), requêtes (`select`/`include` explicites, éviter le N+1, `$transaction`), `PrismaClient` (instance unique partagée — déjà en place ici via `PrismaService`/`PrismaModule`, voir §2.3), tests (mock vs base de test dédiée).

---

## 2. Adapter, ne pas recopier

Les trois sources ci-dessus sont génériques. Le livrable doit être **spécifique à ce dépôt** : reformuler les principes retenus en les ancrant dans les fichiers et conventions réels du projet, notamment :

### 2.1 Conventions déjà actées (voir `CLAUDE.md`)

- `apps/web` : React 18 + Vite, **JS/JSX pur, pas de TypeScript**. Le skill React ne doit donc jamais recommander de motifs spécifiquement TS (types, interfaces) — adapter en JSDoc si la source en parle.
- `apps/api` : NestJS + Prisma + TypeScript. `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) encapsule `PrismaClient` dans un provider Nest (`onModuleInit`/`onModuleDestroy`), `PrismaModule` est `@Global()`. Toute recommandation Prisma générique ("instancier un singleton PrismaClient") doit pointer vers ce pattern existant plutôt que d'en proposer un autre.
- Organisation Nest : un module par feature sous `apps/api/src/` (convention déjà énoncée dans `CLAUDE.md`, à respecter/renforcer dans le skill NestJS).
- Le dépôt va prochainement adopter (voir `prompts/spec/rushhours-full-spec.md`) : Zod, `nestjs-zod`, PrimeReact en mode unstyled + Tailwind, `react-hook-form`, `react-router`, `react-i18next`, `nestjs-pino`, WebAuthn. Le skill React et le skill NestJS doivent intégrer des recommandations compatibles avec cette direction (ex. validation via Zod plutôt que `class-validator`, structure de dossiers `src/pages`/`src/components`/`src/api` côté web) sans pour autant dupliquer le contenu de la spec fonctionnelle — un simple renvoi (`voir prompts/spec/rushhours-full-spec.md`) suffit là où c'est pertinent.

### 2.2 Portée (scoping)

Poser les skills NestJS et Prisma comme **scopés à `apps/api`**, et le skill React comme **scopé à `apps/web`** (selon le mécanisme confirmé en §0), pour qu'ils ne se proposent que sur le code concerné. Si le mécanisme de scoping par dossier n'existe pas ou fonctionne différemment de ce qui est supposé ici, les poser à la racine (`.claude/skills/`) avec une `description` qui mentionne explicitement le sous-dossier concerné (`apps/api/**`, `apps/web/**`) pour limiter les déclenchements hors-sujet.

---

## 3. Livrables attendus

### 3.1 Skills

- `nestjs-best-practices` — checklist/guidance condensée (architecture modulaire, DI, DTO/validation, gestion des erreurs/exceptions Nest, tests unitaires + e2e avec Supertest déjà en place dans `apps/api`, conventions de nommage) ancrée sur les fichiers réels du projet.
- `react-best-practices` — idem côté React 18/Vite/JSX (structure des composants, hooks, gestion d'état locale vs partagée, accessibilité, perf de rendu, tests Vitest déjà en place).
- `prisma-best-practices` — schéma, migrations, requêtes, transactions, intégration avec `PrismaService`/`PrismaModule` existants.

Chaque `SKILL.md` doit avoir une `description` qui donne à Claude Code un signal de déclenchement net (ex. "À charger avant toute modification de code dans `apps/api/src/**` touchant un module NestJS") plutôt qu'un intitulé générique.

### 3.2 Subagents

Un subagent de revue par techno, invocable explicitement pour auditer du code écrit par une session (pas seulement du contenu passif comme un skill) :

- `nestjs-reviewer` — relit un diff/fichier NestJS et signale les écarts par rapport au skill `nestjs-best-practices`.
- `react-reviewer` — idem pour `apps/web`.
- `prisma-reviewer` — relit le schéma/les requêtes Prisma.

Chaque subagent doit **charger/référencer le skill correspondant** plutôt que dupliquer son contenu dans le prompt du subagent (éviter la divergence entre les deux). Outils : lecture/recherche uniquement (`Read`, `Grep`/recherche, pas d'édition) sauf si l'utilisateur qui invoquera ces subagents plus tard souhaite explicitement un mode "fix" — dans ce cas, prévoir une variante ou un paramètre plutôt que de donner par défaut un accès en écriture à un agent de revue.

---

## 4. Équipe de subagents projet (orchestrateur, architecte, développeur senior, dev-testeur, reviewer)

En plus des skills, mettre en place une équipe de subagents dédiée à ce dépôt, avec un protocole de collaboration explicite — ce n'est pas juste "5 agents indépendants", c'est un pipeline où chacun a une responsabilité et un ordre d'intervention précis.

### 4.0 Principe : ne pas activer le pipeline pour tout

Ce protocole complet (architecte → développeur → dev-testeur → reviewer) est prévu pour une **feature ou un changement significatif**. Pour une question, un correctif mineur ou une exploration, l'orchestrateur répond/agit directement sans mobiliser toute l'équipe — cf. le principe déjà en vigueur dans ce projet de ne pas sur-déléguer à des subagents quand ce n'est pas nécessaire. Documenter ce garde-fou explicitement dans les instructions de l'orchestrateur.

### 4.1 Orchestrateur — principal interlocuteur

Rôle : point d'entrée unique de toutes les demandes ; décide si le pipeline complet est nécessaire (§4.0) ; sait précisément comment les quatre autres agents interagissent (protocole détaillé ci-dessous) ; relance/arbitre en cas d'itération (ex. reviewer bloquant → retour au développeur senior).

**Décision d'implémentation à trancher par l'agent qui exécute ce prompt, après vérification via `claude-code-guide`/doc officielle (même esprit que §0)** : dans ce harness, la session Claude Code de premier niveau (celle avec qui l'utilisateur discute directement) joue déjà nativement le rôle d'interlocuteur principal et peut invoquer des subagents via l'outil d'agent. Créer un *subagent* nommé "orchestrateur" serait redondant (un subagent ne peut pas être "le principal interlocuteur" — ses réponses ne sont pas montrées directement à l'utilisateur). La recommandation par défaut est donc :
- **Ne pas créer de subagent orchestrateur.** Encoder le rôle d'orchestrateur comme des **instructions projet toujours actives** pour la session principale (ajout dans `CLAUDE.md`, ou skill projet systématiquement pertinent) décrivant le protocole du §4.2 ci-dessous.
- Si la vérification en §0 révèle un mécanisme plus adapté (ex. un skill "toujours chargé" dédié au workflow d'équipe), l'utiliser à la place, mais garder le principe : c'est la session principale qui orchestre, pas un subagent de plus.

### 4.2 Protocole d'interaction entre agents (à documenter dans les instructions de l'orchestrateur)

Pour une feature/changement significatif :

1. **Architecte** (appel synchrone/foreground — l'étape suivante dépend de sa réponse) : reçoit la demande + l'extrait de spec fonctionnelle concerné, et produit une décision de structuration : quels modules/dossiers créer ou étendre, où ranger le nouveau code, cohérence avec l'existant (`CLAUDE.md`, skills §3.1). Ne code pas.
2. **Développeur senior** (foreground ou background selon l'ampleur) : reçoit la demande + la décision de l'architecte, implémente en appliquant les skills bonnes pratiques pertinentes (§3.1). Si un point de la décision de l'architecte est ambigu ou s'avère intenable une fois dans le code, il ne tranche pas seul : il remonte la question à l'orchestrateur, qui **rappelle l'architecte** avec cette question précise avant de laisser le développeur reprendre. (L'orchestrateur joue le rôle de relais entre les deux plutôt que de supposer un dialogue direct agent-à-agent en temps réel, qui n'est pas le mode de fonctionnement par défaut de ce harness — un subagent one-shot ne peut pas être "recontacté" sauf s'il a été lancé en arrière-plan et est toujours actif.)
3. **Dev-testeur** : une fois l'implémentation posée, reçoit le(s) extrait(s) de spec fonctionnelle concernés (pas seulement le code) + les fichiers modifiés/créés, et rédige les tests en **spec-as-test** (§4.4). Ne modifie pas le code de production.
4. **Reviewer** : reçoit le diff complet (code de production + tests) et relit selon §4.5. Si des points bloquants sont soulevés, l'orchestrateur relance le développeur senior (et/ou le dev-testeur si le problème concerne les tests) avec les retours du reviewer, puis fait rerelire — jusqu'à ce que ce soit propre ou que l'utilisateur tranche.
5. L'orchestrateur restitue à l'utilisateur un résumé de ce qui a été fait, en citant les points d'attention remontés par le reviewer et la façon dont ils ont été traités.

### 4.3 Architecte

- Rôle : garant de l'architecture et de l'organisation du dépôt — décide où va le nouveau code (nouveau module Nest vs extension d'un module existant, nouveau dossier `src/pages`/`src/components` côté web, etc.), en cohérence avec `CLAUDE.md` et les skills §3.1.
- Outils : lecture/recherche seulement (pas d'édition) — son livrable est une décision/plan de structuration, pas du code.
- Doit consulter les skills `nestjs-best-practices`/`react-best-practices`/`prisma-best-practices` avant de trancher, pour que ses décisions restent alignées avec les conventions déjà codifiées.

### 4.4 Développeur senior

- Rôle : implémente le code de production en appliquant scrupuleusement les bonnes pratiques (charge le/les skill(s) pertinent(s) selon la zone du dépôt touchée, §2.2), suit la décision de l'architecte (§4.2 étape 1).
- Outils : lecture/écriture complètes (`Read`, `Edit`, `Write`, `Bash` pour lancer build/lint/tests locaux pendant le développement).

### 4.5 Dev-testeur — spec-as-test

- Rôle : produit **tous** les tests associés à un développement, en partant de la spécification fonctionnelle plutôt que de l'implémentation. L'objectif "spec-as-test" : chaque exigence identifiable de la spec (ex. dans `prompts/spec/rushhours-full-spec.md` : "un jour sans saisie est neutre et n'entre dans aucun cumul", "la pause déjeuner doit être comprise entre 12h et 14h") doit se retrouver traduite en un test qui échouerait si le comportement décrit était cassé — pas un test qui se contente de figer l'implémentation actuelle.
- Niveau de test à privilégier : suffisamment haut niveau pour que le test représente la feature côté utilisateur/métier (tests e2e Supertest pour l'API — `apps/api` a déjà `test:e2e` en place —, tests de comportement React Testing Library côté web), complétés par des tests unitaires ciblés uniquement là où la logique pure le justifie (ex. le module de calcul de balance du §4 de la spec RushHours, avec des cas limites explicitement issus du texte de la spec).
- Doit produire, en plus des fichiers de test, une courte note de traçabilité (quelle exigence de la spec → quel(s) test(s)) pour que le reviewer et l'orchestrateur puissent vérifier la couverture sans relire tout le code.
- Outils : lecture/écriture, mais **restreinte dans les faits aux fichiers de test** (ne modifie pas le code de production) — à formuler explicitement dans les instructions de l'agent puisque les permissions d'outils seules (`Edit`/`Write`) ne distinguent pas test vs production.

### 4.6 Reviewer

- Rôle : relit tout le code produit par le développeur senior et le dev-testeur avant qu'il soit considéré terminé — conformité aux skills bonnes pratiques (§3.1), cohérence avec la décision de l'architecte, correction fonctionnelle, et vérification que les tests du dev-testeur couvrent réellement la spec (pas seulement l'implémentation).
- Outils : lecture/recherche + exécution (`Bash` pour lancer lint/tests/build afin de vérifier, pas seulement lire le code statiquement), pas d'édition par défaut — cohérent avec le choix déjà fait au §3.2 pour les reviewers techniques.
- **Articulation avec le skill `code-review` déjà fourni par Claude Code** (visible dans cet environnement) et avec les subagents `nestjs-reviewer`/`react-reviewer`/`prisma-reviewer` du §3.2 : ne pas dupliquer ces mécanismes. Le reviewer de l'équipe doit s'appuyer dessus (les invoquer ou en réutiliser la logique/skill sous-jacente) plutôt que ré-écrire une checklist de revue générique from scratch. Si l'agent qui exécute ce prompt juge plus simple de fusionner les 3 reviewers techniques du §3.2 dans ce reviewer d'équipe unique (qui chargerait alors le skill technique pertinent selon les fichiers du diff), c'est une simplification acceptable — documenter le choix fait.

---

## 5. Plan d'exécution suggéré

1. Confirmer le format skills/subagents courant (§0).
2. Récupérer et lire intégralement les sources NestJS et React (§1.1, §1.2).
3. Rechercher et synthétiser les bonnes pratiques Prisma (§1.3).
4. Rédiger les trois `SKILL.md` (§3.1), scopés comme indiqué (§2.2), en s'appuyant sur les fichiers réels du projet cités en §2.1 — inclure des exemples tirés du code existant plutôt que des exemples génériques copiés des sources.
5. Rédiger les subagents de revue technique (§3.2), ou les fusionner dans le reviewer d'équipe (§4.6) selon l'arbitrage retenu.
6. Rédiger les instructions d'orchestration (§4.1/§4.2) à l'emplacement retenu (probablement `CLAUDE.md` ou skill toujours actif).
7. Rédiger les subagents architecte, développeur senior, dev-testeur, reviewer (§4.3–§4.6).
8. Relire l'ensemble pour vérifier qu'aucun contenu ne contredit `CLAUDE.md` ni `prompts/spec/rushhours-full-spec.md` (ex. ne pas réintroduire TypeScript côté web, ne pas proposer un pattern Prisma concurrent de `PrismaService`).
9. Test à blanc du protocole sur un cas simple (ex. une petite feature de la spec RushHours) pour vérifier que le relais orchestrateur ↔ architecte ↔ développeur ↔ dev-testeur ↔ reviewer fonctionne bien tel que documenté, avant de l'utiliser pour l'implémentation complète de la spec.
10. Résumer en fin de tâche : fichiers créés, sources effectivement consultées, arbitrages pris (notamment sur l'orchestrateur et la fusion éventuelle des reviewers).
