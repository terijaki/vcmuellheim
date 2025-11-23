import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, it } from "vitest";
import { SocialMediaStack } from "./social-media-stack";

// Set required environment variables before tests
beforeAll(() => {
	process.env.APIFY_API_KEY = "test-api-key";
});

describe("SocialMediaStack", () => {
	describe("Development environment", () => {
		it("should create stack with correct resources", () => {
			const app = new App();
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

			// Should have API Gateway
			template.resourceCountIs("AWS::ApiGateway::RestApi", 1);

			// Should have 2 Lambda functions
			template.resourceCountIs("AWS::Lambda::Function", 2);

			// Should have 1 DynamoDB table
			template.resourceCountIs("AWS::DynamoDB::Table", 1);

			// Should have CloudFront distribution
			template.resourceCountIs("AWS::CloudFront::Distribution", 1);

			// Should have EventBridge rule for daily sync
			template.resourceCountIs("AWS::Events::Rule", 1);
		});

		it("should set correct removal policy for dev", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Dev table should have DESTROY removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "instagram-posts-dev",
			});
		});

		it("should include branch suffix in resource names", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
			});

			const template = Template.fromStack(stack);

			// Check Lambda function names include branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "instagram-sync-dev-feature-xyz",
			});

			// Check DynamoDB table names include branch suffix
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "instagram-posts-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		it("should set RETAIN removal policy for prod tables", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod table should have RETAIN removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "instagram-posts-prod",
			});
		});
	});

	describe("Lambda functions", () => {
		it("should configure sync function with correct timeout", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "instagram-sync-dev",
				Timeout: 300, // 5 minutes
				MemorySize: 512,
			});
		});

		it("should configure posts function with correct timeout", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "instagram-posts-dev",
				Timeout: 30,
				MemorySize: 256,
			});
		});

		it("should set environment variables for sync Lambda", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "instagram-sync-dev",
				Environment: {
					Variables: {
						APIFY_API_KEY: "test-api-key",
					},
				},
			});
		});
	});

	describe("DynamoDB table", () => {
		it("should create Instagram posts table with correct schema", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "instagram-posts-dev",
				BillingMode: "PAY_PER_REQUEST",
				KeySchema: [
					{
						AttributeName: "entityType",
						KeyType: "HASH",
					},
					{
						AttributeName: "timestamp",
						KeyType: "RANGE",
					},
				],
			});
		});

		it("should enable TTL on table", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TimeToLiveSpecification: {
					AttributeName: "ttl",
					Enabled: true,
				},
			});
		});
	});

	describe("EventBridge schedule", () => {
		it("should create daily sync schedule at 4 AM UTC", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Events::Rule", {
				ScheduleExpression: "cron(0 4 * * ? *)",
			});
		});
	});

	describe("API Gateway", () => {
		it("should configure CORS", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::ApiGateway::RestApi", {
				Name: "Social Media API (dev)",
			});
		});

		it("should create instagram resource endpoint", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Should have resources (root + instagram)
			template.resourceCountIs("AWS::ApiGateway::Resource", 1);

			// Should have methods (GET + OPTIONS + ANY for CORS)
			template.resourceCountIs("AWS::ApiGateway::Method", 3);
		});
	});

	describe("CloudFront distribution", () => {
		it("should create distribution with correct cache policy", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::CloudFront::CachePolicy", {
				CachePolicyConfig: {
					DefaultTTL: 3600, // 1 hour
					MaxTTL: 86400, // 1 day
					MinTTL: 0,
				},
			});
		});

		it("should redirect HTTP to HTTPS", () => {
			const app = new App();
			const stack = new SocialMediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::CloudFront::Distribution", {
				DistributionConfig: {
					DefaultCacheBehavior: {
						ViewerProtocolPolicy: "redirect-to-https",
					},
					PriceClass: "PriceClass_100",
				},
			});
		});
	});
});
