import { describe, expect, it } from "vite-plus/test";
import { findInstalledPackageVersions, uniqueVersions } from "./check-aws-sdk-dedupe";

describe("AWS SDK / ElectroDB version dedupe", () => {
  it("installs a single @aws-sdk/lib-dynamodb version", () => {
    const installs = findInstalledPackageVersions("@aws-sdk/lib-dynamodb");
    const versions = uniqueVersions(installs);

    expect(
      versions,
      [
        "ElectroDB and app DocumentClient code must share one @aws-sdk/lib-dynamodb copy.",
        "Multiple versions break ElectroDB queries (undefined LastEvaluatedKey / Item).",
        'Fix: set package.json overrides["@aws-sdk/lib-dynamodb"] to the root dependency',
        "version (e.g. ^3.1085.0), then reinstall.",
        "",
        "Installed copies:",
        ...installs.map((install) => `- ${install.version} (${install.path})`),
      ].join("\n"),
    ).toHaveLength(1);

    expect(installs.length).toBeGreaterThan(0);
  });
});
