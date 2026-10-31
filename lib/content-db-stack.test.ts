import { describe, expect, it } from "vite-plus/test";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ContentDbStack } from "./content-db-stack";
import { ContentTableIndexes } from "./db/table-indexes";
import { createTestApp } from "./test-helpers";

describe("ContentDbStack", () => {
  describe("Development environment", () => {
    it("should create a single content table", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
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

      template.resourceCountIs("AWS::DynamoDB::Table", 1);
    });

    it("should set DESTROY removal policy for dev", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "vcm-content-dev",
      });
    });

    it("should include branch suffix in table name", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: {
          environment: "dev",
          branch: "feature-xyz",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "vcm-content-dev-feature-xyz",
      });
    });
  });

  describe("Production environment", () => {
    it("should set RETAIN removal policy for prod", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: {
          environment: "prod",
          branch: "",
        },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "vcm-content-prod",
      });
    });
  });

  describe("Table configuration", () => {
    it("should use PAY_PER_REQUEST billing", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        BillingMode: "PAY_PER_REQUEST",
      });
    });

    it("should enable DynamoDB stream", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
      });
    });

    it("should enable point-in-time recovery", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      });
    });

    it("should enable TTL on the content table", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
      });
    });

    it("should use pk/sk composite primary key", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      });
    });
  });

  describe("GSI configuration", () => {
    it("keeps the preview table indexes already deployed", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::DynamoDB::Table");
      const table = Object.values(resources)[0] as {
        Properties?: { GlobalSecondaryIndexes?: Array<{ IndexName?: string }> };
      };
      const indexes = table.Properties?.GlobalSecondaryIndexes ?? [];
      expect(indexes.map((index) => index.IndexName)).toEqual([
        ContentTableIndexes.gsi1,
        "GSI5-ByPrivateEmail",
        "GSI6-ByEventId",
      ]);
    });

    it("removes GSI4-ByIdentifier on prod", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "prod", branch: "" },
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::DynamoDB::Table");
      const table = Object.values(resources)[0] as {
        Properties?: { GlobalSecondaryIndexes?: Array<{ IndexName?: string }> };
      };
      const indexes = table.Properties?.GlobalSecondaryIndexes ?? [];
      expect(indexes.map((index) => index.IndexName)).toEqual([
        ContentTableIndexes.gsi1,
        "GSI5-ByPrivateEmail",
        "GSI6-ByEventId",
      ]);
    });

    it("should have correct key schema for GSI1 (type+date)", () => {
      const app = createTestApp();
      const stack = new ContentDbStack(app, "TestStack", {
        stackProps: { environment: "dev", branch: "" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::Table", {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: ContentTableIndexes.gsi1,
            KeySchema: [
              { AttributeName: "gsi1pk", KeyType: "HASH" },
              { AttributeName: "gsi1sk", KeyType: "RANGE" },
            ],
          }),
        ]),
      });
    });
  });
});
