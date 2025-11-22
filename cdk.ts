#!/usr/bin/env bun
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { SamsApiStack } from "./lib/sams-api-stack";

const app = new cdk.App();

// Determine environment from CDK_ENVIRONMENT (defaults to dev)
const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";

// Validate production deployment requirements
if (isProd) {
	if (!process.env.PROD_AWS_ACCOUNT) {
		throw new Error("❌ PROD_AWS_ACCOUNT environment variable is required for production deployment");
	}
}

// Environment-specific configuration
const stackName = isProd ? "SamsApiStack-Prod" : "SamsApiStack-Dev";
const awsAccount = isProd ? process.env.PROD_AWS_ACCOUNT : process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION || "eu-central-1";

new SamsApiStack(app, stackName, {
	env: {
		account: awsAccount,
		region: awsRegion,
	},
	description: `SAMS API Services (${environment})`,
	tags: {
		Environment: environment,
		ManagedBy: "AWS CDK",
	},
	// Pass environment to stack for conditional resource configuration
	stackProps: {
		environment,
		isProd,
	},
});
