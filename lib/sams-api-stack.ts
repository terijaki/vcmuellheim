import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import { Club } from "@/project.config";

interface SamsApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	hostedZone?: route53.IHostedZone;
	regionalCertificate?: acm.ICertificate;
	cloudFrontCertificate?: acm.ICertificate;
}

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

		const allowedOriginsSet = new Set<string>();
		allowedOriginsSet.add(Club.url);
		allowedOriginsSet.add(`https://new.${Club.domain}`);
		allowedOriginsSet.add(`https://${envPrefix}admin.new.${Club.domain}`);
		if (!isProd) {
			allowedOriginsSet.add("http://localhost:3081"); // CMS dev server
			allowedOriginsSet.add("http://localhost:3080"); // Website dev server
		}
		const allowedOrigins = Array.from(allowedOriginsSet);

		// Custom domain for API Gateway
		const samsDomain = `${envPrefix}sams.new.vcmuellheim.de`;

		// Create HTTP API Gateway (V2) with custom domain
		const apiDomainName =
			props?.hostedZone && props?.regionalCertificate
				? new apigatewayv2.DomainName(this, "SamsApiDomainName", {
						domainName: samsDomain,
						certificate: props.regionalCertificate,
					})
				: undefined;

		const api = new apigatewayv2.HttpApi(this, "SamsHttpApi", {
			apiName: `SAMS API Proxy (${environment}${branchSuffix})`,
			description: `API proxy for SAMS volleyball data - ${environment}${branchSuffix}`,
			...(apiDomainName ? { defaultDomainMapping: { domainName: apiDomainName } } : {}),
			corsPreflight: {
				allowOrigins: allowedOrigins,
				allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
				allowHeaders: ["content-type", "x-api-key", "authorization", "x-trpc-source"],
				exposeHeaders: ["content-type"],
				allowCredentials: false,
				maxAge: cdk.Duration.hours(1),
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
			environment: {
				...commonEnvironment,
				CLUBS_TABLE_NAME: clubsTable.tableName,
			},
			timeout: cdk.Duration.seconds(60),
			memorySize: 512,
			bundling: {
				externalModules: [],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant league matches Lambda read access to clubs table
		clubsTable.grantReadData(samsLeagueMatches);

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

		// Helper to create cache policy for SAMS API endpoints
		const createCachePolicy = (name: string, queryParams: string[], ttl: { default: cdk.Duration; max: cdk.Duration }) => {
			return new cloudfront.CachePolicy(this, `SamsApi${name}CachePolicy`, {
				cachePolicyName: `sams-api-${name.toLowerCase()}-cache-${environment}${branchSuffix}`,
				defaultTtl: ttl.default,
				maxTtl: ttl.max,
				minTtl: cdk.Duration.seconds(0),
				queryStringBehavior: queryParams.length > 0 ? cloudfront.CacheQueryStringBehavior.allowList(...queryParams) : cloudfront.CacheQueryStringBehavior.none(),
				headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization", "X-Api-Key", "Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"),
			});
		};

		// Use a single shared origin request policy for all behaviors
		const sharedOriginPolicy = new cloudfront.OriginRequestPolicy(this, "SamsApiSharedOriginPolicy", {
			originRequestPolicyName: `sams-api-shared-origin-${environment}${branchSuffix}`,
			headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"),
			queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
			cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
		});

		// TTL configurations
		const LIVE_DATA_TTL = { default: cdk.Duration.minutes(5), max: cdk.Duration.hours(1) };
		const STATIC_DATA_TTL = { default: cdk.Duration.hours(12), max: cdk.Duration.days(7) };

		// Extract domain from API endpoint (removes https:// prefix)
		// We need to do this in CloudFormation using Fn::Select and Fn::Split
		const apiGatewayDomain = cdk.Fn.select(2, cdk.Fn.split("/", api.apiEndpoint));

		// Use L1 construct to have full control over origin configuration
		const apiGatewayOrigin: cloudfront.IOrigin = {
			bind: (_scope: cdk.Stack, _options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig => {
				return {
					originProperty: {
						id: `ApiGatewayOrigin-${environment}${branchSuffix}`,
						domainName: apiGatewayDomain,
						customOriginConfig: {
							originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
							originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
						},
					},
				};
			},
		}; // Helper to create behavior for a path
		const createBehavior = (name: string, queryParams: string[], ttl: { default: cdk.Duration; max: cdk.Duration }) => {
			return {
				origin: apiGatewayOrigin, // Reuse the same origin for all behaviors
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: createCachePolicy(name, queryParams, ttl),
				allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
				cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
				originRequestPolicy: sharedOriginPolicy, // Use shared policy for all behaviors
				responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
			};
		};

		// Create HTTP API Gateway routes
		// HTTP API V2 uses simple route definitions instead of resources + methods

		// GET /matches
		api.addRoutes({
			path: "/matches",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("MatchesIntegration", samsLeagueMatches),
		});

		// GET /seasons
		api.addRoutes({
			path: "/seasons",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("SeasonsIntegration", samsSeasons),
		});

		// GET /rankings/{leagueUuid}
		api.addRoutes({
			path: "/rankings/{leagueUuid}",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("RankingsIntegration", samsRankings),
		});

		// GET /associations and GET /associations/{uuid}
		api.addRoutes({
			path: "/associations",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("AssociationsListIntegration", samsAssociations),
		});

		api.addRoutes({
			path: "/associations/{uuid}",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("AssociationsDetailIntegration", samsAssociations),
		});

		// GET /clubs and GET /clubs/{uuid}
		api.addRoutes({
			path: "/clubs",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("ClubsListIntegration", samsClubs),
		});

		api.addRoutes({
			path: "/clubs/{uuid}",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("ClubsDetailIntegration", samsClubs),
		});

		// GET /teams and GET /teams/{uuid}
		api.addRoutes({
			path: "/teams",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("TeamsListIntegration", samsTeams),
		});

		api.addRoutes({
			path: "/teams/{uuid}",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: new HttpLambdaIntegration("TeamsDetailIntegration", samsTeams),
		});

		// Create CloudFront distribution for caching
		const distribution = new cloudfront.Distribution(this, "SamsApiDistribution", {
			defaultBehavior: createBehavior("Default", [], STATIC_DATA_TTL),
			// Path-specific cache behaviors for endpoints that use query parameters
			additionalBehaviors: {
				"/matches": createBehavior("Matches", ["league", "season", "sportsclub", "team", "limit", "range"], LIVE_DATA_TTL),
				"/rankings/*": createBehavior("Rankings", [], LIVE_DATA_TTL),
				"/clubs": createBehavior("Clubs", ["name", "slug"], STATIC_DATA_TTL),
				"/clubs/*": createBehavior("ClubsDetail", [], STATIC_DATA_TTL),
				"/teams": createBehavior("Teams", ["name", "slug"], STATIC_DATA_TTL),
				"/teams/*": createBehavior("TeamsDetail", [], STATIC_DATA_TTL),
				"/associations": createBehavior("Associations", ["name"], STATIC_DATA_TTL),
				"/associations/*": createBehavior("AssociationsDetail", [], STATIC_DATA_TTL),
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
			value: api.apiEndpoint,
			description: "API Gateway URL",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: this.cloudFrontUrl,
			description: "CloudFront Distribution URL",
		});
	}
}
