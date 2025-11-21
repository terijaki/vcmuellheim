import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
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

		if (!samsApiKey) {
			throw new Error("❌ SAMS_API_KEY environment variable is required");
		}
		if (!samsServer) {
			throw new Error("❌ SAMS_SERVER environment variable is required");
		}

		const commonEnvironment = {
			SAMS_API_KEY: samsApiKey,
			SAMS_SERVER: samsServer,
		};

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
	}
}
