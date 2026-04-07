import { describe, it } from "vite-plus/test";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Template } from "aws-cdk-lib/assertions";
import { SocialMediaStack } from "./social-media-stack";
import { createTestApp } from "./test-helpers";

/** Create a minimal DynamoDB table in a separate stack for cross-stack references in tests. */
function createTestContentTable(app: cdk.App): dynamodb.ITable {
	const tableStack = new cdk.Stack(app, "TestTableStack");
	return new dynamodb.Table(tableStack, "ContentTable", {
		tableName: "test-content-table",
		partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
		sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
		billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
	});
}

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

			// Should have 1 Lambda function (MastodonShare only — BeholdSync and MastodonStreamHandler require contentTable)
			template.resourceCountIs("AWS::Lambda::Function", 1);

			// Should have no DynamoDB tables (Instagram table removed)
			template.resourceCountIs("AWS::DynamoDB::Table", 0);

			// Should have no EventBridge rules (BeholdSync requires contentTable; MastodonShare has no schedule)
			template.resourceCountIs("AWS::Events::Rule", 0);
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
				FunctionName: "mastodon-share-dev",
				Timeout: 60,
				MemorySize: 512,
			});
		});
	});

	describe("Behold sync Lambda", () => {
		it("should create BeholdSync Lambda and schedule when contentTable is provided", () => {
			const app = createTestApp();
			const contentTable = createTestContentTable(app);
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentTable,
			});

			const template = Template.fromStack(stack);

			// MastodonShare + BeholdSync (MastodonStreamHandler also needs websiteUrl)
			template.resourceCountIs("AWS::Lambda::Function", 2);

			// One EventBridge rule for the Behold sync schedule
			template.resourceCountIs("AWS::Events::Rule", 1);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "behold-sync-dev",
				Timeout: 30,
				MemorySize: 256,
			});

			template.hasResourceProperties("AWS::Events::Rule", {
				Name: "behold-sync-schedule-dev",
				ScheduleExpression: "cron(0 10,14,18 * * ? *)",
			});
		});

		it("should include branch suffix in Behold sync resource names", () => {
			const app = createTestApp();
			const contentTable = createTestContentTable(app);
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-x",
				},
				contentTable,
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "behold-sync-dev-feature-x",
			});

			template.hasResourceProperties("AWS::Events::Rule", {
				Name: "behold-sync-schedule-dev-feature-x",
			});
		});
	});
});
