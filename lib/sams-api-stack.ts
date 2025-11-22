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
				// No API Gateway caching - CloudFront handles all caching based on Lambda Cache-Control headers
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

		// Add GSI for querying by name (exact match, case-sensitive)
		clubsTable.addGlobalSecondaryIndex({
			indexName: "name-index",
			partitionKey: {
				name: "name",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Add GSI for querying by nameSlug (case-insensitive search)
		clubsTable.addGlobalSecondaryIndex({
			indexName: "nameSlug-index",
			partitionKey: {
				name: "nameSlug",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Create DynamoDB table for storing SAMS teams
		const teamsTable = new dynamodb.Table(this, "SamsTeamsTable", {
			tableName: "sams-teams",
			partitionKey: {
				name: "uuid",
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl",
		});

		// Add GSI for querying teams by sportsclub
		teamsTable.addGlobalSecondaryIndex({
			indexName: "sportsclubUuid-index",
			partitionKey: {
				name: "sportsclubUuid",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Add GSI for querying teams by league
		teamsTable.addGlobalSecondaryIndex({
			indexName: "leagueUuid-index",
			partitionKey: {
				name: "leagueUuid",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Add GSI for case-insensitive team name search
		teamsTable.addGlobalSecondaryIndex({
			indexName: "nameSlug-index",
			partitionKey: {
				name: "nameSlug",
				type: dynamodb.AttributeType.STRING,
			},
		});

		// Create Lambda function for league matches (main endpoint you use)
		const samsLeagueMatches = new nodejs.NodejsFunction(this, "SamsLeagueMatches", {
			functionName: "sams-league-matches",
			runtime: lambda.Runtime.NODEJS_LATEST,
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
			runtime: lambda.Runtime.NODEJS_LATEST,
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
			runtime: lambda.Runtime.NODEJS_LATEST,
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
			runtime: lambda.Runtime.NODEJS_LATEST,
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
			runtime: lambda.Runtime.NODEJS_LATEST,
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

		// Create Lambda function for nightly teams sync
		const samsTeamsSync = new nodejs.NodejsFunction(this, "SamsTeamsSync", {
			functionName: "sams-teams-sync",
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-teams-sync.ts"),
			environment: {
				...commonEnvironment,
				CLUBS_TABLE_NAME: clubsTable.tableName,
				TEAMS_TABLE_NAME: teamsTable.tableName,
			},
			timeout: cdk.Duration.minutes(10),
			memorySize: 512,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to teams sync Lambda
		clubsTable.grantReadData(samsTeamsSync);
		teamsTable.grantReadWriteData(samsTeamsSync);

		// Create Lambda function for clubs query (read from DynamoDB)
		const samsClubs = new nodejs.NodejsFunction(this, "SamsClubs", {
			functionName: "sams-clubs",
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-clubs.ts"),
			environment: {
				CLUBS_TABLE_NAME: clubsTable.tableName,
			},
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB read permissions to clubs query Lambda
		clubsTable.grantReadData(samsClubs);

		// Create Lambda function for teams query (read from DynamoDB)
		const samsTeams = new nodejs.NodejsFunction(this, "SamsTeams", {
			functionName: "sams-teams",
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams-teams.ts"),
			environment: {
				TEAMS_TABLE_NAME: teamsTable.tableName,
			},
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB read permissions to teams query Lambda
		teamsTable.grantReadData(samsTeams);

	// Create EventBridge rule to trigger sync Lambda weekly on Wednesday at 2 AM UTC
	const syncRule = new events.Rule(this, "SamsClubsSyncRule", {
		ruleName: "sams-clubs-weekly-sync",
		description: "Trigger SAMS clubs sync every Wednesday at 2 AM UTC",
		schedule: events.Schedule.cron({
			weekDay: "WED",
			hour: "2",
			minute: "0",
		}),
	});		// Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(samsClubsSync));

		// Create EventBridge rule to trigger teams sync nightly at 3 AM UTC
		const teamsSyncRule = new events.Rule(this, "SamsTeamsSyncRule", {
			ruleName: "sams-teams-nightly-sync",
			description: "Trigger SAMS teams sync every night at 3 AM UTC (after clubs sync)",
			schedule: events.Schedule.cron({
				hour: "3",
				minute: "0",
			}),
		});

		// Add teams Lambda as target for EventBridge rule
		teamsSyncRule.addTarget(new targets.LambdaFunction(samsTeamsSync));

		// Create API Gateway resources
		const samsResource = api.root.addResource("sams");

		// GET /sams/matches
		const matchesResource = samsResource.addResource("matches");
		matchesResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsLeagueMatches, {
				cacheKeyParameters: [
					"method.request.querystring.league",
					"method.request.querystring.season",
					"method.request.querystring.sportsclub",
					"method.request.querystring.team",
					"method.request.querystring.limit",
					"method.request.querystring.range",
				],
			}),
			{
				requestParameters: {
					"method.request.querystring.league": false,
					"method.request.querystring.season": false,
					"method.request.querystring.sportsclub": false,
					"method.request.querystring.team": false,
					"method.request.querystring.limit": false,
					"method.request.querystring.range": false,
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

		// GET /sams/seasons
		const seasonsResource = samsResource.addResource("seasons");
		seasonsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsSeasons),
			{
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

		// GET /sams/rankings/{leagueUuid}
		const rankingsResource = samsResource.addResource("rankings");
		const rankingsByLeague = rankingsResource.addResource("{leagueUuid}");
		rankingsByLeague.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsRankings),
			{
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

		// GET /sams/associations and GET /sams/associations/{name}
		const associationsResource = samsResource.addResource("associations");
		associationsResource.addMethod("GET", new apigateway.LambdaIntegration(samsAssociations));

		const associationsByName = associationsResource.addResource("{name}");
		associationsByName.addMethod("GET", new apigateway.LambdaIntegration(samsAssociations));

		// GET /sams/clubs and GET /sams/clubs/{uuid}
		const clubsResource = samsResource.addResource("clubs");
		clubsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsClubs, {
				cacheKeyParameters: ["method.request.querystring.name", "method.request.querystring.association"],
			}),
			{
				requestParameters: {
					"method.request.querystring.name": false,
					"method.request.querystring.association": false,
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

		const clubsByUuid = clubsResource.addResource("{uuid}");
		clubsByUuid.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsClubs),
			{
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

		// GET /sams/teams and GET /sams/teams/{uuid}
		const teamsResource = samsResource.addResource("teams");
		teamsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsTeams, {
				cacheKeyParameters: [
					"method.request.querystring.name",
					"method.request.querystring.sportsclub",
					"method.request.querystring.league",
				],
			}),
			{
				requestParameters: {
					"method.request.querystring.name": false,
					"method.request.querystring.sportsclub": false,
					"method.request.querystring.league": false,
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

		const teamsByUuid = teamsResource.addResource("{uuid}");
		teamsByUuid.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsTeams),
			{
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
		const distribution = new cloudfront.Distribution(this, "SamsApiDistribution", {
			defaultBehavior: {
				origin: new origins.RestApiOrigin(api),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: new cloudfront.CachePolicy(this, "SamsApiCachePolicy", {
					cachePolicyName: "SamsApiCachePolicy",
					defaultTtl: cdk.Duration.minutes(5), // Default for live data (matches, rankings)
					maxTtl: cdk.Duration.days(7), // Max 7 days for static data (clubs synced weekly)
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

		new cdk.CfnOutput(this, "TeamsTableName", {
			value: teamsTable.tableName,
			description: "DynamoDB table name for teams",
		});

		new cdk.CfnOutput(this, "SyncRuleName", {
			value: syncRule.ruleName,
			description: "EventBridge rule name for nightly clubs sync",
		});

		new cdk.CfnOutput(this, "TeamsSyncRuleName", {
			value: teamsSyncRule.ruleName,
			description: "EventBridge rule name for nightly teams sync",
		});
	}
}
