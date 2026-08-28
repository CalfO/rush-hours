import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiFetch, ApiError } from "./client";

/**
 * src/api/client.ts's `apiFetch` is the one piece of real logic in this
 * lot's `src/api` — every authenticated call in the app depends on it
 * always sending the httpOnly session cookie (`credentials: "include"`)
 * and a JSON content type, per CLAUDE.md's auth/session design. `fetch`
 * is mocked (`vi.stubGlobal`), no real server is hit.
 */
describe("apiFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("2xx response is parsed and returned as JSON", async () => {
    const payload = { workedMinutes: 480 };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    });

    const result = await apiFetch<typeof payload>("/time-entries/summary");

    expect(result).toEqual(payload);
  });

  test("always sends credentials: include and Content-Type: application/json", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch("/time-entries/summary");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${import.meta.env.VITE_API_URL}/time-entries/summary`);
    expect(init).toMatchObject({
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  test("passes through method/body, and cannot be made to opt out of credentials", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });

    await apiFetch("/time-entries/2026-08-28", {
      method: "PUT",
      body: JSON.stringify({ arrival: "09:00" }),
      // A caller-supplied "omit" must not win over the app's session design.
      credentials: "omit",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ arrival: "09:00" }));
    expect(init.credentials).toBe("include");
  });

  test("204 response returns undefined without attempting to parse a body", async () => {
    const json = vi.fn(() => Promise.reject(new Error("should not be called")));
    fetchMock.mockResolvedValue({ ok: true, status: 204, json });

    const result = await apiFetch("/time-entries/2026-08-28");

    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  test("non-2xx response throws an ApiError carrying the status and body text", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Time entry not found"),
    });

    let caught: unknown;
    try {
      await apiFetch("/time-entries/2026-08-28");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(404);
    expect((caught as ApiError).message).toBe("Time entry not found");
  });

  test("non-2xx response with an empty body falls back to a generic message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(""),
    });

    let caught: unknown;
    try {
      await apiFetch("/time-entries/2026-08-28");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(500);
    expect((caught as ApiError).message).toBe("Request failed: 500");
  });

  test("non-2xx response with Nest's default JSON error shape extracts the message field", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            statusCode: 409,
            message: "Email already in use",
            error: "Conflict",
          }),
        ),
    });

    let caught: unknown;
    try {
      await apiFetch("/users/me", { method: "PATCH" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
    expect((caught as ApiError).message).toBe("Email already in use");
  });

  test("non-2xx response with a Zod-validation array message joins it into one string", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            statusCode: 400,
            message: ["firstName is required", "email must be a valid email"],
            error: "Bad Request",
          }),
        ),
    });

    let caught: unknown;
    try {
      await apiFetch("/users/me", { method: "PATCH" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe(
      "firstName is required, email must be a valid email",
    );
  });
});
