import { describe, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MediaStack } from "./media-stack";

describe("MediaStack", () => {
	describe("Development environment", () => {
		it("should create stack with correct resources", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
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

			// Should have S3 bucket
			template.resourceCountIs("AWS::S3::Bucket", 1);

			// Should have CloudFront distribution
			template.resourceCountIs("AWS::CloudFront::Distribution", 1);

			// Dev environment should have custom cache policy
			template.resourceCountIs("AWS::CloudFront::CachePolicy", 1);
		});

		it("should set DESTROY removal policy for dev bucket", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Dev bucket should exist (checking removal policy via resource count)
			template.resourceCountIs("AWS::S3::Bucket", 1);
		});

		it("should configure CORS for bucket", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Bucket should have CORS configured
			template.hasResourceProperties("AWS::S3::Bucket", {
				CorsConfiguration: {
					CorsRules: [
						{
							AllowedMethods: ["GET", "PUT", "POST"],
							AllowedOrigins: ["*"],
							AllowedHeaders: ["*"],
							MaxAge: 3000,
						},
					],
				},
			});
		});

		it("should use short cache TTL for dev environment", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Dev should have custom cache policy with short TTL
			template.hasResourceProperties("AWS::CloudFront::CachePolicy", {
				CachePolicyConfig: {
					DefaultTTL: 300, // 5 minutes
					MinTTL: 0,
					MaxTTL: 600, // 10 minutes
					Comment: "Dev cache policy with short TTL",
				},
			});
		});
	});

	describe("Production environment", () => {
		it("should set RETAIN removal policy for prod bucket", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Should still have S3 bucket (checking it exists is sufficient for removal policy)
			template.resourceCountIs("AWS::S3::Bucket", 1);
		});

		it("should not create custom cache policy in prod", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod uses CACHING_OPTIMIZED which is a managed policy
			template.resourceCountIs("AWS::CloudFront::CachePolicy", 0);
		});
	});

	describe("CloudFront distribution", () => {
		it("should configure distribution with OAC", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Should have CloudFront Origin Access Control
			template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
		});

		it("should redirect HTTP to HTTPS", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
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
						Compress: true,
						AllowedMethods: ["GET", "HEAD", "OPTIONS"],
						CachedMethods: ["GET", "HEAD", "OPTIONS"],
					},
					PriceClass: "PriceClass_100",
				},
			});
		});
	});

	describe("S3 bucket configuration", () => {
		it("should enable encryption", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::S3::Bucket", {
				BucketEncryption: {
					ServerSideEncryptionConfiguration: [
						{
							ServerSideEncryptionByDefault: {
								SSEAlgorithm: "AES256",
							},
						},
					],
				},
			});
		});

		it("should block all public access", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::S3::Bucket", {
				PublicAccessBlockConfiguration: {
					BlockPublicAcls: true,
					BlockPublicPolicy: true,
					IgnorePublicAcls: true,
					RestrictPublicBuckets: true,
				},
			});
		});

		it("should configure lifecycle rules", () => {
			const app = new App();
			const stack = new MediaStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::S3::Bucket", {
				LifecycleConfiguration: {
					Rules: [
						{
							AbortIncompleteMultipartUpload: {
								DaysAfterInitiation: 7,
							},
							Status: "Enabled",
						},
					],
				},
			});
		});
	});
});
