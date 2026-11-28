import { describe, expect, it } from "vitest";
import { wrapNitroLambdaHandlerSource } from "./sentryLambdaRollupPlugin";

describe("wrapNitroLambdaHandlerSource", () => {
  it("wraps the Nitro Lambda handler export", () => {
    const input = `export const handler = awslambda.streamifyResponse(fn);`;
    const output = wrapNitroLambdaHandlerSource(input);

    expect(output).toContain('from "@sentry/aws-serverless"');
    expect(output).toContain(
      "__vcmSentryWrapHandler(awslambda.streamifyResponse(fn), { captureTimeoutWarning: true })",
    );
  });

  it("wraps Nitro async function handler exports", () => {
    const input = `async function handler(event, context) {
  return handleLambdaEvent(app.fetch, event, context);
}
export { handler };`;
    const output = wrapNitroLambdaHandlerSource(input);

    expect(output).toContain("__vcmRawLambdaHandler(");
    expect(output).toContain(
      "const handler = __vcmSentryWrapHandler(__vcmRawLambdaHandler, { captureTimeoutWarning: true })",
    );
  });

  it("leaves sources without a handler export unchanged", () => {
    const input = "export const foo = 1;";
    expect(wrapNitroLambdaHandlerSource(input)).toBe(input);
  });
});
