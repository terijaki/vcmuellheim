import { describe, expect, it } from "vite-plus/test";
import { getCdkNaming } from "./cdk-naming";

describe("getCdkNaming", () => {
  describe("prod", () => {
    it("returns Prod stack names with no branch suffix", () => {
      const { stackName } = getCdkNaming(true, "");
      expect(stackName("WebAppStack")).toBe("WebAppStack-Prod");
      expect(stackName("ContentDbStack")).toBe("ContentDbStack-Prod");
    });

    it("ignores the branch argument", () => {
      const { stackName } = getCdkNaming(true, "feature-foo");
      expect(stackName("WebAppStack")).toBe("WebAppStack-Prod");
    });

    it("returns envLabel 'prod'", () => {
      const { envLabel } = getCdkNaming(true, "");
      expect(envLabel).toBe("prod");
    });
  });

  describe("dev", () => {
    it("appends the branch to stack names", () => {
      const { stackName } = getCdkNaming(false, "feature-foo");
      expect(stackName("WebAppStack")).toBe("WebAppStack-Dev-feature-foo");
      expect(stackName("ContentDbStack")).toBe("ContentDbStack-Dev-feature-foo");
    });

    it("falls back to 'main' when branch is empty", () => {
      const { stackName } = getCdkNaming(false, "");
      expect(stackName("WebAppStack")).toBe("WebAppStack-Dev-main");
    });

    it("returns envLabel with branch", () => {
      const { envLabel } = getCdkNaming(false, "feature-foo");
      expect(envLabel).toBe("dev-feature-foo");
    });

    it("returns envLabel 'dev-main' when branch is empty", () => {
      const { envLabel } = getCdkNaming(false, "");
      expect(envLabel).toBe("dev-main");
    });
  });
});
