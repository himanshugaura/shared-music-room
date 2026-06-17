/**
 * Single source of truth for route classification.
 * Used by both AuthGate (redirect logic) and the axios interceptor.
 */

/** Routes only guests can visit — logged-in users get bounced to /dashboard. */
export const GUEST_ONLY_ROUTES = ["/login", "/signup"] as const;

/** Routes only for logged-in but UNVERIFIED users. */
export const VERIFY_ONLY_ROUTES = ["/verify-email"] as const;

/** Routes only for logged-in VERIFIED users who have incomplete profiles (no name/username). */
export const PROFILE_SETUP_ROUTES = ["/profile"] as const;

/** Routes that require the user to be logged-in, verified, AND have a complete profile. */
export const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/room"] as const;

/**
 * Routes where a failed token refresh should NOT force a redirect to /login.
 */
export const NO_REDIRECT_ON_AUTH_FAIL = [
  ...GUEST_ONLY_ROUTES,
  ...VERIFY_ONLY_ROUTES,
  ...PROFILE_SETUP_ROUTES,
  "/",
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isGuestOnly(path: string) {
  return GUEST_ONLY_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

export function isVerifyOnly(path: string) {
  return VERIFY_ONLY_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

export function isProfileSetup(path: string) {
  return PROFILE_SETUP_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

export function isProtected(path: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (r) => path === r || path.startsWith(r + "/")
  );
}

/** Returns true when a refresh failure should NOT redirect to /login. */
export function isPublicOrGuestPath(path: string) {
  return NO_REDIRECT_ON_AUTH_FAIL.some((r) =>
    r === "/" ? path === "/" : path.startsWith(r)
  );
}
