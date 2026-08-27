import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route (or an entire controller) as reachable without a session cookie.
 * Read by `AuthGuard` (registered globally via `APP_GUARD`) through the `Reflector`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
