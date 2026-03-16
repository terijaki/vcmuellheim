import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { IcsCalendarLambdaEnvironment, S3CleanupLambdaEnvironment, SitemapLambdaEnvironment, TrpcLambdaEnvironment } from "@/lambda/content/types";
import { Club } from "@/project.config";
import { type TableEntity, toTableEnvironment } from "./db/env";

interface ApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentDbStack: Record<`${Lowercase<TableEntity>}Table`, dynamodb.Table>;
	samsApiStack?: {
		samsClubsTable: dynamodb.Table;
		samsTeamsTable: dynamodb.Table;
	};
	samsApiUrl?: string;
	mediaBucket?: s3.Bucket;
	cloudFrontUrl?: string;
	cmsUrl?: string;
	websiteUrl?: string;
	hostedZone: route53.IHostedZone;
	regionalCertificate: acm.ICertificate;
}

export class ApiStack extends cdk.Stack {
	public readonly api: apigatewayv2.HttpApi;
	public readonly trpcLambda: lambda.Function;
	public readonly apiDomainName?: apigatewayv2.DomainName;
	public readonly apiUrl: string;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";
		const isCdkDestroy = process.env.CDK_DESTROY === "true";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;
		const apiDomain = `${envPrefix}api.${baseDomain}`;
		const cmsDomain = `${envPrefix}admin.${baseDomain}`;

		if (!isCdkDestroy && !process.env.BETTER_AUTH_SECRET) {
			throw new Error("❌ BETTER_AUTH_SECRET environment variable is required");
		}

		// 1. tRPC Lambda Function
		const tables = {
			NEWS: props.contentDbStack.newsTable,
			EVENTS: props.contentDbStack.eventsTable,
			TEAMS: props.contentDbStack.teamsTable,
			MEMBERS: props.contentDbStack.membersTable,
			MEDIA: props.contentDbStack.mediaTable,
			SPONSORS: props.contentDbStack.sponsorsTable,
			LOCATIONS: props.contentDbStack.locationsTable,
			BUS: props.contentDbStack.busTable,
			USERS: props.contentDbStack.usersTable,
			AUTH_VERIFICATIONS: props.contentDbStack.auth_verificationsTable,
		} satisfies Record<TableEntity, dynamodb.Table>;

		const tableEnvironment = toTableEnvironment({
			NEWS: tables.NEWS.tableName,
			EVENTS: tables.EVENTS.tableName,
			TEAMS: tables.TEAMS.tableName,
			MEMBERS: tables.MEMBERS.tableName,
			MEDIA: tables.MEDIA.tableName,
			SPONSORS: tables.SPONSORS.tableName,
			LOCATIONS: tables.LOCATIONS.tableName,
			BUS: tables.BUS.tableName,
			USERS: tables.USERS.tableName,
			AUTH_VERIFICATIONS: tables.AUTH_VERIFICATIONS.tableName,
		} satisfies Record<TableEntity, string>);

		const trpcEnvironment = {
			...tableEnvironment,
			CDK_ENVIRONMENT: environment,
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
			...(props.mediaBucket ? { MEDIA_BUCKET_NAME: props.mediaBucket.bucketName } : {}),
			...(props.cloudFrontUrl ? { CLOUDFRONT_URL: props.cloudFrontUrl } : {}),
			...(props.samsApiStack?.samsClubsTable ? { SAMS_CLUBS_TABLE_NAME: props.samsApiStack.samsClubsTable.tableName } : {}),
			...(props.samsApiStack?.samsTeamsTable ? { SAMS_TEAMS_TABLE_NAME: props.samsApiStack.samsTeamsTable.tableName } : {}),
		} satisfies TrpcLambdaEnvironment;

