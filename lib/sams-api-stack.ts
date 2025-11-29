import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";

interface SamsApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	hostedZone?: route53.IHostedZone;
	cloudFrontCertificate?: acm.ICertificate;
}

// ...existing code...

export class SamsApiStack extends cdk.Stack {
	public readonly cloudFrontUrl: string;
	public readonly samsClubsTable: dynamodb.Table;
	public readonly samsTeamsTable: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: SamsApiStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;

		// Create API Gateway
		const api = new apigateway.RestApi(this, "SamsApi", {
			restApiName: `SAMS API Proxy (${environment}${branchSuffix})`,
			description: `API proxy for SAMS volleyball data - ${environment}${branchSuffix}`,
			defaultCorsPreflightOptions: {
				allowOrigins: apigateway.Cors.ALL_ORIGINS,
				allowMethods: apigateway.Cors.ALL_METHODS,
				allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "x-trpc-source"],
			},
			deployOptions: {
				stageName: "v1",
				// No API Gateway caching - CloudFront handles all caching based on Lambda Cache-Control headers
			},
		});

		// Environment variables for all Lambda functions
		const samsApiKey = process.env.SAMS_API_KEY;
		const samsServer = process.env.SAMS_SERVER;

		if (!samsApiKey || !samsServer) {
			const isCdkDestroy = process.argv.some((a) => /destroy/i.test(a));
			if (!isCdkDestroy) {
				if (!samsApiKey) throw new Error("❌ SAMS_API_KEY environment variable is required");
				if (!samsServer) throw new Error("❌ SAMS_SERVER environment variable is required");
			}
		}

		const commonEnvironment = {
			SAMS_API_KEY: samsApiKey || "",
			SAMS_SERVER: samsServer || "",
		};

		// Create DynamoDB table for storing SAMS clubs
		const clubsTable = new dynamodb.Table(this, "SamsClubsTable", {
			tableName: `sams-clubs-${environment}${branchSuffix}`,
			partitionKey: {
				name: "sportsclubUuid",
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl", // Auto-delete stale records
		});

		// GSI for querying by slug
		clubsTable.addGlobalSecondaryIndex({
			indexName: "GSI-SamsClubQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [{ name: "nameSlug", type: dynamodb.AttributeType.STRING }],
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// Create DynamoDB table for storing SAMS teams
		const teamsTable = new dynamodb.Table(this, "SamsTeamsTable", {
			tableName: `sams-teams-${environment}${branchSuffix}`,
			partitionKey: {
				name: "uuid",
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl",
		});

		// GSI for querying by slug (case-insensitive)
		teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-SamsTeamQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [{ name: "nameSlug", type: dynamodb.AttributeType.STRING }],
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// Expose tables for cross-stack reference
		this.samsClubsTable = clubsTable;
		this.samsTeamsTable = teamsTable;

		// Create Lambda function for league matches (main endpoint you use)
		const samsLeagueMatches = new nodejs.NodejsFunction(this, "SamsLeagueMatches", {
			functionName: `sams-league-matches-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-league-matches.ts"),
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
			functionName: `sams-seasons-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-seasons.ts"),
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
			functionName: `sams-rankings-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-rankings.ts"),
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
			functionName: `sams-associations-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-associations.ts"),
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
			functionName: `sams-clubs-sync-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-clubs-sync.ts"),
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
			functionName: `sams-teams-sync-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-teams-sync.ts"),
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
			functionName: `sams-clubs-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-clubs.ts"),
			environment: {
				...commonEnvironment,
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
			functionName: `sams-teams-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_LATEST,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-teams.ts"),
			environment: {
				...commonEnvironment,
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
			ruleName: `sams-clubs-weekly-sync-${environment}${branchSuffix}`,
			description: `Trigger SAMS clubs sync every Wednesday at 2 AM UTC (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				weekDay: "WED",
				hour: "2",
				minute: "0",
			}),
		}); // Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(samsClubsSync));

		// Create EventBridge rule to trigger teams sync nightly at 3 AM UTC
		const teamsSyncRule = new events.Rule(this, "SamsTeamsSyncRule", {
			ruleName: `sams-teams-nightly-sync-${environment}${branchSuffix}`,
			description: `Trigger SAMS teams sync every night at 3 AM UTC - after clubs sync (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				hour: "3",
				minute: "0",
			}),
		});

		// Add teams Lambda as target for EventBridge rule
		teamsSyncRule.addTarget(new targets.LambdaFunction(samsTeamsSync));

		// Create API Gateway resources
		const samsResource = api.root;
		// const samsResource = api.root.addResource("sams");

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
							"method.response.header.Access-Control-Allow-Origin": true,
							"method.response.header.Access-Control-Allow-Headers": true,
							"method.response.header.Access-Control-Allow-Methods": true,
						},
					},
				],
			},
		);

		// GET /sams/seasons
		const seasonsResource = samsResource.addResource("seasons");
		seasonsResource.addMethod("GET", new apigateway.LambdaIntegration(samsSeasons), {
			methodResponses: [
				{
					statusCode: "200",
					responseParameters: {
						"method.response.header.Cache-Control": true,
						"method.response.header.Access-Control-Allow-Origin": true,
						"method.response.header.Access-Control-Allow-Headers": true,
						"method.response.header.Access-Control-Allow-Methods": true,
					},
				},
			],
		});

		// GET /sams/rankings/{leagueUuid}
		const rankingsResource = samsResource.addResource("rankings");
		const rankingsByLeague = rankingsResource.addResource("{leagueUuid}");
		rankingsByLeague.addMethod("GET", new apigateway.LambdaIntegration(samsRankings), {
			methodResponses: [
				{
					statusCode: "200",
					responseParameters: {
						"method.response.header.Cache-Control": true,
						"method.response.header.Access-Control-Allow-Origin": true,
						"method.response.header.Access-Control-Allow-Headers": true,
						"method.response.header.Access-Control-Allow-Methods": true,
					},
				},
			],
		});

		// GET /sams/associations and GET /sams/associations/{uuid}
		const associationsResource = samsResource.addResource("associations");
		associationsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsAssociations, {
				cacheKeyParameters: ["method.request.querystring.name"],
			}),
			{
				requestParameters: {
					"method.request.querystring.name": false,
				},
				methodResponses: [
					{
						statusCode: "200",
						responseParameters: {
							"method.response.header.Access-Control-Allow-Origin": true,
							"method.response.header.Access-Control-Allow-Headers": true,
							"method.response.header.Access-Control-Allow-Methods": true,
						},
					},
				],
			},
		);

		const associationsByUuid = associationsResource.addResource("{uuid}");
		associationsByUuid.addMethod("GET", new apigateway.LambdaIntegration(samsAssociations), {
			methodResponses: [
				{
					statusCode: "200",
					responseParameters: {
						"method.response.header.Access-Control-Allow-Origin": true,
						"method.response.header.Access-Control-Allow-Headers": true,
						"method.response.header.Access-Control-Allow-Methods": true,
					},
				},
			],
		});

		// GET /sams/clubs and GET /sams/clubs/{uuid}
		const clubsResource = samsResource.addResource("clubs");
		clubsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsClubs, {
				cacheKeyParameters: ["method.request.querystring.name"],
			}),
			{
				requestParameters: {
					"method.request.querystring.name": false,
				},
				methodResponses: [
					{
						statusCode: "200",
						responseParameters: {
							"method.response.header.Cache-Control": true,
							"method.response.header.Access-Control-Allow-Origin": true,
							"method.response.header.Access-Control-Allow-Headers": true,
							"method.response.header.Access-Control-Allow-Methods": true,
						},
					},
				],
			},
		);

		const clubsByUuid = clubsResource.addResource("{uuid}");
		clubsByUuid.addMethod("GET", new apigateway.LambdaIntegration(samsClubs), {
			methodResponses: [
				{
					statusCode: "200",
					responseParameters: {
						"method.response.header.Cache-Control": true,
						"method.response.header.Access-Control-Allow-Origin": true,
						"method.response.header.Access-Control-Allow-Headers": true,
						"method.response.header.Access-Control-Allow-Methods": true,
					},
				},
			],
		});

		// GET /sams/teams and GET /sams/teams/{uuid}
		const teamsResource = samsResource.addResource("teams");
		teamsResource.addMethod(
			"GET",
			new apigateway.LambdaIntegration(samsTeams, {
				cacheKeyParameters: ["method.request.querystring.name"],
			}),
			{
				requestParameters: {
					"method.request.querystring.name": false,
				},
				methodResponses: [
					{
						statusCode: "200",
						responseParameters: {
							"method.response.header.Cache-Control": true,
							"method.response.header.Access-Control-Allow-Origin": true,
							"method.response.header.Access-Control-Allow-Headers": true,
							"method.response.header.Access-Control-Allow-Methods": true,
						},
					},
				],
			},
		);

		const teamsByUuid = teamsResource.addResource("{uuid}");
		teamsByUuid.addMethod("GET", new apigateway.LambdaIntegration(samsTeams), {
			methodResponses: [
				{
					statusCode: "200",
					responseParameters: {
						"method.response.header.Cache-Control": true,
						"method.response.header.Access-Control-Allow-Origin": true,
						"method.response.header.Access-Control-Allow-Headers": true,
						"method.response.header.Access-Control-Allow-Methods": true,
					},
				},
			],
		});

		// Custom domain for CloudFront
		const samsDomain = `${envPrefix}sams.new.vcmuellheim.de`;

		// Create CloudFront distribution for caching
		const distribution = new cloudfront.Distribution(this, "SamsApiDistribution", {
			defaultBehavior: {
				origin: new origins.RestApiOrigin(api),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: new cloudfront.CachePolicy(this, "SamsApiCachePolicy", {
					cachePolicyName: `sams-api-cache-policy-${environment}${branchSuffix}`,
					defaultTtl: cdk.Duration.minutes(5), // Default for live data (matches, rankings)
					maxTtl: cdk.Duration.days(7), // Max 7 days for static data (clubs synced weekly)
					minTtl: cdk.Duration.seconds(0),
					queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
					headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
						"Authorization",
						"X-Api-Key",
						"Origin",
						"Access-Control-Request-Headers",
						"Access-Control-Request-Method"
					),
				}),
				allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
				cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
				originRequestPolicy: new cloudfront.OriginRequestPolicy(this, "SamsApiOriginRequestPolicy", {
					originRequestPolicyName: `sams-api-origin-policy-${environment}${branchSuffix}`,
					comment: "Forward all headers and methods needed for CORS preflight",
					headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
						"Origin",
						"Access-Control-Request-Method",
						"Access-Control-Request-Headers"
					),
					queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
					cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
				}),
			},
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Only US, Canada, Europe
			comment: `SAMS API CloudFront Distribution (${environment}${branchSuffix})`,
			...(props?.cloudFrontCertificate && props?.hostedZone
				? {
						domainNames: [samsDomain],
						certificate: props.cloudFrontCertificate,
					}
				: {}),
		});

		// Route53 record for custom domain
		if (props?.hostedZone && props?.cloudFrontCertificate) {
			new route53.ARecord(this, "SamsApiCloudFrontARecord", {
				zone: props.hostedZone,
				recordName: samsDomain,
				target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
			});
			this.cloudFrontUrl = `https://${samsDomain}`;
		} else {
			this.cloudFrontUrl = `https://${distribution.distributionDomainName}`;
		}

		// Outputs
		new cdk.CfnOutput(this, "ApiGatewayUrl", {
			value: api.url,
			description: "API Gateway URL",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: this.cloudFrontUrl,
			description: "CloudFront Distribution URL",
		});
	}
}
