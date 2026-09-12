import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { createTestApp } from "../test-helpers";
import { VcmBunFunction } from "./vcm-bun-function";

function createTemplate(props?: Partial<ConstructorParameters<typeof VcmBunFunction>[2]>) {
  const app = createTestApp();
  const stack = new cdk.Stack(app, "TestStack");
  new VcmBunFunction(stack, "TestFn", {
    namespace: "media",
    name: "bun-image-processor",
    entry: "lambda/content/image-processor.ts",
    ...props,
  });
  return Template.fromStack(stack);
}

beforeEach(() => {
  process.env.CDK_ENVIRONMENT = "dev";
  process.env.CDK_BRANCH_OVERWRITE = "main";
});

afterEach(() => {
  Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
  Reflect.deleteProperty(process.env, "CDK_BRANCH_OVERWRITE");
});

describe("VcmBunFunction", () => {
  it("creates a Lambda function on provided.al2023 with a Bun layer reference", () => {
    const template = createTemplate();
    template.resourceCountIs("AWS::Lambda::Function", 1);
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "vcm-bun-image-processor-dev",
      Runtime: "provided.al2023",
      Architectures: ["x86_64"],
      Handler: "index.handler",
    });

    const functions = template.findResources("AWS::Lambda::Function");
    const fn = Object.values(functions)[0]!;
    const layers = (fn.Properties as { Layers?: unknown[] }).Layers ?? [];
    expect(layers).toHaveLength(1);
  });

  it("creates a log group with the expected name", () => {
    const template = createTemplate();
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/vcm/dev/media/bun-image-processor",
      RetentionInDays: 60,
    });
  });

  it("sets writable temp paths for the Bun runtime on Lambda", () => {
    const template = createTemplate();
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          TMPDIR: "/tmp",
          HOME: "/tmp",
          BUN_RUNTIME_TRANSPILER_CACHE_PATH: "/tmp",
        },
      },
    });
  });

  it("applies custom timeout and memory", () => {
    const template = createTemplate({
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 300,
      MemorySize: 1024,
    });
  });
});
