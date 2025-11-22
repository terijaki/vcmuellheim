import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

interface SocialMediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
}

export class SocialMediaStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: SocialMediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";

		// Create API Gateway
		const api = new apigateway.RestApi(this, "SocialMediaApi", {
			restApiName: `Social Media API (${environment}${branchSuffix})`,
			description: `API for social media content aggregation - ${environment}${branchSuffix}`,
			defaultCorsPreflightOptions: {
				allowOrigins: apigateway.Cors.ALL_ORIGINS,
				allowMethods: apigateway.Cors.ALL_METHODS,
				allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"],
			},
			deployOptions: {
				stageName: "v1",
			},
		});

		// Environment variables
		const apifyApiKey = process.env.APIFY_API_KEY;
		const apifyScheduleId = process.env.APIFY_SCHEDULE_ID || "2QNPqeA1rum2087Xs";
		const apifyActorId = process.env.APIFY_ACTOR_ID || "nH2AHrwxeTRJoN5hX";

		if (!apifyApiKey) {
			console.warn("⚠️ APIFY_API_KEY not set - Instagram sync will not work");
		}

		// Create DynamoDB table for storing Instagram posts
		// Uses a constant partition key for all posts to enable simple time-based queries
		const instagramTable = new dynamodb.Table(this, "InstagramPostsTable", {
			tableName: `${environment}${branchSuffix}-instagram-posts`,
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
			functionName: `${environment}${branchSuffix}-instagram-sync`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/instagram-sync.ts"),
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
			functionName: `${environment}${branchSuffix}-instagram-posts`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/instagram-posts.ts"),
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
			ruleName: `${environment}${branchSuffix}-instagram-daily-sync`,
			description: `Trigger Instagram sync every day at 4 AM UTC (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				hour: "4",
				minute: "0",
			}),
		});

		// Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(instagramSync));

		// Create API Gateway resources
		const instagramResource = api.root.addResource("instagram");

		// GET /instagram (all posts or filter by ?handle=username)
		instagramResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(instagramPosts, {
				cacheKeyParameters: ["method.request.querystring.handle"],
			}),
			{
				requestParameters: {
					"method.request.querystring.handle": false,
				},
				methodResponses: [
					{
						statusCode: "200",
						responseParameters: {
							"method.response.header.Cache-Control": true,
						},
					},
				],
			},
		);

		// Create CloudFront distribution for caching
		const distribution = new cloudfront.Distribution(this, "SocialMediaApiDistribution", {
			defaultBehavior: {
				origin: new origins.RestApiOrigin(api),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: new cloudfront.CachePolicy(this, "SocialMediaCachePolicy", {
					cachePolicyName: `${environment}${branchSuffix}-social-media-cache-policy`,
					defaultTtl: cdk.Duration.hours(1), // 1 hour default
					maxTtl: cdk.Duration.days(1), // Max 1 day
					minTtl: cdk.Duration.seconds(0),
					queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
					headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization", "X-Api-Key"),
				}),
			},
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Only US, Canada, Europe
			comment: `Social Media API CloudFront Distribution (${environment}${branchSuffix})`,
		});

		// Outputs
		new cdk.CfnOutput(this, "ApiGatewayUrl", {
			value: api.url,
			description: "Social Media API Gateway URL",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: `https://${distribution.distributionDomainName}`,
			description: "Social Media CloudFront Distribution URL",
		});

		new cdk.CfnOutput(this, "InstagramEndpoint", {
			value: `${api.url}instagram`,
			description: "Instagram Posts API Endpoint",
		});
	}
}
