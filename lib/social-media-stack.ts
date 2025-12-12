import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
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
	newsTable?: dynamodb.ITable;
	websiteUrl?: string;
}

export class SocialMediaStack extends cdk.Stack {
	public readonly cloudFrontUrl: string;
	public readonly mastodonLambda: lambda.IFunction;

	constructor(scope: Construct, id: string, props: SocialMediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;
		const socialDomain = `${envPrefix}social.${baseDomain}`;

		const allowedOriginsSet = new Set<string>();
		allowedOriginsSet.add(Club.url);
		allowedOriginsSet.add(`https://${envPrefix.replace(/-$/, ".")}${baseDomain}`);
		allowedOriginsSet.add(`https://${envPrefix}admin.${baseDomain}`);
		if (!isProd) {
			allowedOriginsSet.add("http://localhost:3081"); // CMS dev server
			allowedOriginsSet.add("http://localhost:3080"); // Website dev server
		}
		const allowedOrigins = Array.from(allowedOriginsSet);

		// AWS Lambda Powertools Layer for structured logging and X-Ray tracing
		const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "PowertoolsLayer", `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:41`);

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
		const isCdkDestroy = process.env.CDK_DESTROY === "true";

		if (!apifyApiKey && !isCdkDestroy) {
			throw new Error("❌ APIFY_API_KEY environment variable is required");
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
		const instagramSync = new NodejsFunction(this, "InstagramSync", {
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
			layers: [powertoolsLayer],
			logRetention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to sync Lambda
		instagramTable.grantReadWriteData(instagramSync);

		// Create Lambda function for Instagram posts API
		const instagramPosts = new NodejsFunction(this, "InstagramPosts", {
			functionName: `instagram-posts-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/social/instagram-posts.ts"),
			environment: {
				INSTAGRAM_TABLE_NAME: instagramTable.tableName,
			},
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			layers: [powertoolsLayer],
			logRetention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
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

		// Environment variables for Mastodon
		const mastodonAccessToken = process.env.MASTODON_ACCESS_TOKEN;

		if (!mastodonAccessToken && !isCdkDestroy && isProd) {
			console.warn("⚠️  MASTODON_ACCESS_TOKEN not set - Mastodon sharing will be disabled in production");
		}

		// Create Lambda function for Mastodon sharing
		const mastodonShare = new NodejsFunction(this, "MastodonShare", {
			functionName: `mastodon-share-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/social/mastodon-share.ts"),
			environment: {
				MASTODON_ACCESS_TOKEN: mastodonAccessToken || "",
			},
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			layers: [powertoolsLayer],
			logRetention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for Mastodon stream handler (DynamoDB streams)
		if (props.newsTable && props.websiteUrl) {
			const mastodonStreamHandler = new NodejsFunction(this, "MastodonStreamHandler", {
				functionName: `mastodon-stream-handler-${environment}${branchSuffix}`,
				runtime: lambda.Runtime.NODEJS_LATEST,
				handler: "handler",
				entry: path.join(__dirname, "../lambda/social/mastodon-stream-handler.ts"),
				environment: {
					MASTODON_LAMBDA_NAME: mastodonShare.functionName,
					ENVIRONMENT: environment,
					WEBSITE_URL: props.websiteUrl,
					NEWS_TABLE_NAME: props.newsTable.tableName,
				},
				timeout: cdk.Duration.seconds(30),
				memorySize: 256,
				layers: [powertoolsLayer],
				logRetention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				bundling: {
					externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core", "@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-lambda"],
					minify: true,
					sourceMap: true,
				},
			});

			// Grant permissions
			props.newsTable.grantStreamRead(mastodonStreamHandler);
			props.newsTable.grantReadWriteData(mastodonStreamHandler);
			mastodonShare.grantInvoke(mastodonStreamHandler);

			// Attach DynamoDB stream event source
			mastodonStreamHandler.addEventSource(
				new DynamoEventSource(props.newsTable, {
					startingPosition: lambda.StartingPosition.LATEST,
					bisectBatchOnError: true,
					retryAttempts: 2,
				}),
			);

			console.log("✅ Mastodon stream handler configured for news table");
		} else {
			console.log("⏭️ Skipping Mastodon stream handler - news table or website URL not provided");
		}

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

		// Export Mastodon Lambda for use in other stacks
		this.mastodonLambda = mastodonShare;

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

		new cdk.CfnOutput(this, "MastodonLambdaArn", {
			value: mastodonShare.functionArn,
			description: "Mastodon Sharing Lambda ARN",
		});
	}
}
