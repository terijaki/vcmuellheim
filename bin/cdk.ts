import { getSanitizedBranch } from "@utils/git";
import * as cdk from "aws-cdk-lib";
import { DNS } from "@/project.config";
import { ApiStack } from "../lib/api-stack";
import { BudgetStack } from "../lib/budget-stack";
import { CmsStack } from "../lib/cms-stack";
import { ContentDbStack } from "../lib/content-db-stack";
import { DnsStack } from "../lib/dns-stack";
import { MediaStack } from "../lib/media-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { SamsApiStack } from "../lib/sams-api-stack";
import { SocialMediaStack } from "../lib/social-media-stack";
import { WebsiteStack } from "../lib/website-stack";

const app = new cdk.App();

const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";
const isDestroy = process.env.CDK_DESTROY === "true";

const branch = getSanitizedBranch();
const branchSuffix = branch ? `-${branch}` : "";

// Environment-specific configuration
const contentDbStackName = isProd ? `ContentDbStack-Prod${branchSuffix}` : `ContentDbStack-Dev${branchSuffix}`;
const mediaStackName = isProd ? `MediaStack-Prod${branchSuffix}` : `MediaStack-Dev${branchSuffix}`;
const websiteStackName = isProd ? `WebsiteStack-Prod${branchSuffix}` : `WebsiteStack-Dev${branchSuffix}`;
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
	hostedZoneId: isProd ? DNS.prod.hostedZoneId : DNS.dev.hostedZoneId,
	hostedZoneName: isProd ? DNS.prod.hostedZoneName : DNS.dev.hostedZoneName,
	regionalCertificateArn: isProd ? DNS.prod.certificateArn : DNS.dev.certificateArn,
	cloudFrontCertificateArn: isProd ? DNS.prod.cloudFrontCertificateArn : DNS.dev.cloudFrontCertificateArn,
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

const websiteStack = new WebsiteStack(app, websiteStackName, {
	...commonStackProps,
	description: `Public Website (S3 + CloudFront) (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
});

const samsApiStack = new SamsApiStack(app, samsStackName, {
	...commonStackProps,
	description: `SAMS API Services (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	regionalCertificate: dnsStack.regionalCertificate, // API Gateway cert (eu-central-1)
	cloudFrontCertificate: dnsStack.cloudFrontCertificate, // CloudFront cert (us-east-1)
});

// Social Media Stack with Instagram and Mastodon integration
new SocialMediaStack(app, socialMediaStackName, {
	...commonStackProps,
	description: `Social Media API Services (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	regionalCertificate: dnsStack.regionalCertificate,
	newsTable: contentDbStack.newsTable,
	websiteUrl: websiteStack.websiteUrl,
	mediaBucket: mediaStack.bucket,
	cloudFrontUrl: mediaStack.cloudFrontUrl,
});

const apiStack = new ApiStack(app, apiStackName, {
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
	samsApiStack: {
		samsClubsTable: samsApiStack.samsClubsTable,
		samsTeamsTable: samsApiStack.samsTeamsTable,
	},
	samsApiUrl: samsApiStack.cloudFrontUrl,
	mediaBucket: mediaStack.bucket,
	cloudFrontUrl: mediaStack.cloudFrontUrl,
	cmsUrl: cmsStack.cmsUrl,
	websiteUrl: websiteStack.websiteUrl,
	hostedZone: dnsStack.hostedZone,
	regionalCertificate: dnsStack.regionalCertificate,
});

// Budget monitoring - requires email for alerts
const budgetEmail = process.env.CDK_BUDGET_ALERT_EMAIL;
if (budgetEmail || isDestroy) {
	new BudgetStack(app, budgetStackName, {
		...commonStackProps,
		description: `Cost Budget & Alerts (${environment}${branchSuffix})`,
		alertEmail: budgetEmail || "cleanup@example.com",
	});
} else {
	const message = "❌ CDK_BUDGET_ALERT_EMAIL not set";
	if (isProd) {
		console.error(`🚨  ${message} - production deployment requires budget alerts.`);
		process.exit(1);
	} else {
		console.warn(`⚠️  ${message} - skipping budget stack.`);
		console.warn("    Set CDK_BUDGET_ALERT_EMAIL in .env to enable cost alerts.");
	}
}

// Monitoring stack - setup alerts and dashboards
const monitoringEmail = process.env.CDK_MONITORING_ALERT_EMAIL || budgetEmail;
if (monitoringEmail || isDestroy) {
	new MonitoringStack(app, `MonitoringStack${branchSuffix}`, {
		...commonStackProps,
		description: `Monitoring & Alerting (${environment}${branchSuffix})`,
		alertEmail: monitoringEmail || "cleanup@example.com",
		trpcLambda: apiStack.trpcLambda,
		contentTables: {
			news: contentDbStack.newsTable,
			events: contentDbStack.eventsTable,
			teams: contentDbStack.teamsTable,
			members: contentDbStack.membersTable,
			media: contentDbStack.mediaTable,
			sponsors: contentDbStack.sponsorsTable,
			bus: contentDbStack.busTable,
			locations: contentDbStack.locationsTable,
		},
		api: apiStack.api,
		mediaBucket: mediaStack.bucket,
		mediaDistribution: mediaStack.distribution,
		cmsDistribution: cmsStack.distribution,
		websiteDistribution: websiteStack.distribution,
	});
} else {
	const message = "❌ CDK_MONITORING_ALERT_EMAIL not set";
	if (isProd) {
		console.error(`🚨  ${message} - production deployment requires monitoring alerts.`);
		process.exit(1);
	} else {
		console.warn(`⚠️  ${message} - skipping monitoring stack.`);
		console.warn("    Set CDK_MONITORING_ALERT_EMAIL in .env to enable monitoring and alerts.");
	}
}
