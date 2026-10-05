import { createServerFn } from "@tanstack/react-start";
import { resolveRootSession } from "../../lib/root-session.server";
import { sessionMiddleware } from "../../middleware";
import type { AdminSessionUser } from "./session-utils";

export type { AdminSessionUser } from "./session-utils";
export { mapSessionUser } from "./session-utils";

export const getSessionFn = createServerFn()
  .middleware([sessionMiddleware])
  .handler(async ({ context }): Promise<AdminSessionUser | null> => {
    if (!context.session) return null;
    return {
      id: context.session.userId,
      email: context.session.userEmail,
      authRole: context.session.userRole,
    };
  });

/** Root-route session with anonymous cookie short-circuit (SSR + client RPC). */
export const resolveRootSessionFn = createServerFn().handler(async () => resolveRootSession());
