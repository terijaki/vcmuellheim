import { describe, expect, it } from "vite-plus/test";
import { hasAuthSessionCookie, publicHomeCacheControl } from "./public-document-cache";

describe("publicHomeCacheControl", () => {
  it("caches anonymous homepage GETs at the edge", () => {
    expect(publicHomeCacheControl("GET", "/", null)).toBe(
      "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    );
  });

  it("does not cache a signed-in homepage", () => {
    expect(publicHomeCacheControl("GET", "/", "__Secure-better-auth.session_token=abc")).toBe(
      "private, no-store",
    );
  });

  it("leaves other requests alone", () => {
    expect(publicHomeCacheControl("GET", "/teams", null)).toBeNull();
    expect(publicHomeCacheControl("POST", "/", null)).toBeNull();
  });
});

describe("hasAuthSessionCookie", () => {
  it("reads session names from the Cookie request header, including httpOnly prefixes", () => {
    expect(hasAuthSessionCookie("__Secure-better-auth.session_token=abc")).toBe(true);
    expect(hasAuthSessionCookie("better-auth.session_data=xyz")).toBe(true);
  });

  it("treats an empty document.cookie string as unsigned", () => {
    expect(hasAuthSessionCookie("")).toBe(false);
    expect(hasAuthSessionCookie(null)).toBe(false);
  });
});
