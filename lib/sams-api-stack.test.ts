import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, it } from "vitest";
import { SamsApiStack } from "./sams-api-stack";

// Set required environment variables before tests
beforeAll(() => {
	process.env.SAMS_API_KEY = "test-api-key";
	process.env.SAMS_SERVER = "test-server.com";
});

describe("SamsApiStack", () => {
	describe("Development environment", () => {
		it("should create stack with correct resources", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
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

			// Should have API Gateway
			template.resourceCountIs("AWS::ApiGateway::RestApi", 1);

			// Should have 8 Lambda functions
			template.resourceCountIs("AWS::Lambda::Function", 8);

			// Should have 2 DynamoDB tables
			template.resourceCountIs("AWS::DynamoDB::Table", 2);

			// Should have CloudFront distribution
			template.resourceCountIs("AWS::CloudFront::Distribution", 1);

			// Should have 2 EventBridge rules (for nightly syncs)
			template.resourceCountIs("AWS::Events::Rule", 2);
		});

		it("should set correct removal policy for dev", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Dev tables should have DESTROY removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "dev-sams-clubs",
			});
		});

		it("should include branch suffix in resource names", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
			});

			const template = Template.fromStack(stack);

			// Check Lambda function names include branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "dev-feature-xyz-sams-league-matches",
			});

			// Check DynamoDB table names include branch suffix
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "dev-feature-xyz-sams-clubs",
			});
		});
	});

	describe("Production environment", () => {
		it("should set RETAIN removal policy for prod tables", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod tables should have RETAIN removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "prod-sams-clubs",
			});
		});

		it("should not include branch suffix in prod", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod function names should not have branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "prod-sams-league-matches",
			});
		});
	});

	describe("Lambda function configuration", () => {
		it("should configure Lambda timeouts correctly", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Sync functions should have 10 minute timeout
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "dev-sams-clubs-sync",
				Timeout: 600, // 10 minutes
			});

			// Regular API functions should have shorter timeouts
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "dev-sams-seasons",
				Timeout: 30,
			});
		});

		it("should set environment variables for all Lambdas", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// All Lambdas should have SAMS_API_KEY and SAMS_SERVER
			template.hasResourceProperties("AWS::Lambda::Function", {
				Environment: {
					Variables: {
						SAMS_API_KEY: "test-api-key",
						SAMS_SERVER: "test-server.com",
					},
				},
			});
		});
	});

	describe("DynamoDB tables", () => {
		it("should create clubs table with correct GSIs", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Clubs table should have 3 GSIs
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "dev-sams-clubs",
				GlobalSecondaryIndexes: [{ IndexName: "associationUuid-index" }, { IndexName: "name-index" }, { IndexName: "nameSlug-index" }],
			});
		});

		it("should create teams table with correct GSIs", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Teams table should have 3 GSIs
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "dev-sams-teams",
				GlobalSecondaryIndexes: [{ IndexName: "sportsclubUuid-index" }, { IndexName: "leagueUuid-index" }, { IndexName: "nameSlug-index" }],
			});
		});

		it("should enable TTL on both tables", () => {
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
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
			const app = new App();
			const stack = new SamsApiStack(app, "TestStack", {
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
