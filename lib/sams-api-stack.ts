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
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type {
	SamsAssociationsLambdaEnvironment,
	SamsClubsLambdaEnvironment,
	SamsClubsSyncLambdaEnvironment,
	SamsCommonLambdaEnvironment,
	SamsLeagueMatchesLambdaEnvironment,
	SamsRankingsLambdaEnvironment,
	SamsSeasonsLambdaEnvironment,
	SamsTeamsLambdaEnvironment,
	SamsTeamsSyncLambdaEnvironment,
} from "@/lambda/sams/types";
import { Club } from "@/project.config";
import { getSamsDataTableName } from "./db/env";

interface SamsApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	hostedZone?: route53.IHostedZone;
	regionalCertificate?: acm.ICertificate;
	cloudFrontCertificate?: acm.ICertificate;
	mediaBucket?: s3.IBucket;
	mediaCloudFrontUrl?: string;
}

export class SamsApiStack extends cdk.Stack {
	public readonly cloudFrontUrl: string;
	public readonly samsDataTable: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: SamsApiStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;

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
		const samsDomain = `${envPrefix}sams.${baseDomain}`;

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
		const isCdkDestroy = process.env.CDK_DESTROY === "true";

		if (!isCdkDestroy) {
			if (!samsApiKey) throw new Error("❌ SAMS_API_KEY environment variable is required");
			if (!samsServer) throw new Error("❌ SAMS_SERVER environment variable is required");
		}

		const commonEnvironment = {
			SAMS_API_KEY: samsApiKey || "",
			SAMS_SERVER: samsServer || "",
			CDK_ENVIRONMENT: environment,
		} satisfies SamsCommonLambdaEnvironment;

		// Create single DynamoDB table for all SAMS data
		const samsDataTable = new dynamodb.Table(this, "SamsDataTable", {
			tableName: getSamsDataTableName(environment, branch),
			partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl",
		});

		// GSI1 — type-based list queries for clubs and teams
		samsDataTable.addGlobalSecondaryIndex({
			indexName: "GSI1-BySamsType",
			partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI2 — season-scoped team queries
		samsDataTable.addGlobalSecondaryIndex({
			indexName: "GSI2-BySamsSeasonUuid",
			partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// Expose table for cross-stack reference
		this.samsDataTable = samsDataTable;

		// Create Lambda function for league matches (main endpoint you use)
		const samsLeagueMatches = new NodejsFunction(this, "SamsLeagueMatches", {
			functionName: `sams-league-matches-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-league-matches.ts"),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
			} satisfies SamsLeagueMatchesLambdaEnvironment,
			timeout: cdk.Duration.seconds(60),
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsLeagueMatchesLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant league matches Lambda read access to sams data table
		samsDataTable.grantReadData(samsLeagueMatches);

		// Create Lambda function for seasons
		const samsSeasons = new NodejsFunction(this, "SamsSeasons", {
			functionName: `sams-seasons-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-seasons.ts"),
			environment: commonEnvironment satisfies SamsSeasonsLambdaEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsSeasonsLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for rankings
		const samsRankings = new NodejsFunction(this, "SamsRankings", {
			functionName: `sams-rankings-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-rankings.ts"),
			environment: commonEnvironment satisfies SamsRankingsLambdaEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsRankingsLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for associations
		const samsAssociations = new NodejsFunction(this, "SamsAssociations", {
			functionName: `sams-associations-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-associations.ts"),
			environment: commonEnvironment satisfies SamsAssociationsLambdaEnvironment,
			timeout: cdk.Duration.seconds(60), // Longer timeout for pagination
			memorySize: 256,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsAssociationsLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Create Lambda function for nightly clubs sync
		const samsClubsSync = new NodejsFunction(this, "SamsClubsSync", {
			functionName: `sams-clubs-sync-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-clubs-sync.ts"),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
				MEDIA_BUCKET_NAME: props?.mediaBucket?.bucketName ?? "",
				MEDIA_CLOUDFRONT_URL: props?.mediaCloudFrontUrl ?? "",
			} satisfies SamsClubsSyncLambdaEnvironment,
			timeout: cdk.Duration.minutes(10), // Longer timeout for paginated sync
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsClubsSyncLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to clubs sync Lambda
		samsDataTable.grantReadWriteData(samsClubsSync);
		props?.mediaBucket?.grantWrite(samsClubsSync);

		// Create Lambda function for nightly teams sync
		const samsTeamsSync = new NodejsFunction(this, "SamsTeamsSync", {
			functionName: `sams-teams-sync-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-teams-sync.ts"),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
			} satisfies SamsTeamsSyncLambdaEnvironment,
			timeout: cdk.Duration.minutes(10),
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsTeamsSyncLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB permissions to teams sync Lambda
		samsDataTable.grantReadWriteData(samsTeamsSync);

		// Create Lambda function for clubs query (read from DynamoDB)
		const samsClubs = new NodejsFunction(this, "SamsClubs", {
			functionName: `sams-clubs-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-clubs.ts"),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
			} satisfies SamsClubsLambdaEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsClubsLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB read permissions to clubs query Lambda
		samsDataTable.grantReadData(samsClubs);

		// Create Lambda function for teams query (read from DynamoDB)
		const samsTeams = new NodejsFunction(this, "SamsTeams", {
			functionName: `sams-teams-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/sams/sams-teams.ts"),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
			} satisfies SamsTeamsLambdaEnvironment,
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "SamsTeamsLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant DynamoDB read permissions to teams query Lambda
		samsDataTable.grantReadData(samsTeams);

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

		// Use a single shared origin request policy for all behaviors
		const sharedOriginPolicy = new cloudfront.OriginRequestPolicy(this, "SamsApiSharedOriginPolicy", {
			originRequestPolicyName: `sams-api-shared-origin-${environment}${branchSuffix}`,
			headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"),
			queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
			cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
		});

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
		};

		// Shared behavior configuration for all CloudFront paths
		// Using AWS-managed policy that respects Lambda Cache-Control headers AND includes query strings
		const sharedBehavior = {
			origin: apiGatewayOrigin,
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			cachePolicy: cloudfront.CachePolicy.USE_ORIGIN_CACHE_CONTROL_HEADERS_QUERY_STRINGS,
			allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
			cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
			originRequestPolicy: sharedOriginPolicy,
			responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
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
			defaultBehavior: sharedBehavior,
			additionalBehaviors: {
				"/matches": sharedBehavior,
				"/rankings/*": sharedBehavior,
				"/clubs": sharedBehavior,
				"/clubs/*": sharedBehavior,
				"/teams": sharedBehavior,
				"/teams/*": sharedBehavior,
				"/associations": sharedBehavior,
				"/associations/*": sharedBehavior,
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
