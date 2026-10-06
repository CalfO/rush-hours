/**
 * Playwright's `webServer.url` check only proves the dev server accepts a
 * basic GET — confirmed by reproducing this directly: on a cold start, the
 * web dev server (and its /api proxy) starts responding within ~4-16s, but
 * a POST that actually exercises the WebAuthn registration path can still
 * 502 for a further, narrower window even after that check passes (Nest's
 * module graph — Passport strategies, the WebAuthn service — finishes
 * wiring up fractionally after its HTTP server starts accepting simple
 * GETs). Every spec's very first step is a WebAuthn registration, so this
 * polls that exact path with a throwaway username before letting any test
 * run, rather than tests intermittently failing on a generic frontend
 * error that has nothing to do with what they're actually testing.
 */
export default async function globalSetup(): Promise<void> {
  const url = "http://localhost:3000/api/auth/webauthn/register/options";
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "__e2e_readiness_probe__" }),
      });
      // Any real response from the auth module (404 unknown user, 201
      // options generated, ...) proves it's fully wired. A 502 means the
      // proxy still can't reach the API yet.
      if (response.status !== 502) return;
    } catch {
      // Connection refused, proxy not up yet, etc. -- keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`API's WebAuthn route never became ready at ${url}`);
}
