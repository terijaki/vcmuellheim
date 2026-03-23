import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as childProcessActual from "node:child_process";
import { readdirSync } from "node:fs";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { CONTENT_TABLE_ENV_VAR } from "./db/env";
import { createTestApp } from "./test-helpers";

const buildMock = mock(() => Buffer.from(""));
const testEnv = {
	account: "123456789012",
	region: "eu-central-1",
};

mock.module("node:child_process", () => {
	return {
		...childProcessActual,
		execFileSync: buildMock,
	};
});

const { WebAppStack } = await import("./webapp-stack");

function createDependencies(app: cdk.App) {
	const dependencyStack = new cdk.Stack(app, "Dependencies", {
		env: testEnv,
	});

	const createTable = (id: string) =>
		new dynamodb.Table(dependencyStack, id, {
			partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
		});

	return {
		contentTable: createTable("ContentTable"),
		samsApiStack: {
			samsClubsTable: createTable("SamsClubsTable"),
			samsTeamsTable: createTable("SamsTeamsTable"),
		},
		instagramTable: createTable("InstagramTable"),
		mediaBucket: new s3.Bucket(dependencyStack, "MediaBucket"),
	};
}

describe("WebAppStack", () => {
	beforeEach(() => {
		buildMock.mockClear();
		process.env.BETTER_AUTH_SECRET = "test-auth-secret";
		delete process.env.CDK_DESTROY;
		delete process.env.SAMS_API_KEY;
		delete process.env.SAMS_SERVER;
	});

	it("builds the webapp once and creates the core dev resources", () => {
		const app = createTestApp();
		const dependencies = createDependencies(app);

		const stack = new WebAppStack(app, "TestStack", {
			env: testEnv,
			stackProps: {
				environment: "dev",
				branch: "",
			},
			...dependencies,
		});

		const template = Template.fromStack(stack);

		expect(buildMock).toHaveBeenCalledTimes(1);
		expect(buildMock).toHaveBeenCalledWith(
			"bun",
			["run", "build"],
			expect.objectContaining({
				cwd: process.cwd(),
				env: expect.objectContaining({
					VITE_CDK_ENVIRONMENT: "dev",
				}),
				stdio: "inherit",
			}),
		);

		template.hasResourceProperties("AWS::Lambda::Function", {
			FunctionName: "vcm-webapp-dev",
		});
		template.resourceCountIs("AWS::Lambda::Url", 1);
		template.resourceCountIs("AWS::CloudFront::Distribution", 1);
		template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
		template.resourceCountIs("AWS::CloudFront::CachePolicy", 2);
		template.resourceCountIs("AWS::S3::Bucket", 1);
	});

	it("configures Lambda environment and CloudFront behaviors for the dev stack", () => {
		const app = createTestApp();
		const dependencies = createDependencies(app);

		const stack = new WebAppStack(app, "TestStack", {
			env: testEnv,
			stackProps: {
				environment: "dev",
				branch: "",
			},
			mediaCloudFrontUrl: "https://media.example.com",
			...dependencies,
		});

		const template = Template.fromStack(stack);

		template.hasResourceProperties("AWS::Lambda::Function", {
			FunctionName: "vcm-webapp-dev",
			Timeout: 30,
			MemorySize: 1024,
			Environment: {
				Variables: {
					[CONTENT_TABLE_ENV_VAR]: Match.anyValue(),
					BETTER_AUTH_SECRET: "test-auth-secret",
					CDK_ENVIRONMENT: "dev",
					CLOUDFRONT_URL: "https://media.example.com",
					INSTAGRAM_TABLE_NAME: Match.anyValue(),
					MEDIA_BUCKET_NAME: Match.anyValue(),
					NODE_ENV: "production",
					SAMS_CLUBS_TABLE_NAME: Match.anyValue(),
					SAMS_TEAMS_TABLE_NAME: Match.anyValue(),
				},
			},
		});

		template.hasResourceProperties("AWS::CloudFront::CachePolicy", {
			CachePolicyConfig: {
				Comment: "Dev: passthrough (no cache) for SSR + API",
				DefaultTTL: 0,
				MinTTL: 0,
				MaxTTL: 60,
				ParametersInCacheKeyAndForwardedToOrigin: {
					QueryStringsConfig: {
						QueryStringBehavior: "all",
					},
				},
			},
		});

		template.hasResourceProperties("AWS::CloudFront::Distribution", {
			DistributionConfig: {
				DefaultCacheBehavior: {
					AllowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
					Compress: true,
					ViewerProtocolPolicy: "redirect-to-https",
				},
				CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: "/assets/*" }), Match.objectLike({ PathPattern: "/_build/*" }), Match.objectLike({ PathPattern: "/docs/*" })]),
				PriceClass: "PriceClass_100",
			},
		});

		template.hasOutput("WebAppUrl", {
			Export: {
				Name: "vcm-webapp-url-dev",
			},
		});
	});

	it("maps all public folders to CloudFront S3 behaviors", () => {
		const app = createTestApp();
		const dependencies = createDependencies(app);

		const stack = new WebAppStack(app, "TestStack", {
			env: testEnv,
			stackProps: {
				environment: "dev",
				branch: "",
			},
			...dependencies,
		});

		const template = Template.fromStack(stack);
		const publicFolders = readdirSync("apps/webapp/public", {
			withFileTypes: true,
		})
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

		const missingFolders: string[] = [];

		for (const folder of publicFolders) {
			try {
				template.hasResourceProperties("AWS::CloudFront::Distribution", {
					DistributionConfig: {
						CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: `/${folder}/*` })]),
					},
				});
			} catch {
				missingFolders.push(folder);
			}
		}

		expect(missingFolders).toEqual([]);
	});
});
