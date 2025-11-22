import "dotenv/config";
import { execSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import { SamsApiStack } from "./lib/sams-api-stack";

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
const stackName = isProd ? `SamsApiStack-Prod${branchSuffix}` : `SamsApiStack-Dev${branchSuffix}`;
const awsRegion = process.env.CDK_REGION || "eu-central-1";

new SamsApiStack(app, stackName, {
	env: {
		account: process.env.CDK_ACCOUNT,
		region: awsRegion,
	},
	description: `SAMS API Services (${environment}${branchSuffix})`,
	tags: {
		Environment: environment,
		ManagedBy: "AWS CDK",
		Branch: currentBranch,
	},
	// Pass environment to stack for conditional resource configuration
	stackProps: {
		environment,
		branch,
	},
});
