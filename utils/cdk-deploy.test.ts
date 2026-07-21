import { describe, expect, it } from "vite-plus/test";
import { shouldDeployAccountOpsStacks } from "./cdk-deploy";

describe("shouldDeployAccountOpsStacks", () => {
  it("deploys for production regardless of branch", () => {
    expect(shouldDeployAccountOpsStacks({ isProd: true, branch: "" })).toBe(true);
    expect(shouldDeployAccountOpsStacks({ isProd: true, branch: "feat-foo" })).toBe(true);
  });

  it("deploys for shared dev when branch is empty (main)", () => {
    expect(shouldDeployAccountOpsStacks({ isProd: false, branch: "" })).toBe(true);
  });

  it("skips for feature branches in dev", () => {
    expect(shouldDeployAccountOpsStacks({ isProd: false, branch: "feat-foo" })).toBe(false);
  });
});
