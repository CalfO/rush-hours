import primeui from "tailwindcss-primeui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Gate `dark:` variants behind an explicit `.dark` class that this app never
  // sets (spec §2.1 — single Material-flat light theme, no dark mode planned).
  // Without this, Tailwind's default 'media' strategy would activate the
  // PrimeReact Primitive components' `dark:` classes purely from OS
  // preference, producing an inconsistent half-dark UI we never designed for.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Indigo — replaces the original Material blue for a more current,
        // distinctive "dominant color" (user request). Anchored on Tailwind's
        // own indigo scale so DEFAULT/600 lands exactly on #4f46e5. Full
        // 0-950 scale (same reasoning as `surface` below: a gap at any shade
        // silently drops that utility's CSS rule) — kept in sync by hand with
        // `index.css`'s `--p-primary-*` block, PrimeReact's own separate
        // source of truth for anything driven by its `--p-primary-color`/
        // `--p-highlight-*` tokens (see that file's own doc comment).
        primary: {
          DEFAULT: "#4f46e5",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        secondary: {
          DEFAULT: "#00897b",
          50: "#e3f2f0",
          100: "#b2dfdb",
          500: "#009688",
          600: "#00897b",
          700: "#00695c",
          900: "#004d40",
        },
        // Full 0-950 scale (Tailwind's own `slate`, matching this repo's
        // components.json baseColor and the --p-surface-* CSS variables in
        // index.css) rather than a partial Material-grey set — the
        // shadcn-generated Primitive components (src/components/ui/) use the
        // complete scale (e.g. `border-surface-300`, `bg-surface-800`), and a
        // gap at any shade silently drops that utility's CSS rule.
        surface: {
          DEFAULT: "#ffffff",
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        success: {
          DEFAULT: "#2e7d32",
          50: "#e8f5e9",
          100: "#c8e6c9",
          500: "#4caf50",
          600: "#2e7d32",
          700: "#1b5e20",
        },
        error: {
          DEFAULT: "#c62828",
          50: "#fdecea",
          100: "#f9c6c2",
          500: "#e53935",
          600: "#c62828",
          700: "#b71c1c",
        },
        warning: {
          DEFAULT: "#ef6c00",
          50: "#fff3e0",
          100: "#ffe0b2",
          500: "#ff9800",
          600: "#ef6c00",
          700: "#e65100",
        },
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      // Tailwind's default spacing scale jumps from `4` to `5` (no `.5`
      // fractional keys past `3.5`) — the shadcn-generated Primitive
      // components (src/components/ui/dialog.tsx, checkbox.tsx, avatar.tsx)
      // use `4.5`/`10.5`, which without this silently produce no CSS rule at
      // all (same defect class as the `surface` palette gap above: a class
      // referencing a non-existent scale key is dropped, not approximated).
      spacing: {
        4.5: "1.125rem",
        10.5: "2.625rem",
      },
    },
  },
  plugins: [primeui],
};
