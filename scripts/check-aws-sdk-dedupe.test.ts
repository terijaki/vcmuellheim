import { describe, expect, it } from "vite-plus/test";
import { findInstalledPackageVersions, uniqueVersions } from "./check-aws-sdk-dedupe";

const PACKAGES = ["@aws-sdk/lib-dynamodb", "@aws-sdk/util-dynamodb"] as const;

describe("AWS SDK / ElectroDB version dedupe", () => {
  for (const packageName of PACKAGES) {
    it(`installs a single ${packageName} version`, () => {
      const installs = findInstalledPackageVersions(packageName);
      const versions = uniqueVersions(installs);

      expect(
        versions,
        [
          `ElectroDB and app DocumentClient code must share one ${packageName} copy.`,
          "Multiple versions break ElectroDB queries (undefined LastEvaluatedKey / Item).",
          `Fix: set package.json overrides["${packageName}"] to the root dependency`,
          "version, then reinstall.",
          "",
          "Installed copies:",
          ...installs.map((install) => `- ${install.version} (${install.path})`),
        ].join("\n"),
      ).toHaveLength(1);

      expect(installs.length).toBeGreaterThan(0);
    });
  }
});
