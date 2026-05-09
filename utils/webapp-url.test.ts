import { describe, expect, it } from "vite-plus/test";
import { buildWebappDomain, buildWebappUrl } from "./webapp-url";

describe("buildWebappDomain", () => {
  it("returns root domain for production", () => {
    expect(buildWebappDomain("prod", "")).toBe("vcmuellheim.de");
  });

  it("returns root domain for production even with a branch", () => {
    expect(buildWebappDomain("prod", "some-branch")).toBe("vcmuellheim.de");
  });

  it("returns dev domain for dev on main branch (empty string)", () => {
    expect(buildWebappDomain("dev", "")).toBe("dev.new.vcmuellheim.de");
  });

  it("returns branch-prefixed domain for dev feature branch", () => {
    expect(buildWebappDomain("dev", "email-proxy")).toBe("dev-email-proxy.new.vcmuellheim.de");
  });
});

describe("buildWebappUrl", () => {
  it("returns https URL with correct domain for prod", () => {
    expect(buildWebappUrl("prod", "")).toBe("https://vcmuellheim.de");
  });

  it("returns https URL with dev domain for main branch", () => {
    expect(buildWebappUrl("dev", "")).toBe("https://dev.new.vcmuellheim.de");
  });

  it("returns https URL with branch prefix for feature branch", () => {
    expect(buildWebappUrl("dev", "voluneer-events")).toBe(
      "https://dev-voluneer-events.new.vcmuellheim.de",
    );
  });
});
