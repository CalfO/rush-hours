import { describe, expect, test, vi } from "vitest";
import { apiFetch } from "./client";
import { getAnalytics } from "./time-entries";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

describe("time entries API", () => {
  test("requests analytics with an encoded inclusive date range", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      days: [],
      weeks: [],
      total: { workedMinutes: 0, targetMinutes: 0, balanceMinutes: 0 },
    });

    await getAnalytics("2026-01-01", "2026-01-31");

    expect(apiFetch).toHaveBeenCalledWith(
      "/time-entries/analytics?from=2026-01-01&to=2026-01-31",
    );
  });
});
