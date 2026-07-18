import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type InstalledPackage = {
  path: string;
  version: string;
};

/**
 * Walk nested node_modules trees and collect every installed copy of a package.
 * Used to catch ElectroDB / DocumentClient marshalling breaks when
 * `@aws-sdk/lib-dynamodb` resolves to more than one physical version.
 */
export function findInstalledPackageVersions(
  packageName: string,
  rootDir = process.cwd(),
): InstalledPackage[] {
  const segments = packageName.split("/");
  const results: InstalledPackage[] = [];

  function visitNodeModules(nodeModulesDir: string): void {
    const packageJsonPath = join(nodeModulesDir, ...segments, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        version: string;
      };
      results.push({ path: packageJsonPath, version: packageJson.version });
    }

    let entries;
    try {
      entries = readdirSync(nodeModulesDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".bin") {
        continue;
      }

      if (entry.name.startsWith("@")) {
        let scopedEntries;
        try {
          scopedEntries = readdirSync(join(nodeModulesDir, entry.name), {
            withFileTypes: true,
          });
        } catch {
          continue;
        }
        for (const scoped of scopedEntries) {
          if (!scoped.isDirectory()) {
            continue;
          }
          const nested = join(nodeModulesDir, entry.name, scoped.name, "node_modules");
          if (existsSync(nested)) {
            visitNodeModules(nested);
          }
        }
        continue;
      }

      const nested = join(nodeModulesDir, entry.name, "node_modules");
      if (existsSync(nested)) {
        visitNodeModules(nested);
      }
    }
  }

  visitNodeModules(join(rootDir, "node_modules"));
  return results;
}

export function uniqueVersions(installs: InstalledPackage[]): string[] {
  return [...new Set(installs.map((install) => install.version))].sort();
}
