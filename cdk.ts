import "dotenv/config";
import { getSanitizedBranch } from "@utils/git";
import * as cdk from "aws-cdk-lib";
import { DNS } from "@/project.config";
import { ApiStack } from "./lib/api-stack";
import { BudgetStack } from "./lib/budget-stack";
import { CmsStack } from "./lib/cms-stack";
import { ContentDbStack } from "./lib/content-db-stack";
import { DnsStack } from "./lib/dns-stack";
import { MediaStack } from "./lib/media-stack";
import { SamsApiStack } from "./lib/sams-api-stack";
import { SocialMediaStack } from "./lib/social-media-stack";

const app = new cdk.App();

const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";

const branch = getSanitizedBranch();
const branchSuffix = branch ? `-${branch}` : "";

// Environment-specific configuration
const contentDbStackName = isProd ? `ContentDbStack-Prod${branchSuffix}` : `ContentDbStack-Dev${branchSuffix}`;
const mediaStackName = isProd ? `MediaStack-Prod${branchSuffix}` : `MediaStack-Dev${branchSuffix}`;
const cmsStackName = isProd ? `CmsStack-Prod${branchSuffix}` : `CmsStack-Dev${branchSuffix}`;
const apiStackName = isProd ? `ApiStack-Prod${branchSuffix}` : `ApiStack-Dev${branchSuffix}`;
const samsStackName = isProd ? `SamsApiStack-Prod${branchSuffix}` : `SamsApiStack-Dev${branchSuffix}`;
const socialMediaStackName = isProd ? `SocialMediaStack-Prod${branchSuffix}` : `SocialMediaStack-Dev${branchSuffix}`;
const dnsStackName = isProd ? `DnsStack-Prod${branchSuffix}` : `DnsStack-Dev${branchSuffix}`;
const budgetStackName = isProd ? `BudgetStack-Prod${branchSuffix}` : `BudgetStack-Dev${branchSuffix}`;
const awsRegion = process.env.CDK_REGION || "eu-central-1";

const commonStackProps = {
	env: {
		account: process.env.CDK_ACCOUNT,
		region: awsRegion,
	},
	tags: {
		Environment: environment,
		ManagedBy: "AWS CDK",
		Branch: branch || "main",
	},
	stackProps: {
		environment,
		branch,
	},
};

const dnsStack = new DnsStack(app, dnsStackName, {
	...commonStackProps,
	description: `DNS & Route53 (${environment}${branchSuffix})`,
	hostedZoneId: DNS.hostedZoneId,
	hostedZoneName: DNS.hostedZoneName,
	certificateArn: DNS.certificateArn,
	cloudFrontCertificateArn: DNS.cloudFrontCertificateArn,
});

const contentDbStack = new ContentDbStack(app, contentDbStackName, {
	...commonStackProps,
	description: `Content Database Tables (${environment}${branchSuffix})`,
});

const mediaStack = new MediaStack(app, mediaStackName, {
	...commonStackProps,
	description: `Media Storage (S3) (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
});

const cmsStack = new CmsStack(app, cmsStackName, {
	...commonStackProps,
	description: `Admin CMS (S3 + CloudFront) (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
});

const samsApiStack = new SamsApiStack(app, samsStackName, {
	...commonStackProps,
	description: `SAMS API Services (${environment}${branchSuffix})`,
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
		busTable: contentDbStack.busTable,
		locationsTable: contentDbStack.locationsTable,
	},
	mediaBucket: mediaStack.bucket,
	samsApiUrl: samsApiStack.cloudFrontUrl,
	cloudFrontUrl: mediaStack.cloudFrontUrl,
	hostedZone: dnsStack.hostedZone,
	certificate: dnsStack.certificate,
});

new SocialMediaStack(app, socialMediaStackName, {
	...commonStackProps,
	description: `Social Media API Services (${environment}${branchSuffix})`,
});

// Budget monitoring - requires email for alerts
const budgetEmail = process.env.CDK_BUDGET_ALERT_EMAIL;
if (budgetEmail) {
	new BudgetStack(app, budgetStackName, {
		...commonStackProps,
		description: `Cost Budget & Alerts (${environment}${branchSuffix})`,
		alertEmail: budgetEmail,
	});
} else {
	console.warn("⚠️  CDK_BUDGET_ALERT_EMAIL not set - skipping budget stack.");
	console.warn("    Set CDK_BUDGET_ALERT_EMAIL in .env to enable cost alerts.");
}
