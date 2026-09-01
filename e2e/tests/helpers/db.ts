import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads DATABASE_URL from apps/api/.env directly rather than duplicating it
 * into a second .env file for this workspace — one source of truth for the
 * connection string both apps/api and these tests point at the same DB.
 */
function loadDatabaseUrl(): string {
  const envPath = path.resolve(__dirname, "../../../apps/api/.env");
  if (!existsSync(envPath)) {
    throw new Error(
      `${envPath} not found. Copy apps/api/.env.example to apps/api/.env first (see CLAUDE.md).`,
    );
  }
  const match = readFileSync(envPath, "utf8").match(
    /^DATABASE_URL="?([^"\n]+)"?$/m,
  );
  if (!match) {
    throw new Error(`DATABASE_URL not found in ${envPath}`);
  }
  return match[1];
}

/**
 * Resets a seeded account (`user` or `admin` — this app has no
 * self-registration, spec §5.1) to the same pristine state it's in right
 * after `prisma db seed`: no passkey, no profile, onboarding not started,
 * no saved data. Every spec calls this for the account(s) it owns before
 * running, so specs stay independently re-runnable rather than depending on
 * suite order.
 */
export async function resetAccount(username: "user" | "admin"): Promise<void> {
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM credentials WHERE "userId" IN (SELECT id FROM users WHERE username = $1)`,
      [username],
    );
    await client.query(
      `DELETE FROM webauthn_challenges WHERE "userId" IN (SELECT id FROM users WHERE username = $1)`,
      [username],
    );
    await client.query(
      `DELETE FROM working_day_schedules WHERE "userId" IN (SELECT id FROM users WHERE username = $1)`,
      [username],
    );
    await client.query(
      `DELETE FROM time_entries WHERE "userId" IN (SELECT id FROM users WHERE username = $1)`,
      [username],
    );
    await client.query(
      `DELETE FROM reference_week_entries WHERE "userId" IN (SELECT id FROM users WHERE username = $1)`,
      [username],
    );
    await client.query(
      `UPDATE users
       SET "onboardingCompletedAt" = NULL,
           "firstName" = NULL,
           "lastName" = NULL,
           email = NULL,
           "weeklyContractHours" = 35,
           "weekStartDay" = 'MONDAY'
       WHERE username = $1`,
      [username],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export interface DayTimes {
  arrival: string; // "HH:MM"
  departure: string;
  lunchStart: string;
  lunchEnd: string;
}

/**
 * Inserts a `TimeEntry` directly, bypassing the UI — used to fast-fill the
 * days a spec isn't actually testing (e.g. the reference-week save-prompt
 * spec only needs to test the UI save that *completes* a week, not every
 * day's own entry form, which is already covered by `day-entry.spec.ts`).
 */
export async function seedTimeEntry(
  username: "user" | "admin",
  isoDate: string,
  times: DayTimes,
): Promise<void> {
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO time_entries
         (id, date, "arrivalTime", "departureTime", "lunchBreakStart", "lunchBreakEnd", "createdAt", "updatedAt", "userId")
       SELECT gen_random_uuid(), $2::date,
              ($2 || ' ' || $3)::timestamp, ($2 || ' ' || $4)::timestamp,
              ($2 || ' ' || $5)::timestamp, ($2 || ' ' || $6)::timestamp,
              now(), now(), id
       FROM users WHERE username = $1`,
      [
        username,
        isoDate,
        times.arrival,
        times.departure,
        times.lunchStart,
        times.lunchEnd,
      ],
    );
  } finally {
    await client.end();
  }
}
