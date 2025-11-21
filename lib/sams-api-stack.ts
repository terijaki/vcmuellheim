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

export class SamsApiStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// Create API Gateway
		const api = new apigateway.RestApi(this, "SamsApi", {
			restApiName: "SAMS API Proxy",
			description: "API proxy for SAMS volleyball data",
			defaultCorsPreflightOptions: {
				allowOrigins: apigateway.Cors.ALL_ORIGINS,
				allowMethods: apigateway.Cors.ALL_METHODS,
				allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"],
			},
			deployOptions: {
				stageName: "v1",
				cachingEnabled: true,
				cacheClusterEnabled: true,
				cacheClusterSize: "0.5",
				cacheTtl: cdk.Duration.seconds(300), // 5 minutes default cache
			},
		});

		// Environment variables for all Lambda functions
		const samsApiKey = process.env.SAMS_API_KEY;
		const samsServer = process.env.SAMS_SERVER;
		if (!samsApiKey) throw new Error("❌ SAMS_API_KEY environment variable is required");
		if (!samsServer) throw new Error("❌ SAMS_SERVER environment variable is required");
		 

		const commonEnvironment = {
			SAMS_API_KEY: samsApiKey,
			SAMS_SERVER: samsServer,
		};

		// Create DynamoDB table for storing SAMS clubs
		const clubsTable = new dynamodb.Table(this, "SamsClubsTable", {
			tableName: "sams-clubs",
			partitionKey: {
				name: "sportsclubUuid",
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Delete table when stack is deleted
			timeToLiveAttribute: "ttl", // Auto-delete stale records
		});

		// Add GSI for querying by association
		clubsTable.addGlobalSecondaryIndex({
			indexName: "associationUuid-index",
			partitionKey: {
				name: "associationUuid",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Add GSI for querying by name
		clubsTable.addGlobalSecondaryIndex({
			indexName: "name-index",
			partitionKey: {
				name: "name",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Create Lambda function for league matches (main endpoint you use)
		const samsLeagueMatches = new nodejs.NodejsFunction(this, "SamsLeagueMatches", {
			functionName: "sams-league-matches",
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-league-matches.ts"),
			environment: commonEnvironment,
			timeout: cdk.Duration.seconds(60),
			memorySize: 512,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for seasons
		const samsSeasons = new nodejs.NodejsFunction(this, "SamsSeasons", {
			functionName: "sams-seasons",
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-seasons.ts"),
			environment: commonEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for rankings
		const samsRankings = new nodejs.NodejsFunction(this, "SamsRankings", {
			functionName: "sams-rankings",
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-rankings.ts"),
			environment: commonEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for associations
		const samsAssociations = new nodejs.NodejsFunction(this, "SamsAssociations", {
			functionName: "sams-associations",
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-associations.ts"),
			environment: commonEnvironment,
			timeout: cdk.Duration.seconds(60), // Longer timeout for pagination
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for nightly clubs sync
		const samsClubsSync = new nodejs.NodejsFunction(this, "SamsClubsSync", {
			functionName: "sams-clubs-sync",
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-clubs-sync.ts"),
			environment: {
				...commonEnvironment,
				CLUBS_TABLE_NAME: clubsTable.tableName,
			},
			timeout: cdk.Duration.minutes(10), // Longer timeout for paginated sync
			memorySize: 512,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to sync Lambda
		clubsTable.grantReadWriteData(samsClubsSync);

		// Create EventBridge rule to trigger sync Lambda nightly at 2 AM UTC
		const syncRule = new events.Rule(this, "SamsClubsSyncRule", {
			ruleName: "sams-clubs-nightly-sync",
			description: "Trigger SAMS clubs sync every night at 2 AM UTC",
			schedule: events.Schedule.cron({
				hour: "2",
				minute: "0",
			}),
		});

		// Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(samsClubsSync));

		// Create API Gateway resources
		const samsResource = api.root.addResource("sams");

		// GET /sams/matches
		const matchesResource = samsResource.addResource("matches");
		matchesResource.addMethod("GET", new apigateway.LambdaIntegration(samsLeagueMatches), {
			requestParameters: {
				"method.request.querystring.league": false,
				"method.request.querystring.season": false,
				"method.request.querystring.sportsclub": false,
				"method.request.querystring.team": false,
				"method.request.querystring.limit": false,
				"method.request.querystring.range": false,
			},
		});

		// GET /sams/seasons
		const seasonsResource = samsResource.addResource("seasons");
		seasonsResource.addMethod("GET", new apigateway.LambdaIntegration(samsSeasons));

		// GET /sams/rankings/{leagueUuid}
		const rankingsResource = samsResource.addResource("rankings");
		const rankingsByLeague = rankingsResource.addResource("{leagueUuid}");
		rankingsByLeague.addMethod("GET", new apigateway.LambdaIntegration(samsRankings));

		// GET /sams/associations and GET /sams/associations/{name}
		const associationsResource = samsResource.addResource("associations");
		associationsResource.addMethod("GET", new apigateway.LambdaIntegration(samsAssociations));

		const associationsByName = associationsResource.addResource("{name}");
		associationsByName.addMethod("GET", new apigateway.LambdaIntegration(samsAssociations));

		// Create CloudFront distribution for caching
		const distribution = new cloudfront.Distribution(this, "SamsApiDistribution", {
			defaultBehavior: {
				origin: new origins.RestApiOrigin(api),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: new cloudfront.CachePolicy(this, "SamsApiCachePolicy", {
					cachePolicyName: "SamsApiCachePolicy",
					defaultTtl: cdk.Duration.minutes(5),
					maxTtl: cdk.Duration.hours(1),
					minTtl: cdk.Duration.seconds(0),
					queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
					headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization", "X-Api-Key"),
				}),
			},
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Only US, Canada, Europe
			comment: "SAMS API CloudFront Distribution",
		});

		// Outputs
		new cdk.CfnOutput(this, "ApiGatewayUrl", {
			value: api.url,
			description: "API Gateway URL",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: `https://${distribution.distributionDomainName}`,
			description: "CloudFront Distribution URL",
		});

		new cdk.CfnOutput(this, "ApiId", {
			value: api.restApiId,
			description: "API Gateway ID",
		});

		new cdk.CfnOutput(this, "ClubsTableName", {
			value: clubsTable.tableName,
			description: "DynamoDB table name for clubs",
		});

		new cdk.CfnOutput(this, "SyncRuleName", {
			value: syncRule.ruleName,
			description: "EventBridge rule name for nightly sync",
		});
	}
}
