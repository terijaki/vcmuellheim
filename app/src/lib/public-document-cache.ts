const HOME_CACHE_CONTROL = "public, max-age=0, s-maxage=120, stale-while-revalidate=86400";
const PRIVATE_CACHE_CONTROL = "private, no-store";

function hasAuthSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const name = part.trim().split("=")[0] ?? "";
    return name.includes("better-auth.session");
  });
}

/** Cache-Control for the public homepage document, or null when this request should stay untouched. */
export function publicHomeCacheControl(
  method: string,
  pathname: string,
  cookieHeader: string | null,
): string | null {
  if (method !== "GET" || pathname !== "/") return null;
  if (hasAuthSessionCookie(cookieHeader)) return PRIVATE_CACHE_CONTROL;
  return HOME_CACHE_CONTROL;
}
