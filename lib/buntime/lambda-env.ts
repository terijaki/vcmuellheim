/**
 * Environment variables that force Bun to write caches under `/tmp` on Lambda.
 *
 * `/var/task` is read-only; without these, Bun 1.4.x can fail at init with EROFS.
 * Spread caller `environment` first, then this object, so callers cannot override.
 */
export const BUN_LAMBDA_WRITABLE_ENV = {
  HOME: "/tmp",
  TMPDIR: "/tmp",
  XDG_CACHE_HOME: "/tmp/.cache",
  BUN_INSTALL_CACHE_DIR: "/tmp/.bun-install-cache",
  BUN_RUNTIME_TRANSPILER_CACHE_PATH: "/tmp/.bun-transpiler-cache",
} as const satisfies Record<string, string>;

export const BUN_LAMBDA_TASK_ROOT_BUNFIG = `[install]
auto = "disable"
`;
