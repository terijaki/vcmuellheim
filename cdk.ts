import "dotenv/config";
import { execSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "./lib/api-stack";
import { ContentDbStack } from "./lib/content-db-stack";
import { SamsApiStack } from "./lib/sams-api-stack";
import { SocialMediaStack } from "./lib/social-media-stack";

const app = new cdk.App();

// Determine environment from CDK_ENVIRONMENT (defaults to dev)
const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";

/** Get current Git branch name */
const getCurrentBranch = (): string => {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
	} catch {
		return "unknown";
	}
};

/** Sanitize branch name for AWS resource naming (alphanumeric and hyphens only) */
const sanitizeBranchName = (branch: string): string => {
	return branch
		.replace(/[^a-zA-Z0-9-]/g, "-")
		.replace(/--+/g, "-")
		.substring(0, 20);
};

const currentBranch = getCurrentBranch();
const isMainBranch = currentBranch === "main";
const branch = !isMainBranch ? sanitizeBranchName(currentBranch) : "";
const branchSuffix = branch ? `-${branch}` : "";

// Environment-specific configuration
const contentDbStackName = isProd ? `ContentDbStack-Prod${branchSuffix}` : `ContentDbStack-Dev${branchSuffix}`;
const apiStackName = isProd ? `ApiStack-Prod${branchSuffix}` : `ApiStack-Dev${branchSuffix}`;
const samsStackName = isProd ? `SamsApiStack-Prod${branchSuffix}` : `SamsApiStack-Dev${branchSuffix}`;
const socialMediaStackName = isProd ? `SocialMediaStack-Prod${branchSuffix}` : `SocialMediaStack-Dev${branchSuffix}`;
const awsRegion = process.env.CDK_REGION || "eu-central-1";

const commonStackProps = {
	env: {
		account: process.env.CDK_ACCOUNT,
		region: awsRegion,
	},
	tags: {
		Environment: environment,
		ManagedBy: "AWS CDK",
		Branch: currentBranch,
	},
	stackProps: {
		environment,
		branch,
	},
};

const contentDbStack = new ContentDbStack(app, contentDbStackName, {
	...commonStackProps,
	description: `Content Database Tables (${environment}${branchSuffix})`,
});

new ApiStack(app, apiStackName, {
	...commonStackProps,
	description: `tRPC API & Cognito (${environment}${branchSuffix})`,
	contentDbStack: {
		newsTable: contentDbStack.newsTable,
		eventsTable: contentDbStack.eventsTable,
		teamsTable: contentDbStack.teamsTable,
		membersTable: contentDbStack.membersTable,
		mediaTable: contentDbStack.mediaTable,
		sponsorsTable: contentDbStack.sponsorsTable,
	},
});

new SamsApiStack(app, samsStackName, {
	...commonStackProps,
	description: `SAMS API Services (${environment}${branchSuffix})`,
});

new SocialMediaStack(app, socialMediaStackName, {
	...commonStackProps,
	description: `Social Media API Services (${environment}${branchSuffix})`,
});
