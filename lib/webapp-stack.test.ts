import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Match, Template } from "aws-cdk-lib/assertions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CACHE_TABLE_ENV_VAR, CONTENT_TABLE_ENV_VAR } from "./db/env";
import { createTestApp } from "./test-helpers";

const { buildMock } = vi.hoisted(() => ({
	buildMock: vi.fn(() => Buffer.from("")),
}));
const testEnv = {
	account: "123456789012",
	region: "eu-central-1",
};
let cleanupOutputFixtures = () => {};

vi.mock("node:child_process", async () => {
	const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
	return {
		...actual,
		execFileSync: buildMock,
	};
});

const { WebAppStack } = await import("./webapp-stack");

function ensureNitroOutputFixtures() {
	const serverDir = join("app", ".output", "server");
	const publicDir = join("app", ".output", "public");
	const serverEntryFile = join(serverDir, "index.mjs");
	const publicMarkerFile = join(publicDir, ".test-placeholder");

	const createdPaths: string[] = [];

	if (!existsSync(serverDir)) {
		mkdirSync(serverDir, { recursive: true });
		createdPaths.push(serverDir);
	}

	if (!existsSync(publicDir)) {
		mkdirSync(publicDir, { recursive: true });
		createdPaths.push(publicDir);
	}

	if (!existsSync(serverEntryFile)) {
		writeFileSync(serverEntryFile, 'export const handler = () => ({ statusCode: 200, body: "ok" });\n');
		createdPaths.push(serverEntryFile);
	}

	if (!existsSync(publicMarkerFile)) {
		writeFileSync(publicMarkerFile, "fixture\n");
		createdPaths.push(publicMarkerFile);
	}

	return () => {
		for (const path of [...createdPaths].reverse()) {
			rmSync(path, { recursive: true, force: true });
		}
	};
}

function createDependencies() {
	return {
		contentTableName: "vcm-content-dev",
		mediaBucketName: "vcmuellheim-media-dev",
	};
}

describe("WebAppStack", () => {
	beforeEach(() => {
		buildMock.mockClear();
		cleanupOutputFixtures = ensureNitroOutputFixtures();
		process.env.BETTER_AUTH_SECRET = "test-auth-secret";
		delete process.env.CDK_DESTROY;
		Reflect.deleteProperty(process.env, "SAMS_API_KEY");
	});

	afterEach(() => {
		cleanupOutputFixtures();
		cleanupOutputFixtures = () => {};
	});

	it("builds the webapp once and creates the core dev resources", () => {
		const app = createTestApp();
		const dependencies = createDependencies();

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
			"vp",
			["build"],
			expect.objectContaining({
				cwd: process.cwd(),
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
		const dependencies = createDependencies();

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
					[CACHE_TABLE_ENV_VAR]: Match.anyValue(),
					APP_BASE_URL: "https://dev.new.vcmuellheim.de",
					BETTER_AUTH_SECRET: "test-auth-secret",
					CDK_ENVIRONMENT: "dev",
					MEDIA_CLOUDFRONT_URL: "https://media.example.com",

					MEDIA_BUCKET_NAME: Match.anyValue(),
					NODE_ENV: "production",
					SAMS_TABLE_NAME: Match.anyValue(),
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

	it("passes BRANCH_NAME to the webapp Lambda for branch deployments", () => {
		const app = createTestApp();
		const dependencies = createDependencies();

		const stack = new WebAppStack(app, "TestStack", {
			env: testEnv,
			stackProps: {
				environment: "dev",
				branch: "cool-feature",
			},
			...dependencies,
		});

		const template = Template.fromStack(stack);

		template.hasResourceProperties("AWS::Lambda::Function", {
			FunctionName: "vcm-webapp-dev-cool-feature",
			Environment: {
				Variables: Match.objectLike({ APP_BASE_URL: "https://dev-cool-feature.new.vcmuellheim.de", BRANCH_NAME: "cool-feature", CDK_ENVIRONMENT: "dev" }),
			},
		});
	});

	it("maps all public folders to CloudFront S3 behaviors", () => {
		const app = createTestApp();
		const dependencies = createDependencies();

		const stack = new WebAppStack(app, "TestStack", {
			env: testEnv,
			stackProps: {
				environment: "dev",
				branch: "",
			},
			...dependencies,
		});

		const template = Template.fromStack(stack);
		const publicFolders = readdirSync("app/public", {
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

	it("synthesizes without build output when CDK_DESTROY=true", () => {
		// Ensure no fixtures exist for this test
		cleanupOutputFixtures();
		cleanupOutputFixtures = () => {};
		process.env.CDK_DESTROY = "true";

		const app = createTestApp();
		const dependencies = createDependencies();

		expect(() => {
			new WebAppStack(app, "TestStack", {
				env: testEnv,
				stackProps: {
					environment: "dev",
					branch: "test-branch",
				},
				...dependencies,
			});
		}).not.toThrow();

		expect(buildMock).not.toHaveBeenCalled();
	});
});
