import { describe, expect, it } from "vite-plus/test";
import { authorizeFeatureBranchSeed, featureBranchSeedToken } from "./seed-access";

describe("authorizeFeatureBranchSeed", () => {
  const branchName = "cool-feature";
  const token = featureBranchSeedToken(branchName);

  it("hides the route in prod", () => {
    expect(
      authorizeFeatureBranchSeed({
        environment: "prod",
        branchName,
        authorizationHeader: `Bearer ${token}`,
      }),
    ).toEqual({ ok: false, status: 404 });
  });

  it("hides the route when no branch is deployed", () => {
    expect(
      authorizeFeatureBranchSeed({
        environment: "dev",
        branchName: "",
        authorizationHeader: `Bearer ${token}`,
      }),
    ).toEqual({ ok: false, status: 404 });
  });

  it("rejects a feature branch without the branch token", () => {
    expect(
      authorizeFeatureBranchSeed({
        environment: "dev",
        branchName,
        authorizationHeader: "Bearer not-the-token",
      }),
    ).toEqual({ ok: false, status: 401 });
  });

  it("allows a feature branch when the bearer token matches the branch name", () => {
    expect(
      authorizeFeatureBranchSeed({
        environment: "dev",
        branchName,
        authorizationHeader: `Bearer ${token}`,
      }),
    ).toEqual({ ok: true });
  });
});
