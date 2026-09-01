---
name: plan-checklist
description: Maintain the persistent implementation plan/checklist in prompts/plan-checklist/ for this repo. Use at the START of any session before resuming spec-driven implementation work — read the checklist first instead of rescanning the codebase, since the user works in an ephemeral GitHub Codespace VM and regularly loses session/environment state. Also use as the orchestrator whenever starting a feature-sized lot via the architect/senior-developer/dev-tester/reviewer pipeline (CLAUDE.md), and after each stage of that pipeline completes, to update status.
license: MIT
metadata:
  author: rush-hours
  version: "1.0.0"
---

# Plan checklist — orchestrator playbook

This repo's user frequently loses their Codespace VM and has no cheap way to tell where implementation work stands without re-reading a lot of code. `prompts/plan-checklist/` exists to make that a file read, not a repo scan. This skill governs how the orchestrator (you, the top-level session — see `CLAUDE.md` "Agent team & workflow") keeps that file trustworthy.

## When to use this

- **At the start of any session** before continuing spec-driven implementation work (i.e. anything tracked against `prompts/spec/*.md`): read the relevant file(s) in `prompts/plan-checklist/` FIRST, before grepping/reading source to reconstruct status. Treat it as the authoritative starting point — then spot-check with `git status`/`git log` (see Rules below) rather than re-deriving everything from scratch.
- **Whenever you start a new feature-sized lot** through the `architect` → `senior-developer` → `dev-tester` → `reviewer` pipeline described in `CLAUDE.md`.
- **After each stage of that pipeline finishes** — an architect plan lands, senior-developer finishes implementing, dev-tester finishes testing, reviewer returns a verdict, fixes get applied, a commit happens — update the checklist file's relevant status line(s).
- **Whenever a structural or stack decision gets made that isn't in the original spec verbatim** (new package, new dependency category, a spec passage overridden by direct user instruction) — log it in the file's decisions section immediately, not at the end of the session.

## File location & naming

- One running file per major spec/initiative: `prompts/plan-checklist/<slug>-implementation-plan.md` (e.g. `rushhours-implementation-plan.md`). Don't fragment progress across many small files — it must stay readable in one pass.
- If genuinely multiple independent large initiatives are active at once, create one file per initiative plus an `INDEX.md` in the folder linking them. Default to a single file otherwise — don't create this structure preemptively.
- If the folder or file doesn't exist yet for the initiative you're working on, create it using the template shape below before you do anything else with the pipeline.

## Status legend (use consistently, don't invent alternatives)

- ✅ done & committed
- 🟡 done, not committed yet
- 🚧 in progress right now
- ⬜ not started
- ❌ blocked (say why, one line)

## File shape

Each plan file has these sections, in this order:

1. **Header** — one line pointing back at the spec file it tracks and this skill.
2. **Comment l'utiliser** (or "How to use it") — short, points a fresh session at reading this file first.
3. **Décisions / déviations** — dated, one-line-why log entries for anything that diverges from the original spec text. This is what lets a fresh session understand context it wasn't present for, without you having to re-explain it. Append-only; don't delete old entries even once superseded, note the supersession instead.
4. **Checklist** — the concrete deliverables (mirror the spec's own suggested implementation order when one exists, e.g. rushhours-full-spec.md §10), one status marker each, with enough detail to know which files/modules it lives in and whether it's committed and reviewed.
5. **État git actuel** — current branch, last commit hash + subject, one-line summary of what's uncommitted.
6. **Prochaines étapes immédiates** — the next 3-6 concrete actions, ordered. Not a restatement of the whole remaining backlog — prune finished items rather than accumulating a historical log here (history belongs in section 3 and in git log, not here).

## Rules

- **Update the file yourself, as orchestrator** — don't delegate this to a subagent. A subagent doesn't have your conversation-wide view of what actually happened across an entire pipeline run; only you do.
- **Verify before writing.** Never mark something ✅ done & committed without confirming via `git log`/`git show --stat`/`git status` that it's actually true right now. Trust the live repo over memory of what an agent's summary claimed — agent summaries describe intent, not verified fact.
- **Keep entries factual and terse.** This is a status board, not a narrative transcript. Reference spec section numbers instead of re-explaining spec content inline.
- **On resume, reconcile before proceeding.** If the checklist disagrees with what `git status`/`git log` actually shows — says something is done but the files aren't there, or vice versa — trust the live repo state, fix the checklist immediately, and note the discrepancy in the decisions log rather than silently proceeding on stale info.
- **Update incrementally, not just at the end.** The whole point is surviving an interrupted session (lost Codespace VM, context compaction). Update the relevant status line right after the pipeline stage that changed it, not as a batch at the end of a long turn.
