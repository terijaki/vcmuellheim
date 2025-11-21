#!/usr/bin/env bun
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { SamsApiStack } from "./lib/sams-api-stack";

const app = new cdk.App();

new SamsApiStack(app, "VCMuellheimSamsApiStack", {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION || "eu-central-1",
	},
	description: "SAMS API Services",
	tags: {
		Environment: "production",
	},
});
