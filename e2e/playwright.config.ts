import { defineConfig, devices } from "@playwright/test";

/**
 * This app has no self-registration (spec `rushhours-full-spec.md` §5.1) —
 * only the two seeded accounts (`user`, `admin`) exist, so every test shares
 * one of two fixed identities. Each spec resets the account(s) it owns via
 * `helpers/db.ts` before running, which makes serial execution (not
 * `fullyParallel`) the correct default here: two specs racing on the same
 * account would corrupt each other's state. Split specs across `user`/
 * `admin` if the suite grows enough that serial runtime becomes a problem.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // A cold `npm run dev` start pits Postgres/Nest/Vite/Chromium warming up
  // against each other for CPU — confirmed (not guessed) this can still
  // make the very first WebAuthn ceremony flake even after global-setup's
  // readiness probe passes, while the identical steps in later tests never
  // do. One local retry absorbs that without masking a real regression
  // (any test failing twice in a row is not a warm-up artifact).
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Brings up Postgres + api + web the same way `npm run dev` does locally
  // (apps/api's prestart chain handles db:setup, see root CLAUDE.md) —
  // reused as-is here rather than duplicating that bring-up logic.
  //
  // The readiness URL deliberately goes through the web dev server's own
  // /api proxy (apps/web/vite.config.ts) rather than checking the bare web
  // root: Vite starts serving within ~4s, but Nest (behind apps/api's own
  // prestart -> db:setup chain) can take another ~10-15s to actually accept
  // requests. A bare "http://localhost:3000" check reports ready as soon as
  // Vite is up, well before the API can serve anything -- confirmed
  // reproducing exactly this race (Vite ready at ~4s, API ready at ~16s on
  // a cold start), which made the first-run test fail on a real API 502
  // surfaced as a generic frontend error, not a test bug. Hitting
  // /api/auth/me (401 once ready, ECONNREFUSED via the proxy before) makes
  // the wait cover both processes actually being usable together.
  webServer: {
    command: "npm run dev",
    cwd: "..",
    url: "http://localhost:3000/api/auth/me",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
