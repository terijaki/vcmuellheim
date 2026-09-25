import { describe, expect, it } from "vite-plus/test";
import { publicHomeCacheControl } from "./public-document-cache";

describe("publicHomeCacheControl", () => {
  it("caches anonymous homepage GETs at the edge", () => {
    expect(publicHomeCacheControl("GET", "/", null)).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=86400",
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
