const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Nest's default exception filter (and nestjs-zod validation errors) return
 * a JSON body shaped `{ statusCode, message, error }`, where `message` can
 * be a single string or an array of validation messages — pull the actual
 * message out of that instead of surfacing the raw JSON blob as text.
 */
function parseErrorMessage(body: string, status: number): string {
  if (!body) {
    return `Request failed: ${status}`;
  }
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(", ");
    }
  } catch {
    // Not a JSON body — fall through and use the raw text.
  }
  return body;
}

/**
 * Thin fetch wrapper for calling the RushHours API. Always sends/receives
 * cookies (httpOnly JWT session cookie) and parses JSON responses.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(
      response.status,
      parseErrorMessage(body, response.status),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
