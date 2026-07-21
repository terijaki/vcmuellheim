import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { createTestApp } from "../test-helpers";
import { VcmNodejsFunction } from "./vcm-nodejs-function";

function createTemplate(props?: Partial<ConstructorParameters<typeof VcmNodejsFunction>[2]>) {
  const app = createTestApp();
  const stack = new cdk.Stack(app, "TestStack");
  new VcmNodejsFunction(stack, "TestFn", {
    namespace: "sams",
    name: "my-func",
    entry: "lambda/sams/sams-clubs-sync.ts",
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

describe("VcmNodejsFunction", () => {
  describe("Lambda function defaults", () => {
    it("creates a Lambda function and a log group", () => {
      const template = createTemplate();
      template.resourceCountIs("AWS::Lambda::Function", 1);
      template.resourceCountIs("AWS::Logs::LogGroup", 1);
    });

    it("applies default timeout, memory and runtime", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 30,
        MemorySize: 512,
        Runtime: "nodejs24.x",
        Handler: "index.handler",
      });
    });
  });

  describe("CloudWatch log group", () => {
    it("sets retention to two months", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        RetentionInDays: 60,
      });
    });

    it("sets removal policy to DESTROY", () => {
      const template = createTemplate();
      template.hasResource("AWS::Logs::LogGroup", {
        DeletionPolicy: "Delete",
        UpdateReplacePolicy: "Delete",
      });
    });
  });

  describe("Function naming — no branch (main)", () => {
    it("uses environment without branch suffix for function name", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-my-func-dev",
      });
    });

    it("uses environment without branch suffix for log group name", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/vcm/dev/sams/my-func",
      });
    });
  });

  describe("Function naming — feature branch", () => {
    beforeEach(() => {
      process.env.CDK_BRANCH_OVERWRITE = "feature-xyz";
    });

    it("appends branch suffix to function name", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-my-func-dev-feature-xyz",
      });
    });

    it("appends branch suffix to log group name", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/vcm/dev-feature-xyz/sams/my-func",
      });
    });
  });

  describe("Function naming — production", () => {
    beforeEach(() => {
      process.env.CDK_ENVIRONMENT = "prod";
    });

    it("uses prod environment in function name without branch suffix", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-my-func-prod",
      });
    });

    it("uses prod environment in log group name without branch suffix", () => {
      const template = createTemplate();
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/vcm/prod/sams/my-func",
      });
    });
  });

  describe("Bundling options", () => {
    it("allows caller to extend bundling config", () => {
      const app = createTestApp();
      const stack = new cdk.Stack(app, "TestStack");
      // Just verify construction succeeds with additional bundling props
      expect(() => {
        new VcmNodejsFunction(stack, "TestFn", {
          namespace: "sams",
          name: "my-func",
          entry: "lambda/sams/sams-clubs-sync.ts",
          bundling: {
            externalModules: ["@aws-sdk/*", "some-extra-module"],
          },
        });
      }).not.toThrow();
    });
  });
});
