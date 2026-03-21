import { getSanitizedBranch } from "@utils/git";
import * as cdk from "aws-cdk-lib";
import { DNS } from "@/project.config";
import { BudgetStack } from "../lib/budget-stack";
import { ContentDbStack } from "../lib/content-db-stack";
import { DnsStack } from "../lib/dns-stack";
import { MediaStack } from "../lib/media-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { SamsApiStack } from "../lib/sams-api-stack";
import { SocialMediaStack } from "../lib/social-media-stack";
import { WebAppStack } from "../lib/webapp-stack";

const app = new cdk.App();

const environment = process.env.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";
const isDestroy = process.env.CDK_DESTROY === "true";

const branch = getSanitizedBranch();
const branchSuffix = branch ? `-${branch}` : "";

// Environment-specific configuration
const contentDbStackName = isProd ? `ContentDbStack-Prod${branchSuffix}` : `ContentDbStack-Dev${branchSuffix}`;
const mediaStackName = isProd ? `MediaStack-Prod${branchSuffix}` : `MediaStack-Dev${branchSuffix}`;
const webappStackName = isProd ? `WebAppStack-Prod${branchSuffix}` : `WebAppStack-Dev${branchSuffix}`;
const samsStackName = isProd ? `SamsApiStack-Prod${branchSuffix}` : `SamsApiStack-Dev${branchSuffix}`;
const socialMediaStackName = isProd ? `SocialMediaStack-Prod${branchSuffix}` : `SocialMediaStack-Dev${branchSuffix}`;
const dnsStackName = isProd ? `DnsStack-Prod${branchSuffix}` : `DnsStack-Dev${branchSuffix}`;
const budgetStackName = isProd ? `BudgetStack-Prod${branchSuffix}` : `BudgetStack-Dev${branchSuffix}`;
const monitoringStackName = isProd ? `MonitoringStack-Prod${branchSuffix}` : `MonitoringStack-Dev${branchSuffix}`;
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

const samsApiStack = new SamsApiStack(app, samsStackName, {
	...commonStackProps,
	description: `SAMS API Services (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	regionalCertificate: dnsStack.regionalCertificate,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
	mediaBucket: mediaStack.bucket,
	mediaCloudFrontUrl: mediaStack.cloudFrontUrl,
});

// Social Media Stack with Instagram and Mastodon integration
const socialMediaStack = new SocialMediaStack(app, socialMediaStackName, {
	...commonStackProps,
	description: `Social Media API Services (${environment}${branchSuffix})`,
	hostedZone: dnsStack.hostedZone,
	regionalCertificate: dnsStack.regionalCertificate,
	newsTable: contentDbStack.contentTable,
	// Pass the webapp URL for Mastodon news-sharing links
	websiteUrl: isProd ? `https://${DNS.prod.hostedZoneName}` : `https://${environment}${branchSuffix}.${DNS.dev.hostedZoneName}`,
	mediaBucket: mediaStack.bucket,
});

const webappStack = new WebAppStack(app, webappStackName, {
	...commonStackProps,
	description: `VCM WebApp + Admin (${environment}${branchSuffix})`,
	contentTable: contentDbStack.contentTable,
	samsApiStack: {
		samsClubsTable: samsApiStack.samsClubsTable,
		samsTeamsTable: samsApiStack.samsTeamsTable,
	},
	instagramTable: socialMediaStack.instagramTable,
	mediaBucket: mediaStack.bucket,
	mediaCloudFrontUrl: mediaStack.cloudFrontUrl,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
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
	new MonitoringStack(app, monitoringStackName, {
		...commonStackProps,
		description: `Monitoring & Alerting (${environment}${branchSuffix})`,
		alertEmail: monitoringEmail || "cleanup@example.com",
		webappLambda: webappStack.webappLambda,
		contentTables: {
			content: contentDbStack.contentTable,
		},
		mediaBucket: mediaStack.bucket,
		mediaDistribution: mediaStack.distribution,
		websiteDistribution: webappStack.distribution,
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
