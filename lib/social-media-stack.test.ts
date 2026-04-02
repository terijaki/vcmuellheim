import { describe, it } from "vite-plus/test";
import { Template } from "aws-cdk-lib/assertions";
import { SocialMediaStack } from "./social-media-stack";
import { createTestApp } from "./test-helpers";

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

			// Should have 1 Lambda function (MastodonShare only — MastodonStreamHandler requires contentTable)
			template.resourceCountIs("AWS::Lambda::Function", 1);

			// Should have no DynamoDB tables (Instagram table removed)
			template.resourceCountIs("AWS::DynamoDB::Table", 0);

			// Should have no EventBridge rules (Instagram sync removed)
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
});
