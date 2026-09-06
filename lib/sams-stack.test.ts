import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SamsStack } from "./sams-stack";
import { SamsTableIndexes } from "./db/sams-electrodb-entities";
import { getProviderEventDeliveryRoleArn, SAMS_PROVIDER_ACCOUNT_ID } from "./sams-provider-env";
import { createTestApp } from "./test-helpers";

beforeEach(() => {
  process.env.CDK_ENVIRONMENT = "dev";
  process.env.CDK_BRANCH_OVERWRITE = "main";
});

afterEach(() => {
  Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
  process.env.CDK_BRANCH_OVERWRITE = "main";
});

describe("SamsStack", () => {
  describe("Development environment", () => {
    it("should create provider consumer resources", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "test-branch",
        },
      });

      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::Lambda::Function", 1);
      template.resourceCountIs("AWS::DynamoDB::Table", 1);
      template.resourceCountIs("AWS::SQS::Queue", 2);
      template.resourceCountIs("AWS::Events::Rule", 0);
    });

    it("creates a DLQ alarm without an SNS subscription when alertEmail is omitted", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "test-branch",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudWatch::Alarm", {
        AlarmName: Match.stringLikeRegexp("^sams-provider-dlq-depth-"),
      });
      template.resourceCountIs("AWS::SNS::Topic", 0);
      template.resourceCountIs("AWS::SNS::Subscription", 0);
    });

    it("emails DLQ alarms when alertEmail is set", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "test-branch",
        },
        alertEmail: "alerts@example.com",
      });

      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::SNS::Topic", 1);
      template.hasResourceProperties("AWS::SNS::Subscription", {
        Protocol: "email",
        Endpoint: "alerts@example.com",
      });
    });

    it("should include branch suffix in resource names", () => {
      process.env.CDK_BRANCH_OVERWRITE = "feature-xyz";
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "feature-xyz",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-sams-provider-processor-dev-feature-xyz",
      });

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "sams-data-dev-feature-xyz",
      });
    });

    it("should allow GitHub Actions to seed mock events on dev queues", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "feature-xyz",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::QueuePolicy", {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: "AllowGitHubActionsCdkRoleSeed",
              Action: Match.arrayWith(["sqs:SendMessage"]),
              Principal: Match.objectLike({
                AWS: Match.stringLikeRegexp("role/GitHubActionsCDKRole$"),
              }),
            }),
          ]),
        }),
      });
    });

    it("does not grant the provider account send access on non-prod queues", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "feature-xyz",
        },
      });

      const template = Template.fromStack(stack);
      const policies = JSON.stringify(template.findResources("AWS::SQS::QueuePolicy"));
      expect(policies).not.toContain("AllowSamsProviderEventBridgeSendMessage");
      expect(policies).not.toContain(SAMS_PROVIDER_ACCOUNT_ID);
    });

    it("does not put SAMS_API_KEY on the processor", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "dev",
          branch: "test-branch",
        },
      });

      const template = Template.fromStack(stack);
      const functions = template.findResources("AWS::Lambda::Function");
      for (const resource of Object.values(functions)) {
        const variables = resource.Properties?.Environment?.Variables ?? {};
        expect(variables.SAMS_API_KEY).toBeUndefined();
        expect(variables.MEDIA_BUCKET_NAME).toBeUndefined();
      }
    });
  });

  describe("Production environment", () => {
    beforeEach(() => {
      process.env.CDK_ENVIRONMENT = "prod";
    });

    it("should set RETAIN removal policy for prod tables and queues", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        stackProps: {
          environment: "prod",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "sams-data-prod",
      });

      template.hasResourceProperties("AWS::SQS::Queue", {
        QueueName: "sams-provider-events-prod",
      });
    });

    it("should allow provider EventBridge to send messages on prod queue", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        stackProps: {
          environment: "prod",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::QueuePolicy", {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: "AllowSamsProviderEventBridgeSendMessage",
              Action: "sqs:SendMessage",
              Principal: {
                AWS: Match.objectLike({
                  "Fn::Join": Match.arrayWith([
                    "",
                    Match.arrayWith([`:iam::${SAMS_PROVIDER_ACCOUNT_ID}:root`]),
                  ]),
                }),
              },
              Condition: {
                ArnEquals: {
                  "aws:PrincipalArn": getProviderEventDeliveryRoleArn(),
                },
              },
            }),
          ]),
        }),
      });
    });

    it("does not put SAMS_API_KEY on the prod processor", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        stackProps: {
          environment: "prod",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);
      const functions = template.findResources("AWS::Lambda::Function");
      for (const resource of Object.values(functions)) {
        const variables = resource.Properties?.Environment?.Variables ?? {};
        expect(variables.SAMS_API_KEY).toBeUndefined();
        expect(variables.MEDIA_BUCKET_NAME).toBeUndefined();
      }
    });

    it("wires match Mastodon queue env/IAM when queue name is set", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        env: {
          account: "123456789012",
          region: "eu-central-1",
        },
        stackProps: {
          environment: "prod",
          branch: "",
        },
        matchMastodonQueueName: "vcm-match-mastodon-prod",
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "vcm-sams-provider-processor-prod",
        Environment: {
          Variables: Match.objectLike({
            MATCH_MASTODON_QUEUE_URL:
              "https://sqs.eu-central-1.amazonaws.com/123456789012/vcm-match-mastodon-prod",
            CDK_ENVIRONMENT: "prod",
          }),
        },
      });

      const policyJson = JSON.stringify(template.findResources("AWS::IAM::Policy"));
      expect(policyJson).toContain("sqs:SendMessage");
      expect(policyJson).toContain(":vcm-match-mastodon-prod");
      expect(policyJson).not.toContain("lambda:InvokeFunction");
      expect(policyJson).not.toContain(":table/vcm-social-prod");
    });
  });

  describe("DynamoDB tables", () => {
    it("should create sams data table with the active GSI", () => {
      const app = createTestApp();
      const stack = new SamsStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "sams-data-dev",
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({ IndexName: SamsTableIndexes.gsi1 }),
        ]),
      });
    });
  });
});
