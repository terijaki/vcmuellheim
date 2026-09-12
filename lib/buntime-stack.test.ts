import { describe, it } from "vite-plus/test";
import { Template } from "aws-cdk-lib/assertions";
import { BUN_TIME_LAYER_SSM_NAME, BUN_VERSION } from "@utils/buntime";
import { BunTimeStack } from "./buntime-stack";
import { createTestApp } from "./test-helpers";

describe("BunTimeStack", () => {
  it("creates a Lambda layer and SSM parameter", () => {
    const app = createTestApp();
    const stack = new BunTimeStack(app, "TestStack", {
      env: {
        account: "123456789012",
        region: "eu-central-1",
      },
      stackProps: {
        environment: "dev",
      },
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::Lambda::LayerVersion", 1);
    template.hasResourceProperties("AWS::Lambda::LayerVersion", {
      LayerName: "vcm-buntime-dev",
      CompatibleRuntimes: ["provided.al2023"],
      CompatibleArchitectures: ["x86_64"],
      Description: `Bun ${BUN_VERSION} custom runtime (classic handler(event, context))`,
    });

    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: BUN_TIME_LAYER_SSM_NAME,
      Type: "String",
    });
  });

  it("uses environment-specific layer name in prod", () => {
    const app = createTestApp();
    const stack = new BunTimeStack(app, "TestStack", {
      stackProps: {
        environment: "prod",
      },
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::LayerVersion", {
      LayerName: "vcm-buntime-prod",
    });
  });
});
