---
name: primereact
description: PrimeReact v11 component usage for this repo's frontend (apps/web/**) — which architectural layer to use (Primitive/shadcn vs Headless vs Styled), correct v11 component names, and per-component notes for the components RushHours needs (DatePicker, Select, Dialog, ToggleButtonGroup, InputNumber, Checkbox, Tabs, ProgressBar, Toast). Use whenever adding or modifying a PrimeReact component in apps/web.
license: MIT
metadata:
  author: rush-hours (derived from PrimeReact's own llms-full.txt export, MIT-licensed docs)
  version: "1.1.0"
---

# PrimeReact v11 — apps/web

Source: `references/llm-full.md` (PrimeReact's official `llms-full.txt`, ~142k lines, moved here as the exhaustive fallback — grep it for anything not covered below, e.g. `grep -n "^# Updating to v11" -A 200 references/llm-full.md` for the full old-name→new-name table beyond the ones listed in §3).

**This skill exists because the version installed today (PrimeReact v11) is architecturally different from most PrimeReact tutorials/examples on the web (v10 and earlier)** — component names changed, and the "how do I style this without a theme" answer changed too. Read this before writing PrimeReact code, not just when something breaks.

## 1. Four layers — pick the right one, don't mix by accident

PrimeReact v11 splits into a `@primereact/headless` foundation with three things built on top of it:

| Layer | Package / distribution | Styling | Use for RushHours? |
|---|---|---|---|
| **Headless** | `@primereact/headless` — hooks (`useButton`, `useDialog`, ...) returning props to spread on your own JSX | 100% yours | Only for something none of the below cover |
| **Primitive** | Copy-pasted into your repo via `npx shadcn@latest add https://primereact.dev/r/<component>.json`, lands in `apps/web/src/components/ui/` | 100% yours (you own the source file) | **Yes — primary choice** |
| **Tailwind** | Installable package `@primereact/ui/*`, pre-styled with Tailwind utility classes, customizable via `pt`/`unstyled` | Pre-styled, override via `pt` | No — bakes in a visual opinion we'd have to fight |
| **Styled** | Classic `primereact` package, theme presets (Aura/Material/Lara/Nora) via design tokens, `PrimeReactProvider theme={...}` | Runtime CSS theme | **No — explicitly excluded**, see `prompts/spec/rushhours-full-spec.md` §2.1 ("aucun thème CSS PrimeReact") |

**Decision for this repo: use the Primitive layer as the default.** It's the closest match to "Tailwind uniquement, flat design, pas de thème CSS" from the spec — you get PrimeReact's behavior/accessibility (compound API: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`, etc.) as a local file you fully own and style with plain Tailwind classes, no runtime theming system, no `pt`/passthrough indirection to fight with. Reach for **Headless** hooks directly only if a Primitive component doesn't exist for what's needed or its compound structure doesn't fit a specific layout. Don't install the classic `primereact` package or `@primereact/ui/*` at all — this repo needs neither.

This refines (doesn't contradict) `prompts/spec/rushhours-full-spec.md` §2.1, which anticipated a `PrimeReactProvider unstyled={true}` + global `pt` runtime config on the classic package — that mechanism exists but the Primitive/shadcn-CLI path is the better fit and should be used instead.

## 2. Adopting a component (Primitive layer)

```bash
npx shadcn@latest add https://primereact.dev/r/<component>.json
```

This requires a `components.json` (shadcn config) at the `apps/web` root and Tailwind already configured — both are one-time setup, not per-component. Works with plain Vite (not Next.js-only).

The CLI generates `.tsx` directly, which matches this repo's stack (`CLAUDE.md`: `apps/web` is full TypeScript) — no stripping or renaming needed. Once copied, the file is ordinary project source — restyle it directly with Tailwind classes for the Material-flat look (`.claude/skills/react-best-practices` and the design tokens in `prompts/spec/rushhours-full-spec.md` §2.1 apply to it exactly like any other component you'd write by hand), and keep its prop types intact rather than loosening them to `any`.

## 3. Correct v11 names — check before writing any import

Full table: `references/llm-full.md`, "Updating to v11" section. The ones that matter for RushHours specifically (per `prompts/spec/rushhours-full-spec.md`):

| Spec said (v10 name) | Actual v11 name |
|---|---|
| `Calendar` (time entry pickers) | `DatePicker` — use `timeOnly` prop for a pure time input, `showTime` to pair date+time |
| `Dropdown` (language switcher, week-start-day selector) | `Select` |
| `SelectButton` (35/37/40 quick-pick) | `ToggleButtonGroup` |
| `TabMenu` (header nav Saisie/Analyses) | **Removed.** Use `Tabs` (wire routing yourself) |
| `Menubar` | **Removed.** Use `NavigationMenu`, or plain `Tabs` for this repo's 2-item nav — no need for a mega-menu component |
| `Chart` | **Not free in v11** — see §4 below |

## 4. Analytics charts — `Chart` is not available for free in v11, and this repo stays PrimeReact-only

PrimeReact's `Chart` component moved to the commercial PrimeUI Pro package (`@primeuipro/chart`). The obvious fix would be to depend on `chart.js`/`react-chartjs-2` directly (same engine PrimeReact's `Chart` used to wrap) — **but this repo has decided against introducing any charting library outside PrimeReact** (`prompts/spec/rushhours-full-spec.md` §2). The Analytics view's three visualizations (daily bar chart, cumulative-balance trend line, weekly totals bar chart — spec §7.3) are hand-built as small SVG/Tailwind components under `apps/web/src/components/charts/` instead: `<rect>` elements sized proportionally to values for bars, a `<polyline>`/`<path>` for the trend line with a zero-reference line. These are short, simple series (days in a month, a handful of weeks) — no need for a full charting engine's zoom/tooltip/animation machinery.

PrimeReact's still-free Primitive components (`ProgressBar`, `Knob`, `MeterGroup`) remain a good fit for a single-value gauge (e.g. the day/week balance indicator, §7.2) — just not for these three multi-point charts.

**This is a spec correction, already applied** — `prompts/spec/rushhours-full-spec.md` §7.3 was updated to match; if you see an older reference to "composant `Chart` de PrimeReact" anywhere, it's stale.

## 5. Per-component notes for RushHours' actual needs

- **`DatePicker`** (arrival/departure/lunch-break inputs, §7.2): `timeOnly` for pure time selection, `hourFormat="24"` for a 24h clock (more natural for a French work-hours app than default 12h/AM-PM), `stepMinute` to control granularity.
- **`Select`** (language dropdown, week-start-day picker, §7.1/§5.5): supports `multiple` if ever needed (folds in what used to be `MultiSelect`) — not needed here, both RushHours selects are single-value.
- **`ToggleButtonGroup`** (heures hebdo quick-pick 35/37/40, §5.5): replaces `SelectButton` 1:1 for this use case.
- **`Checkbox`** (jours travaillés, §5.5): plain checkboxes, one per weekday — no special v11 gotcha.
- **`InputNumber`** (répartition des heures par jour, §5.5): use its built-in min/step rather than validating purely in the Zod schema client-side — belt and suspenders, but the Zod schema remains the source of truth per `nestjs-best-practices`/spec §5.5 (sum must equal the weekly total).
- **`Dialog`** (Paramètres, Ma semaine de travail modals, §5.5/§7.1): this is the compound `Dialog.Root`/`Dialog.Trigger`/`Dialog.Content` API in v11 — build the shared `src/components/ui/Modal.tsx` wrapper mentioned in `prompts/spec/rushhours-full-spec.md` §2.1 on top of this once, reuse everywhere, don't recompose `Dialog.*` ad hoc per modal.
- **`Tabs`** (header nav, §7.1): two-tab nav (Saisie/Analyses), route the active tab through `react-router` rather than local component state, so the URL stays the source of truth for navigation.
- **`ProgressBar`** / **`Knob`** (day/week balance gauge, §7.2): both are unchanged names from v10 — pick whichever visual reads better for a credit/debit gauge; `Knob` is circular (single number), `ProgressBar` is linear (better for showing "X of Y hours" with a clear zero-crossing for credit vs debit — probably the better fit here, but this is a visual call, not a technical constraint).
- **`Toast`**: unchanged from v10, standard use for save-confirmation/error feedback across the app.

## Sources

- `references/llm-full.md` — PrimeReact's own `llms-full.txt` documentation export (captured from the project's `llm-primereact.md`, MIT-licensed docs), moved here as the exhaustive reference, including the full "Updating to v11" component-name table.
- Repo conventions: `CLAUDE.md` (root, full TypeScript for `apps/web`), `prompts/spec/rushhours-full-spec.md` §2.1/§7 (where these components are used), `.claude/skills/react-best-practices` (applies once a Primitive component is copied into the repo and becomes ordinary project source).
