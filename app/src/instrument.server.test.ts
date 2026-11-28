import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("instrument.server Sentry environment", () => {
  beforeEach(async () => {
    const Sentry = await import("@sentry/tanstackstart-react");
    await Sentry.close(0);
    vi.resetModules();
    vi.unstubAllEnvs();
    process.env.LAMBDA_TASK_ROOT = "/var/task";
  });

  afterEach(async () => {
    const Sentry = await import("@sentry/tanstackstart-react");
    await Sentry.close(0);
    vi.unstubAllEnvs();
    Reflect.deleteProperty(process.env, "LAMBDA_TASK_ROOT");
  });

  it("defaults the Sentry environment to dev when CDK_ENVIRONMENT is unset", async () => {
    Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
    process.env.NODE_ENV = "production";

    const Sentry = await import("@sentry/tanstackstart-react");
    await import("./instrument.server");

    expect(Sentry.getClient()?.getOptions().environment).toBe("dev");
  });

  it("uses CDK_ENVIRONMENT for the Sentry environment", async () => {
    process.env.CDK_ENVIRONMENT = "prod";

    const Sentry = await import("@sentry/tanstackstart-react");
    await import("./instrument.server");

    expect(Sentry.getClient()?.getOptions().environment).toBe("prod");
  });
});
