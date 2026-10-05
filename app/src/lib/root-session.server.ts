import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "../auth/auth-server-config";
import type { UserRole } from "../middleware";
import type { AdminSessionUser } from "../server/functions/session-utils";
import { hasAuthSessionCookie } from "./public-document-cache";

function isUserRole(value: string | undefined): value is UserRole {
  return value === "Admin" || value === "Moderator";
}

/**
 * Resolve the root-route session, skipping auth work when no session cookie is present
 * (anonymous homepage / public document cache path).
 */
export async function resolveRootSession(): Promise<{ session: AdminSessionUser | null }> {
  const request = getRequest();
  if (!hasAuthSessionCookie(request.headers.get("cookie"))) {
    return { session: null };
  }

  try {
    const auth = getAuth();
    const result = await auth.api.getSession({ headers: request.headers });
    if (!result?.user) return { session: null };

    const userRole = (result.user as { authRole?: string }).authRole;
    if (!isUserRole(userRole)) {
      return { session: null };
    }

    return {
      session: {
        id: result.user.id,
        email: result.user.email,
        authRole: userRole,
      },
    };
  } catch {
    return { session: null };
  }
}
