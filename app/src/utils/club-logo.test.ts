import { describe, expect, it } from "vite-plus/test";
import { clubLogoProxyUrl, teamLogoProxyUrl } from "./club-logo";

describe("clubLogoProxyUrl", () => {
  it("builds a same-origin CloudFront-cached logo path from clubUuid", () => {
    expect(clubLogoProxyUrl("club-vc-muellheim")).toBe(
      "/api/sams/logos?clubUuid=club-vc-muellheim",
    );
  });
});

describe("teamLogoProxyUrl", () => {
  it("builds a same-origin CloudFront-cached logo path from teamUuid", () => {
    expect(teamLogoProxyUrl("team-vcm-1")).toBe("/api/sams/team-logos?teamUuid=team-vcm-1");
  });
});
