#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { getConfig } from "../config/environment";
import { DatabaseStack } from "../lib/database-stack";
import { HostingStack } from "../lib/hosting-stack";
import { NetworkStack } from "../lib/network-stack";
import { StorageStack } from "../lib/storage-stack";

const app = new cdk.App();

// Get environment from context or default to dev
const environment = app.node.tryGetContext("environment") || "dev";
const config = getConfig(environment);

// Validate AWS account and region
if (!config.account || !config.region) {
	throw new Error("AWS account and region must be set. Use CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION environment variables.");
}

const env = {
	account: config.account,
	region: config.region,
};

// Stack naming prefix
const stackPrefix = `VCMuellheim${config.environment.charAt(0).toUpperCase() + config.environment.slice(1)}`;

// 1. Network Stack - VPC, Subnets, Security Groups
const networkStack = new NetworkStack(app, `${stackPrefix}NetworkStack`, {
	config,
	env,
	description: `Network infrastructure for vcmuellheim.de ${config.environment}`,
	tags: {
		Environment: config.environment,
		Application: "vcmuellheim",
		ManagedBy: "CDK",
	},
});

// 2. Database Stack - Aurora Serverless v2 with PostgreSQL
const databaseStack = new DatabaseStack(app, `${stackPrefix}DatabaseStack`, {
	config,
	vpc: networkStack.vpc,
	securityGroup: networkStack.databaseSecurityGroup,
	env,
	description: `Aurora PostgreSQL database for vcmuellheim.de ${config.environment}`,
	tags: {
		Environment: config.environment,
		Application: "vcmuellheim",
		ManagedBy: "CDK",
	},
});
databaseStack.addDependency(networkStack);

// 3. Storage Stack - S3, CloudFront
const storageStack = new StorageStack(app, `${stackPrefix}StorageStack`, {
	config,
	env,
	description: `Storage and CDN infrastructure for vcmuellheim.de ${config.environment}`,
	tags: {
		Environment: config.environment,
		Application: "vcmuellheim",
		ManagedBy: "CDK",
	},
});

// 4. Hosting Stack - AWS Amplify
const hostingStack = new HostingStack(app, `${stackPrefix}HostingStack`, {
	config,
	databaseSecret: databaseStack.secret,
	mediaBucketName: storageStack.mediaBucket.bucketName,
	s3AccessKeyId: storageStack.uploadAccessKey.ref,
	s3SecretAccessKey: storageStack.uploadAccessKey.attrSecretAccessKey,
	env,
	description: `Amplify hosting for vcmuellheim.de ${config.environment}`,
	tags: {
		Environment: config.environment,
		Application: "vcmuellheim",
		ManagedBy: "CDK",
	},
});
hostingStack.addDependency(databaseStack);
hostingStack.addDependency(storageStack);

app.synth();
