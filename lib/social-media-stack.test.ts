import { afterEach, beforeEach, describe, it } from "vite-plus/test";
import { Template } from "aws-cdk-lib/assertions";
import { SocialMediaStack } from "./social-media-stack";
import { createTestApp } from "./test-helpers";

beforeEach(() => {
  process.env.CDK_ENVIRONMENT = "dev";
  process.env.CDK_BRANCH_OVERWRITE = "main";
});

afterEach(() => {
  Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
  process.env.CDK_BRANCH_OVERWRITE = "main";
});

describe("SocialMediaStack", () => {
  describe("Development environment", () => {
    it("should create stack with correct resources", () => {
      const app = createTestApp();
      const stack = new SocialMediaStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      // Should have no API Gateway (removed with Instagram pipeline)
      template.resourceCountIs("AWS::ApiGatewayV2::Api", 0);

      // MastodonShare + BeholdSync + social DynamoDB table
      template.resourceCountIs("AWS::Lambda::Function", 2);
      template.resourceCountIs("AWS::DynamoDB::Table", 1);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "vcm-social-dev",
        BillingMode: "PAY_PER_REQUEST",
        TimeToLiveSpecification: {
          AttributeName: "ttl",
          Enabled: true,
        },
      });

      // BeholdSync always has its schedule
      template.resourceCountIs("AWS::Events::Rule", 1);
    });
  });

  describe("Lambda functions", () => {
    it("should configure mastodon share function with correct settings", () => {
      const app = createTestApp();
      const stack = new SocialMediaStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-mastodon-share-dev",
        Timeout: 30,
        MemorySize: 512,
      });
    });

    it("should configure Behold sync function with correct settings", () => {
      const app = createTestApp();
      const stack = new SocialMediaStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-behold-sync-dev",
        Timeout: 30,
        MemorySize: 128,
        Environment: {
          Variables: {
            SOCIAL_TABLE_NAME: "vcm-social-dev",
          },
        },
      });
    });
  });

  describe("Behold sync Lambda", () => {
    it("should create BeholdSync Lambda and schedule unconditionally", () => {
      const app = createTestApp();
      const stack = new SocialMediaStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      // MastodonShare + BeholdSync (MastodonStreamHandler also needs websiteUrl)
      template.resourceCountIs("AWS::Lambda::Function", 2);
      template.resourceCountIs("AWS::DynamoDB::Table", 1);

      // One EventBridge rule for the Behold sync schedule
      template.resourceCountIs("AWS::Events::Rule", 1);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-behold-sync-dev",
        Timeout: 30,
        MemorySize: 128,
      });

      template.hasResourceProperties("AWS::Events::Rule", {
        Name: "behold-sync-schedule-dev",
        ScheduleExpression: "cron(0 7-21 * * ? *)",
      });
    });

    it("should include branch suffix in Behold sync resource names", () => {
      process.env.CDK_BRANCH_OVERWRITE = "feature-x";
      const app = createTestApp();
      const stack = new SocialMediaStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "feature-x",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-behold-sync-dev-feature-x",
      });

      template.hasResourceProperties("AWS::Events::Rule", {
        Name: "behold-sync-schedule-dev-feature-x",
      });

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "vcm-social-dev-feature-x",
      });
    });
  });
});