		// AWS Lambda Powertools Layer for structured logging and X-Ray tracing
		const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "PowertoolsLayer", `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:41`);

		const trpcLogGroup = new cdk.aws_logs.LogGroup(this, "TrpcLogGroup", {
			retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		this.trpcLambda = new NodejsFunction(this, "TrpcApiLambda", {
			functionName: `vcm-trpc-api-${environment}${branchSuffix}`,
			entry: "lambda/content/handler.ts",
			handler: "handler",
			runtime: lambda.Runtime.NODEJS_24_X,
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			layers: [powertoolsLayer],
			logGroup: trpcLogGroup,
			environment: trpcEnvironment,
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: [
					"@aws-sdk/client-dynamodb",
					"@aws-sdk/lib-dynamodb",
					"@aws-sdk/client-s3",
					"@aws-sdk/client-ses",
					"@aws-sdk/s3-request-presigner",
					"@aws-lambda-powertools/logger",
					"@aws-lambda-powertools/tracer",
					"aws-xray-sdk-core",
				],
			},
		});

		// Grant Lambda access to DynamoDB tables (including USERS and AUTH_VERIFICATIONS)
		for (const table of Object.values(tables)) {
			table.grantReadWriteData(this.trpcLambda);
		}

		// Grant DynamoDB access to SAMS tables
		if (props.samsApiStack?.samsTeamsTable) {
			props.samsApiStack.samsTeamsTable.grantReadWriteData(this.trpcLambda);
		}
		if (props.samsApiStack?.samsClubsTable) {
			props.samsApiStack.samsClubsTable.grantReadWriteData(this.trpcLambda);
		}

		// Grant Lambda access to S3 bucket for uploads
		if (props.mediaBucket) {
			props.mediaBucket.grantPut(this.trpcLambda);
			props.mediaBucket.grantRead(this.trpcLambda);
		}

		// Grant Lambda permission to send emails via SES (for OTP emails)
		this.trpcLambda.addToRolePolicy(
			new cdk.aws_iam.PolicyStatement({
				effect: cdk.aws_iam.Effect.ALLOW,
				actions: ["ses:SendEmail", "ses:SendRawEmail"],
				resources: [`arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/vcmuellheim.de`],
			}),
		);

		// ICS Calendar Lambda
		const icsLogGroup = new cdk.aws_logs.LogGroup(this, "IcsLogGroup", {
			retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		const icsLambda = new NodejsFunction(this, "IcsCalendarLambda", {
			functionName: `vcm-ics-calendar-${environment}${branchSuffix}`,
			entry: "lambda/content/ics-calendar.ts",
			handler: "handler",
			runtime: lambda.Runtime.NODEJS_24_X,
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			logGroup: icsLogGroup,
			environment: {
				TEAMS_TABLE_NAME: tables.TEAMS.tableName,
				EVENTS_TABLE_NAME: tables.EVENTS.tableName,
				SAMS_API_URL: props.samsApiUrl || "",
			} satisfies IcsCalendarLambdaEnvironment,
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
			},
		});

		// Grant ICS Lambda read access to Teams and Events tables
		tables.TEAMS.grantReadData(icsLambda);
		tables.EVENTS.grantReadData(icsLambda);

		// Sitemap Lambda
		const sitemapLogGroup = new cdk.aws_logs.LogGroup(this, "SitemapLogGroup", {
			retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		const sitemapLambda = new NodejsFunction(this, "SitemapLambda", {
			functionName: `vcm-sitemap-${environment}${branchSuffix}`,
			entry: "lambda/content/sitemap.ts",
			handler: "handler",
			runtime: lambda.Runtime.NODEJS_24_X,
			timeout: cdk.Duration.seconds(30),
			memorySize: 256,
			logGroup: sitemapLogGroup,
			environment: {
				...tableEnvironment,
				WEBSITE_URL: props.websiteUrl || `https://${Club.domain}`,
			} satisfies SitemapLambdaEnvironment,
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
			},
		});

		// Grant Sitemap Lambda read access to content tables
		for (const table of Object.values(tables)) {
			table.grantReadData(sitemapLambda);
		}

		// S3 Cleanup Lambda - triggered by DynamoDB Streams
		const s3CleanupLogGroup = new cdk.aws_logs.LogGroup(this, "S3CleanupLogGroup", {
			retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		const s3CleanupLambda = new NodejsFunction(this, "S3CleanupLambda", {
			functionName: `vcm-s3-cleanup-${environment}${branchSuffix}`,
			entry: "lambda/content/s3-cleanup.ts",
			handler: "handler",
			runtime: lambda.Runtime.NODEJS_24_X,
			timeout: cdk.Duration.seconds(60),
			memorySize: 256,
			logGroup: s3CleanupLogGroup,
			environment: {
				MEDIA_BUCKET_NAME: props.mediaBucket?.bucketName || "",
			} satisfies S3CleanupLambdaEnvironment,
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/client-s3", "@aws-sdk/util-dynamodb"],
			},
		});
		if (props.mediaBucket) {
			props.mediaBucket.grantDelete(s3CleanupLambda);
			props.mediaBucket.grantRead(s3CleanupLambda); // find related keys from image transformations
		}

		// Attach DynamoDB stream event sources to S3 Cleanup Lambda
		// Listen to REMOVE and MODIFY events on all content tables
		const streamTables = [tables.NEWS, tables.TEAMS, tables.MEMBERS, tables.MEDIA, tables.SPONSORS];
		for (const table of streamTables) {
			table.grantStreamRead(s3CleanupLambda);
			// Add DynamoDB stream event source
			s3CleanupLambda.addEventSource(
				new DynamoEventSource(table, {
					startingPosition: lambda.StartingPosition.LATEST,
					bisectBatchOnError: true,
					retryAttempts: 2,
				}),
			);
		}

		// 2. HTTP API Gateway with custom domain
		// Custom domain for API
		this.apiDomainName = new apigatewayv2.DomainName(this, "ApiDomainName", {
			domainName: apiDomain,
			certificate: props.regionalCertificate,
		});

		// Build explicit allowed origins for CORS. When `allowCredentials` is
		// enabled, `Access-Control-Allow-Origin` must not be `*` so we use a
		// whitelist that includes localhost (dev), the admin domain and any
		// provided CloudFront or CMS URLs.
		const allowedOriginsSet = new Set<string>();
		allowedOriginsSet.add(Club.url);
		allowedOriginsSet.add(`https://${envPrefix}admin.${baseDomain}`);
		if (!isProd) {
			allowedOriginsSet.add("http://localhost:3081"); // CMS dev server
			allowedOriginsSet.add("http://localhost:3080"); // Website dev server
		}
		if (props.cloudFrontUrl) {
			const cloudFrontOrigin = props.cloudFrontUrl.startsWith("https://") ? props.cloudFrontUrl : `https://${props.cloudFrontUrl}`;
			allowedOriginsSet.add(cloudFrontOrigin);
		}
		if (props.cmsUrl) {
			const cmsOrigin = props.cmsUrl.startsWith("https://") ? props.cmsUrl : `https://${props.cmsUrl}`;
			allowedOriginsSet.add(cmsOrigin);
		}
		if (props.websiteUrl) {
			const websiteOrigin = props.websiteUrl.startsWith("https://") ? props.websiteUrl : `https://${props.websiteUrl}`;
			allowedOriginsSet.add(websiteOrigin);
		}

		const allowedOrigins = Array.from(allowedOriginsSet);
		this.api = new apigatewayv2.HttpApi(this, "TrpcHttpApi", {
			apiName: `vcm-trpc-api-${environment}${branchSuffix}`,
			description: "tRPC API for VCM admin and public endpoints",
			defaultDomainMapping: {
				domainName: this.apiDomainName,
			},
			corsPreflight: {
				allowOrigins: allowedOrigins,
				allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
				allowHeaders: isProd ? ["content-type", "authorization", "x-trpc-source", "cookie"] : ["content-type", "authorization", "x-trpc-source", "cookie", "*"],
				exposeHeaders: ["content-type", "set-cookie"],
				allowCredentials: true, // Required for session cookies
				maxAge: cdk.Duration.hours(1),
			},
		});

		// Create A record pointing to API Gateway
		new route53.ARecord(this, "ApiARecord", {
			zone: props.hostedZone,
			recordName: apiDomain,
			target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(this.apiDomainName.regionalDomainName, this.apiDomainName.regionalHostedZoneId)),
		});

		this.apiUrl = `https://${apiDomain}`;

		// Lambda integration
		const lambdaIntegration = new HttpLambdaIntegration("TrpcLambdaIntegration", this.trpcLambda);
		const icsIntegration = new HttpLambdaIntegration("IcsCalendarIntegration", icsLambda);
		const sitemapIntegration = new HttpLambdaIntegration("SitemapIntegration", sitemapLambda);

		// Route all /api/* requests to Lambda (excluding OPTIONS which is handled by CORS preflight)
		this.api.addRoutes({
			path: "/api/{proxy+}",
			methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
			integration: lambdaIntegration,
		});

		// ICS Calendar routes
		this.api.addRoutes({
			path: "/ics/{teamSlug}",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: icsIntegration,
		});

		// Sitemap route
		this.api.addRoutes({
			path: "/sitemap.xml",
			methods: [apigatewayv2.HttpMethod.GET],
			integration: sitemapIntegration,
		});

		// Also accept requests without the `/api` prefix so deployed frontends
		// that call e.g. `/news.list` will reach the same Lambda and receive
		// CORS headers from API Gateway.
		this.api.addRoutes({
			path: "/{proxy+}",
			methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
			integration: lambdaIntegration,
		});

		// Outputs
		new cdk.CfnOutput(this, "ApiUrl", {
			value: this.apiUrl,
			description: "tRPC API URL",
			exportName: `vcm-trpc-api-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "AuthUrl", {
			value: `${this.apiUrl}/api/auth`,
			description: "better-auth URL",
			exportName: `vcm-auth-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "CmsDomain", {
			value: `https://${cmsDomain}`,
			description: "CMS admin URL",
			exportName: `vcm-cms-url-${environment}${branchSuffix}`,
		});
	}
}
