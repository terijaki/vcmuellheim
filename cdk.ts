#!/usr/bin/env bun
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { SamsApiStack } from "./lib/sams-api-stack";

const app = new cdk.App();

// Determine environment from CDK_ENVIRONMENT (defaults to dev)
const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";

// Environment-specific configuration
const stackName = isProd ? "SamsApiStack-Prod" : "SamsApiStack-Dev";
const awsRegion = process.env.CDK_REGION || "eu-central-1";

new SamsApiStack(app, stackName, {
	env: {
		account: process.env.CDK_ACCOUNT,
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
