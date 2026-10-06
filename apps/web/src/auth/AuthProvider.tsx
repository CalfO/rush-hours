import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getMe, logout as logoutRequest, type AuthUser } from "../api/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Re-runs `GET /auth/me`, updates context state, and returns the fetched
   * user (or `null` on a 401 / any other failure). Callers that need the
   * freshly-fetched user synchronously (e.g. `LoginPage` deciding where to
   * navigate right after a WebAuthn ceremony) should use the return value
   * rather than waiting for a context re-render. */
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// `GET /auth/me` must run exactly once per page load. `apps/web/src/index.tsx`
// renders <React.StrictMode>, which double-invokes effects in development,
// so a plain `useEffect(() => {...}, [])` isn't enough on its own — guard
// with a module-level flag instead (react-best-practices §15).
let hasBooted = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const fetchedUser = await getMe();
      setUser(fetchedUser);
      setStatus("authenticated");
      return fetchedUser;
    } catch {
      // A 401 (unauthenticated visitor) is an expected outcome here, not a
      // crash — same treatment for any other failure to confirm the
      // session, so an anonymous visitor never sees an uncaught rejection.
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  // `ignoreRef` (not a plain per-invocation `let`) is what makes this safe
  // under Strict Mode's synchronous mount -> cleanup -> mount dev-only
  // double-invoke: cleanup always runs before the second invocation, so the
  // ref is reset to `false` by the *second* invocation before the in-flight
  // `getMe()` promise from the *first* invocation resolves. A per-invocation
  // `let ignore` would instead capture the first invocation's own (now
  // stale) closure, and since `hasBooted` skips firing `getMe()` again on
  // the second invocation, that stale `ignore` would never get reset back
  // to `false` — leaving `status` stuck at `"loading"` forever.
  const ignoreRef = useRef(false);

  useEffect(() => {
    ignoreRef.current = false;
    if (!hasBooted) {
      hasBooted = true;
      getMe().then(
        (fetchedUser) => {
          if (ignoreRef.current) return;
          setUser(fetchedUser);
          setStatus("authenticated");
        },
        () => {
          if (ignoreRef.current) return;
          setUser(null);
          setStatus("unauthenticated");
        },
      );
    }
    return () => {
      ignoreRef.current = true;
    };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, refresh, logout }),
    [status, user, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
