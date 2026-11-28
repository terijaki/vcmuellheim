import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("lambda Sentry environment", () => {
  beforeEach(async () => {
    const Sentry = await import("@sentry/aws-serverless");
    await Sentry.close(0);
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    const Sentry = await import("@sentry/aws-serverless");
    await Sentry.close(0);
    vi.unstubAllEnvs();
  });

  it("defaults the Sentry environment to dev when CDK_ENVIRONMENT is unset", async () => {
    Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
    process.env.NODE_ENV = "production";

    const { Sentry } = await import("./sentry");
    const options = Sentry.getClient()?.getOptions();

    expect(options?.environment).toBe("dev");
  });

  it("uses CDK_ENVIRONMENT for the Sentry environment", async () => {
    process.env.CDK_ENVIRONMENT = "prod";

    const { Sentry } = await import("./sentry");
    const options = Sentry.getClient()?.getOptions();

    expect(options?.environment).toBe("prod");
  });
});
