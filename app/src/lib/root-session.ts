import type { AdminSessionUser } from "../server/functions/session-utils";

/**
 * Client root session after SPA navigations (including OTP sign-in).
 *
 * Better-auth session cookies are httpOnly, so `document.cookie` is empty even
 * when the browser stores a session. Always ask the server; the Cookie header
 * on that request includes httpOnly cookies. The anonymous homepage skip lives
 * only in `resolveRootSession` (SSR), which reads the request Cookie header.
 */
export async function resolveBrowserRootSession(
  getSession: () => Promise<AdminSessionUser | null>,
): Promise<{ session: AdminSessionUser | null }> {
  return { session: await getSession() };
}
