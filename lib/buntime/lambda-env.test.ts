import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { BUN_LAMBDA_TASK_ROOT_BUNFIG, BUN_LAMBDA_WRITABLE_ENV } from "./lambda-env";

describe("BUN_LAMBDA_WRITABLE_ENV", () => {
  it("points every cache path under /tmp", () => {
    for (const value of Object.values(BUN_LAMBDA_WRITABLE_ENV)) {
      expect(value === "/tmp" || value.startsWith("/tmp/")).toBe(true);
    }
  });
});

describe("bootstrap", () => {
  it("hard-exports writable paths before exec (no ${VAR:-...} defaults)", () => {
    const bootstrap = readFileSync(join(import.meta.dirname, "bootstrap"), "utf8");

    expect(bootstrap).toContain(
      "mkdir -p /tmp/.cache /tmp/.bun-install-cache /tmp/.bun-transpiler-cache",
    );
    expect(bootstrap).toContain("export HOME=/tmp");
    expect(bootstrap).toContain("export TMPDIR=/tmp");
    expect(bootstrap).toContain("export XDG_CACHE_HOME=/tmp/.cache");
    expect(bootstrap).toContain("export BUN_INSTALL_CACHE_DIR=/tmp/.bun-install-cache");
    expect(bootstrap).toContain(
      "export BUN_RUNTIME_TRANSPILER_CACHE_PATH=/tmp/.bun-transpiler-cache",
    );
    expect(bootstrap).not.toMatch(/\$\{[A-Z_]+:-/);
  });
});

describe("BUN_LAMBDA_TASK_ROOT_BUNFIG", () => {
  it("disables install auto so task root stays read-only friendly", () => {
    expect(BUN_LAMBDA_TASK_ROOT_BUNFIG).toContain("[install]");
    expect(BUN_LAMBDA_TASK_ROOT_BUNFIG).toContain('auto = "disable"');
  });
});
