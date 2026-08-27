---
name: react-best-practices
description: React 18 + Vite SPA conventions for this repo's frontend (apps/web/**) — re-render optimization, effect hygiene, code-splitting, and plain JS/JSX idioms (no TypeScript). Use when writing, reviewing, or refactoring any React component, hook, or Vite-bundled module in apps/web.
license: MIT
metadata:
  author: rush-hours (adapted from vercel-labs/agent-skills react-best-practices, MIT)
  version: "1.0.0"
---

# React best practices — apps/web

Adapted from https://github.com/vercel-labs/agent-skills (70 rules, MIT), which is written for **Next.js/React Server Components**. This repo is a **plain React 18 + Vite SPA, JS/JSX only, no TypeScript** (`CLAUDE.md`) — most of the source's "Server-Side Performance" section (RSC, `next/dynamic`, server actions, `after()`) and all hydration-mismatch rules **do not apply** and are dropped entirely. What's kept below is the client-side subset that does apply to a Vite SPA, rewritten in JS with no type annotations.

## 1. Don't define components inside components (HIGH impact)

Defining a component inside another component's body creates a new component type every render, forcing React to unmount/remount it — state resets, effects re-run, inputs lose focus.

```jsx
// Bad — DayBadge is redefined every render of MonthCalendar
function MonthCalendar({ days }) {
  const DayBadge = ({ day }) => <span>{day.balance}</span>;
  return days.map((d) => <DayBadge key={d.date} day={d} />);
}

// Good — hoisted, receives props
function DayBadge({ day }) {
  return <span>{day.balance}</span>;
}
function MonthCalendar({ days }) {
  return days.map((d) => <DayBadge key={d.date} day={d} />);
}
```

Relevant here: the monthly calendar grid and the day/week balance indicators from `prompts/spec/rushhours-full-spec.md` §7.2 render many small per-day/per-cell pieces — always as top-level (or module-scope) components, never defined inline inside the calendar's render function.

## 2. Derive state during render, don't mirror it into state+effect

If a value is computable from existing props/state, compute it inline — don't `useState` + `useEffect(() => setX(...), [deps])` to keep a derived value in sync.

```jsx
// Bad
const [balanceLabel, setBalanceLabel] = useState('');
useEffect(() => {
  setBalanceLabel(formatBalance(balanceMinutes));
}, [balanceMinutes]);

// Good
const balanceLabel = formatBalance(balanceMinutes);
```

Directly relevant to the balance/écart formatting (`+1h30` / `-0h45`) described in the spec — that's a pure function of `balanceMinutes`, never state.

## 3. Functional `setState` updates for anything based on previous state

```jsx
// Bad — stale closure risk, forces `entries` as a dependency
const addEntry = useCallback((entry) => setEntries([...entries, entry]), [entries]);

// Good — stable callback, always correct
const addEntry = useCallback((entry) => setEntries((curr) => [...curr, entry]), []);
```

## 4. Lazy `useState` initializer for expensive initial values

```jsx
// Bad — JSON.parse runs on every render
const [cachedLocale, setCachedLocale] = useState(JSON.parse(localStorage.getItem('locale') || '"fr"'));

// Good — runs once
const [cachedLocale, setCachedLocale] = useState(() => {
  const stored = localStorage.getItem('locale');
  return stored ? JSON.parse(stored) : 'fr';
});
```

Applies directly to the i18next language-preference read in the header (`prompts/spec/rushhours-full-spec.md` §8.1) and to any localStorage-backed default.

## 5. Split independent computations/effects instead of combining them

One `useMemo`/`useEffect` with multiple unrelated concerns re-runs everything whenever *any* of its dependencies changes.

```jsx
// Bad — changing sortOrder recomputes filtering too
const rows = useMemo(() => sortRows(filterRows(entries, month), sortOrder), [entries, month, sortOrder]);

// Good — each recomputes only when its own inputs change
const filtered = useMemo(() => filterRows(entries, month), [entries, month]);
const rows = useMemo(() => sortRows(filtered, sortOrder), [filtered, sortOrder]);
```

## 6. Narrow effect dependencies to primitives, and derive booleans before the effect

```jsx
// Bad — re-runs on every field change of `user`
useEffect(() => { track(user.id); }, [user]);
// Good
useEffect(() => { track(user.id); }, [user.id]);
```

## 7. Put interaction logic in the event handler, not in state+effect

If a side effect is triggered by a specific user action (form submit, button click), call it directly from the handler — don't set a `submitted` flag and react to it in a `useEffect`. This avoids duplicate submissions and effects re-running for unrelated reasons.

