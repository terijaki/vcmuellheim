import "varlock/auto-load";
import { ENV } from "varlock/env";
import { getSanitizedBranch } from "@utils/git";
import { getCdkNaming } from "@utils/cdk-naming";
import * as cdk from "aws-cdk-lib";
import { DNS } from "@/project.config";
import { BudgetStack } from "../lib/budget-stack";
import { ContentDbStack } from "../lib/content-db-stack";
import { DnsStack } from "../lib/dns-stack";
import { MailStack } from "../lib/mail-stack";
import { MediaStack } from "../lib/media-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { SamsStack } from "../lib/sams-stack";
import { SocialMediaStack } from "../lib/social-media-stack";
import { WebAppStack } from "../lib/webapp-stack";

const app = new cdk.App();

const environment = ENV.CDK_ENVIRONMENT || "dev";
const isProd = environment === "prod";
const isDestroy = process.env.CDK_DESTROY === "true";

const branch = getSanitizedBranch();

// Environment-specific configuration
const { stackName, envLabel } = getCdkNaming(isProd, branch);

const contentDbStackName = stackName("ContentDbStack");
const mediaStackName = stackName("MediaStack");
const webappStackName = stackName("WebAppStack");
const samsStackName = stackName("SamsStack");
const socialMediaStackName = stackName("SocialMediaStack");
const dnsStackName = stackName("DnsStack");
const budgetStackName = stackName("BudgetStack");
const monitoringStackName = stackName("MonitoringStack");
const mailStackName = stackName("MailStack");

const commonStackProps = {
	env: {
		region: process.env.CDK_REGION || "eu-central-1",
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
	description: `DNS & Route53 (${envLabel})`,
	hostedZoneId: isProd ? DNS.prod.hostedZoneId : DNS.dev.hostedZoneId,
	hostedZoneName: isProd ? DNS.prod.hostedZoneName : DNS.dev.hostedZoneName,
	regionalCertificateArn: isProd ? DNS.prod.certificateArn : DNS.dev.certificateArn,
	cloudFrontCertificateArn: isProd ? DNS.prod.cloudFrontCertificateArn : DNS.dev.cloudFrontCertificateArn,
});

const contentDbStack = new ContentDbStack(app, contentDbStackName, {
	...commonStackProps,
	description: `Content Database Tables (${envLabel})`,
});

const mediaStack = new MediaStack(app, mediaStackName, {
	...commonStackProps,
	description: `Media Storage (S3) (${envLabel})`,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
});

const samsStack = new SamsStack(app, samsStackName, {
	...commonStackProps,
	description: `SAMS API Services (${envLabel})`,
	mediaBucketName: mediaStack.bucketName,
	mediaCloudFrontUrl: mediaStack.cloudFrontUrl,
});

// Social Media Stack with Mastodon integration
new SocialMediaStack(app, socialMediaStackName, {
	...commonStackProps,
	description: `Social Media API Services (${envLabel})`,
	contentTable: contentDbStack.contentTable,
	// Pass the webapp URL for Mastodon news-sharing links
	websiteUrl: isProd ? `https://${DNS.prod.hostedZoneName}` : `https://${envLabel}.${DNS.dev.hostedZoneName}`,
	mediaBucketName: mediaStack.bucketName,
});

const webappStack = new WebAppStack(app, webappStackName, {
	...commonStackProps,
	description: `VCM WebApp + Admin (${envLabel})`,
	contentTableName: contentDbStack.contentTableName,
	mediaBucketName: mediaStack.bucketName,
	mediaCloudFrontUrl: mediaStack.cloudFrontUrl,
	hostedZone: dnsStack.hostedZone,
	cloudFrontCertificate: dnsStack.cloudFrontCertificate,
	samsClubsSyncFunctionName: samsStack.samsClubsSyncFunctionName,
	samsTeamsSyncFunctionName: samsStack.samsTeamsSyncFunctionName,
});

// Budget monitoring - requires email for alerts
const budgetEmail = ENV.CDK_BUDGET_ALERT_EMAIL;

// Mail forwarding stack — branch-scoped Lambda/EventBridge/DLQ/alarms
new MailStack(app, mailStackName, {
	...commonStackProps,
	description: `Inbound Mail Forwarding (${envLabel})`,
	contentTableName: contentDbStack.contentTableName,
	alertEmail: ENV.CDK_MONITORING_ALERT_EMAIL || budgetEmail,
});
if (budgetEmail || isDestroy) {
	new BudgetStack(app, budgetStackName, {
		...commonStackProps,
		description: `Cost Budget & Alerts (${envLabel})`,
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
const monitoringEmail = ENV.CDK_MONITORING_ALERT_EMAIL || budgetEmail;
if (monitoringEmail || isDestroy) {
	new MonitoringStack(app, monitoringStackName, {
		...commonStackProps,
		description: `Monitoring & Alerting (${envLabel})`,
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
