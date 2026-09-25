import { getRequestHeader } from "@tanstack/react-start/server";
import { getSessionFn } from "../server/functions/session";
import { hasAuthSessionCookie } from "./public-document-cache";

export async function resolveRootSession() {
  if (!hasAuthSessionCookie(getRequestHeader("cookie") ?? null)) {
    return { session: null as Awaited<ReturnType<typeof getSessionFn>> };
  }
  return { session: await getSessionFn() };
}