## 8. Don't wrap trivial primitive expressions in `useMemo`

`useMemo(() => a || b, [a, b])` for two booleans costs more (dependency array comparison) than the expression itself. Reserve `useMemo`/`useCallback` for expensive computations or for stabilizing a reference passed to a `memo()`-wrapped child or an effect dependency.

## 9. Extract expensive work into a memoized child to enable early returns

```jsx
// Bad — computeCalendarGrid runs even while loading
function MonthView({ month, loading }) {
  const grid = useMemo(() => computeCalendarGrid(month), [month]);
  if (loading) return <Skeleton />;
  return <Grid data={grid} />;
}

// Good — skipped entirely while loading
const CalendarGrid = memo(function CalendarGrid({ month }) {
  const grid = useMemo(() => computeCalendarGrid(month), [month]);
  return <Grid data={grid} />;
});
function MonthView({ month, loading }) {
  if (loading) return <Skeleton />;
  return <CalendarGrid month={month} />;
}
```

## 10. Give memoized components stable default values for non-primitive props

```jsx
// Bad — a new function every render breaks memo() equality checks
const DayCell = memo(function DayCell({ onClick = () => {} }) { ... });

// Good
const NOOP = () => {};
const DayCell = memo(function DayCell({ onClick = NOOP }) { ... });
```

## 11. `useRef` for high-frequency values that don't need to trigger a re-render

Mouse position trackers, transient drag state, etc. — use a ref and imperatively update the DOM, don't `setState` on every event.

## 12. `useDeferredValue`/`startTransition` for expensive derived UI reacting to fast input

Relevant to the Analytics view (`prompts/spec/rushhours-full-spec.md` §7.3): if a date-range filter re-renders a Chart.js chart on every keystroke/drag and that becomes visibly laggy, wrap the expensive recompute with `useDeferredValue` on the range so typing/dragging stays responsive.

## 13. Code-splitting (Vite equivalent of the source's Next.js rules)

The source recommends `next/dynamic` for heavy, rarely-used components — the Vite/plain-React equivalent is `React.lazy` + `Suspense`:

```jsx
const AnalyticsView = lazy(() => import('./pages/AnalyticsView'));
// ...
<Suspense fallback={<Spinner />}>
  <AnalyticsView />
</Suspense>
```

Good candidate in this repo: the Chart.js-backed Analytics view (`/analytics` route) and the WebAuthn browser library (`@simplewebauthn/browser`) are only needed on specific routes — lazy-load rather than bundling them into the initial `/` chunk.

**Avoid barrel-file imports** (`import { Button } from './components'` re-exporting dozens of files) once the component tree grows — import directly from the defining file. This keeps Vite's dependency graph (and dev-server HMR) fast and avoids pulling unrelated code into a chunk.

## 14. Advanced: stable callback refs for subscriptions

When an effect subscribes to something (a `window` event listener, a WebSocket) using a caller-supplied callback, don't put that callback in the dependency array (it forces a resubscribe on every render) — store it in a ref instead:

```jsx
function useWindowEvent(event, handler) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const listener = (e) => handlerRef.current(e);
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  }, [event]);
}
```

**Caveat**: the source's equivalent example uses `useEffectEvent`, a React API not yet stable in the React **18.2** this repo pins (`apps/web/package.json`) — it only exists as `react`'s unstable `experimental_useEffectEvent` in some 18.x builds. Use the ref-based pattern above by default; revisit `useEffectEvent` only after a deliberate React version upgrade.

## 15. Initialize app-wide state once, not per mount

For anything that must run exactly once per page load (e.g. reading the persisted auth session on boot, per the spec's `AuthProvider`), guard with a module-level flag rather than relying on `useEffect(() => {...}, [])` alone — Strict Mode double-invokes effects in development, and the component can remount.

## JS micro-optimizations (apply opportunistically, not preemptively)

- Prefer `Map`/`Set` over repeated `.find()`/`.includes()` in loops over entries data (e.g. looking up a day's entry by date while rendering the month grid).
- Return early from functions/guard clauses instead of nested `if`.
- Hoist any `RegExp` literal used inside a loop or a frequently-called function to module scope.

## Sources

- https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices (MIT) — full rule set, Next.js/RSC-oriented; this file keeps only the client-side React subset applicable to a Vite SPA, translated to JS/JSX.
- Repo conventions: `CLAUDE.md` (root, "no TypeScript" for `apps/web`), `prompts/spec/rushhours-full-spec.md` §7 (views this applies to).
