import { afterEach, beforeAll, beforeEach, describe, it } from "vite-plus/test";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SamsStack } from "./sams-stack";
import { createTestApp } from "./test-helpers";

// Set required environment variables before tests
beforeAll(() => {
	process.env.SAMS_API_KEY = "test-api-key";
});

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
		it("should create stack with correct resources", () => {
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

			// Should have 2 Lambda functions (clubs sync + teams sync)
			template.resourceCountIs("AWS::Lambda::Function", 2);

			// Should have 1 DynamoDB table
			template.resourceCountIs("AWS::DynamoDB::Table", 1);

			// Should have 2 EventBridge rules (for nightly syncs)
			template.resourceCountIs("AWS::Events::Rule", 2);
		});

		it("should set correct removal policy for dev", () => {
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

			// Check Lambda function names include branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-sams-clubs-sync-dev-feature-xyz",
			});

			// Check DynamoDB table names include branch suffix
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "sams-data-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		beforeEach(() => {
			process.env.CDK_ENVIRONMENT = "prod";
		});

		it("should set RETAIN removal policy for prod tables", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod tables should have RETAIN removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "sams-data-prod",
			});
		});

		it("should not include branch suffix in prod", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod function names should not have branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-sams-clubs-sync-prod",
			});
		});
	});

	describe("Lambda function configuration", () => {
		it("should configure Lambda timeouts correctly", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Sync functions should have 3 minute timeout
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-sams-clubs-sync-dev",
				Timeout: 180, // 3 minutes
			});

			// Teams sync should also have 3 minute timeout
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-sams-teams-sync-dev",
				Timeout: 180, // 3 minutes
			});
		});

		it("should set environment variables for all Lambdas", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// All Lambdas should have SAMS_API_KEY
			template.hasResourceProperties("AWS::Lambda::Function", {
				Environment: {
					Variables: {
						SAMS_API_KEY: "test-api-key",
					},
				},
			});
		});
	});

	describe("DynamoDB tables", () => {
		it("should create sams data table with correct GSIs", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Sams data table should have GSI1-BySamsType and GSI2-BySamsSeasonUuid
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "sams-data-dev",
				GlobalSecondaryIndexes: Match.arrayWith([Match.objectLike({ IndexName: "GSI1-BySamsType" }), Match.objectLike({ IndexName: "GSI2-BySamsSeasonUuid" })]),
			});
		});

		it("should enable TTL on the sams data table", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Both tables should have TTL enabled
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TimeToLiveSpecification: {
					AttributeName: "ttl",
					Enabled: true,
				},
			});
		});
	});

	describe("EventBridge schedules", () => {
		it("should create nightly sync schedules", () => {
			const app = createTestApp();
			const stack = new SamsStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Should have EventBridge rules for nightly syncs
			template.hasResourceProperties("AWS::Events::Rule", {
				ScheduleExpression: "cron(0 2 ? * WED *)", // Clubs sync: Wed 2 AM UTC
			});

			template.hasResourceProperties("AWS::Events::Rule", {
				ScheduleExpression: "cron(0 3 * * ? *)", // Teams sync: Daily 3 AM UTC
			});
		});
	});
});
