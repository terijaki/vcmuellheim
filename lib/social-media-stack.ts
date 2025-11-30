import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import { Club } from "@/project.config";

interface SocialMediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	hostedZone?: route53.IHostedZone;
	regionalCertificate?: acm.ICertificate;
}

export class SocialMediaStack extends cdk.Stack {
	public readonly cloudFrontUrl: string;

	constructor(scope: Construct, id: string, props: SocialMediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const socialDomain = `${envPrefix}social.new.${Club.domain}`;

		const allowedOriginsSet = new Set<string>();
		allowedOriginsSet.add(Club.url);
		allowedOriginsSet.add(`https://${envPrefix.replace(/-$/, ".")}new.${Club.domain}`);
		allowedOriginsSet.add(`https://${envPrefix}admin.new.${Club.domain}`);
		if (!isProd) {
			allowedOriginsSet.add("http://localhost:3081"); // CMS dev server
			allowedOriginsSet.add("http://localhost:3080"); // Website dev server
		}
		const allowedOrigins = Array.from(allowedOriginsSet);

		// Custom domain for API Gateway
		const apiDomainName =
			props?.hostedZone && props?.regionalCertificate
				? new apigatewayv2.DomainName(this, "SocialApiDomainName", {
						domainName: socialDomain,
						certificate: props.regionalCertificate,
					})
				: undefined;

		// Create HTTP API Gateway (V2)
		const api = new apigatewayv2.HttpApi(this, "SocialMediaApi", {
			apiName: `Social Media API (${environment}${branchSuffix})`,
			description: `API for social media content aggregation - ${environment}${branchSuffix}`,
			...(apiDomainName ? { defaultDomainMapping: { domainName: apiDomainName } } : {}),
			corsPreflight: {
				allowOrigins: allowedOrigins,
				allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
				allowHeaders: ["content-type", "x-api-key", "authorization"],
				exposeHeaders: ["content-type"],
				allowCredentials: false,
				maxAge: cdk.Duration.hours(1),
			},
		});

		// Environment variables
		const apifyApiKey = process.env.APIFY_API_KEY;
		const apifyScheduleId = process.env.APIFY_SCHEDULE_ID || "2QNPqeA1rum2087Xs";
		const apifyActorId = process.env.APIFY_ACTOR_ID || "nH2AHrwxeTRJoN5hX";

		if (!apifyApiKey) {
			const isCdkDestroy = process.argv.some((a) => /destroy/i.test(a));
			if (!isCdkDestroy) {
				throw new Error("❌ APIFY_API_KEY environment variable is required");
			}
		}

		// Create DynamoDB table for storing Instagram posts
		// Uses a constant partition key for all posts to enable simple time-based queries
		const instagramTable = new dynamodb.Table(this, "InstagramPostsTable", {
			tableName: `instagram-posts-${environment}${branchSuffix}`,
			partitionKey: {
				name: "entityType",
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: "timestamp",
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl",
		});

		// Create Lambda function for Instagram sync
		const instagramSync = new nodejs.NodejsFunction(this, "InstagramSync", {
			functionName: `instagram-sync-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/social/instagram-sync.ts"),
			environment: {
				INSTAGRAM_TABLE_NAME: instagramTable.tableName,
				APIFY_API_KEY: apifyApiKey || "",
				APIFY_SCHEDULE_ID: apifyScheduleId,
				APIFY_ACTOR_ID: apifyActorId,
			},
			timeout: cdk.Duration.minutes(5),
			memorySize: 512,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to sync Lambda
		instagramTable.grantReadWriteData(instagramSync);

		// Create Lambda function for Instagram posts API
		const instagramPosts = new nodejs.NodejsFunction(this, "InstagramPosts", {
			functionName: `instagram-posts-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/social/instagram-posts.ts"),
			environment: {
				INSTAGRAM_TABLE_NAME: instagramTable.tableName,
			},
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB read permissions to posts Lambda
		instagramTable.grantReadData(instagramPosts);

		// Create EventBridge rule to trigger sync daily at 4 AM UTC
		const syncRule = new events.Rule(this, "InstagramSyncRule", {
			ruleName: `instagram-daily-sync-${environment}${branchSuffix}`,
			description: `Trigger Instagram sync every day at 4 AM UTC (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				hour: "4",
				minute: "0",
			}),
		});

		// Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(instagramSync));

		// Create Lambda integration for HTTP API
		const instagramIntegration = new HttpLambdaIntegration("InstagramIntegration", instagramPosts);

		// Add route: GET /instagram
		api.addRoutes({
			path: "/instagram",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: instagramIntegration,
		});

		// Create Route53 A record for custom domain (if configured)
		if (apiDomainName && props?.hostedZone) {
			new route53.ARecord(this, "SocialMediaAliasRecord", {
				zone: props.hostedZone,
				recordName: socialDomain,
				target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(apiDomainName.regionalDomainName, apiDomainName.regionalHostedZoneId)),
				comment: `Social Media API (${environment}${branchSuffix})`,
			});
		}

		// Use custom domain if available, otherwise fall back to default API Gateway URL
		this.cloudFrontUrl = apiDomainName ? `https://${socialDomain}` : api.url || "";

		// Outputs
		new cdk.CfnOutput(this, "ApiGatewayUrl", {
			value: api.url || "",
			description: "Social Media API Gateway URL",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: this.cloudFrontUrl,
			description: "Social Media CloudFront Distribution URL",
		});

		new cdk.CfnOutput(this, "InstagramEndpoint", {
			value: `${this.cloudFrontUrl}/instagram`,
			description: "Instagram Posts API Endpoint",
		});
	}
}
