import { describe, expect, it } from "vite-plus/test";
import { clubLogoProxyUrl } from "./club-logo";

describe("clubLogoProxyUrl", () => {
  it("builds a same-origin CloudFront-cached logo path from clubUuid", () => {
    expect(clubLogoProxyUrl("club-vc-muellheim")).toBe(
      "/api/sams/logos?clubUuid=club-vc-muellheim",
    );
  });
});
