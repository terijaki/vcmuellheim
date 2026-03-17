/**
 * CDK Stack for the combined WebApp (TanStack Start / Nitro aws-lambda preset)
 *
 * Replaces: WebsiteStack + CmsStack + ApiStack
 *
 * Architecture:
 * - Lambda Function URL (streaming) ← Nitro server handler (.output/server/index.mjs)
 * - CloudFront distribution
 *   · Default behavior → Lambda Function URL (all requests: SSR + API routes)
 *   · /assets/* behavior → S3 static assets origin (immutable, long TTL)
 * - S3 bucket for static assets (.output/public/)
 * - Route53 A record pointing to CloudFront
 */

import { execFileSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type * as s3Bucket from "aws-cdk-lib/aws-s3";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { Club } from "@/project.config";
import { type TableEntity, toTableEnvironment } from "./db/env";

export interface WebAppStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentDbStack: Record<`${Lowercase<TableEntity>}Table`, dynamodb.Table>;
	samsApiStack: {
		samsClubsTable: dynamodb.Table;
		samsTeamsTable: dynamodb.Table;
	};
	instagramTable: dynamodb.ITable;
	mediaBucket: s3Bucket.Bucket;
	hostedZone?: route53.IHostedZone;
	/** CloudFront certificate (must be in us-east-1) */
	cloudFrontCertificate?: acm.ICertificate;
}

export class WebAppStack extends cdk.Stack {
	public readonly distribution: cloudfront.Distribution;
	public readonly webappLambda: lambda.Function;
	public readonly webappUrl: string;

	constructor(scope: Construct, id: string, props: WebAppStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";
		const isCdkDestroy = process.env.CDK_DESTROY === "true";
		const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;
		// prod: vcmuellheim.de  dev: new.vcmuellheim.de  feature: dev-<branch>.new.vcmuellheim.de
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}.`;
		const webappDomain = isProd ? Club.domain : `${envPrefix}${baseDomain}`;

		if (!isCdkDestroy && !process.env.BETTER_AUTH_SECRET) {
			throw new Error("❌ BETTER_AUTH_SECRET environment variable is required");
		}

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

		// CloudFront URL is set after distribution creation, so we use a placeholder
		// The Lambda will be updated post-deployment or via a Cfn custom resource.
		// For now we derive the URL from the domain name if custom domain is configured.
		const cloudfrontUrl = props.hostedZone && props.cloudFrontCertificate ? `https://${webappDomain}` : undefined;

		// Build the webapp once upfront so .output/server and .output/public exist
		execFileSync("bun", ["run", "build:webapp"], {
			env: { ...process.env, VITE_CDK_ENVIRONMENT: environment },
			cwd: process.cwd(),
			stdio: "inherit",
		});

		const lambdaEnvironment: Record<string, string> = {
			...tableEnvironment,
			CDK_ENVIRONMENT: environment,
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
			MEDIA_BUCKET_NAME: props.mediaBucket.bucketName,
			SAMS_CLUBS_TABLE_NAME: props.samsApiStack.samsClubsTable.tableName,
			SAMS_TEAMS_TABLE_NAME: props.samsApiStack.samsTeamsTable.tableName,
			INSTAGRAM_TABLE_NAME: props.instagramTable.tableName,
			...(process.env.SAMS_API_KEY ? { SAMS_API_KEY: process.env.SAMS_API_KEY } : {}),
			...(cloudfrontUrl ? { CLOUDFRONT_URL: cloudfrontUrl } : {}),
			NODE_ENV: "production",
		};

		// ── S3 bucket for static assets (.output/public/) ───────────────────────
		const assetsBucket = new s3.Bucket(this, "WebAppAssetsBucket", {
			bucketName: `${Club.slug}-webapp-assets-${environment}${branchSuffix}`,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: !isProd,
		});

		// ── Lambda Function (Nitro aws-lambda output) ────────────────────────────
		const logGroup = new cdk.aws_logs.LogGroup(this, "WebAppLogGroup", {
			retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		// AWS Lambda Powertools Layer for structured logging and X-Ray tracing
		const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "PowertoolsLayer", `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:41`);

		// Nitro's aws-lambda preset outputs a single ESM handler file
		this.webappLambda = new lambda.Function(this, "WebAppLambda", {
			functionName: `vcm-webapp-${environment}${branchSuffix}`,
			code: lambda.Code.fromAsset("apps/webapp/.output/server"),
			handler: "index.handler",
			runtime: lambda.Runtime.NODEJS_24_X,
			timeout: cdk.Duration.seconds(30),
			memorySize: 1024,
			layers: [powertoolsLayer],
			logGroup,
			environment: lambdaEnvironment,
			tracing: lambda.Tracing.ACTIVE,
		});

		// Grant Lambda access to all content tables
		for (const table of Object.values(tables)) {
			table.grantReadWriteData(this.webappLambda);
		}
		props.samsApiStack.samsClubsTable.grantReadWriteData(this.webappLambda);
		props.samsApiStack.samsTeamsTable.grantReadWriteData(this.webappLambda);
		props.instagramTable.grantReadData(this.webappLambda);

		// Grant S3 access for media uploads and reads
		props.mediaBucket.grantReadWrite(this.webappLambda);

		// Grant SES access for OTP emails
		this.webappLambda.addToRolePolicy(
			new cdk.aws_iam.PolicyStatement({
				effect: cdk.aws_iam.Effect.ALLOW,
				actions: ["ses:SendEmail", "ses:SendRawEmail"],
				resources: [`arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/vcmuellheim.de`],
			}),
		);

		// Lambda Function URL (NONE auth — CloudFront handles access control)
		const fnUrl = this.webappLambda.addFunctionUrl({
			authType: lambda.FunctionUrlAuthType.NONE,
			invokeMode: lambda.InvokeMode.BUFFERED,
		});

		// ── Cache policies ─────────────────────────────────────────────────────
		// Static assets: vite injects content hashes → can cache indefinitely
		const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, "StaticAssetsCachePolicy", {
			cachePolicyName: `vcm-webapp-static-${environment}${branchSuffix}`,
			defaultTtl: cdk.Duration.days(365),
			minTtl: cdk.Duration.days(1),
			maxTtl: cdk.Duration.days(365),
			comment: "Long-lived cache for hashed static assets",
		});

		// SSR/API: no cache by default — let the app set Cache-Control headers
		const ssrCachePolicy = isProd
			? cloudfront.CachePolicy.CACHING_DISABLED
			: new cloudfront.CachePolicy(this, "SsrCachePolicy", {
					cachePolicyName: `vcm-webapp-ssr-${environment}${branchSuffix}`,
					defaultTtl: cdk.Duration.seconds(0),
					minTtl: cdk.Duration.seconds(0),
					maxTtl: cdk.Duration.seconds(60),
					comment: "Dev: passthrough (no cache) for SSR + API",
				});

		// ── CloudFront distribution ────────────────────────────────────────────
		const lambdaOrigin = new origins.FunctionUrlOrigin(fnUrl);
		const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket);

		this.distribution = new cloudfront.Distribution(this, "WebAppDistribution", {
			defaultBehavior: {
				origin: lambdaOrigin,
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
				cachePolicy: ssrCachePolicy,
				originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
				compress: true,
			},
			additionalBehaviors: {
				// Nitro outputs static assets under /assets/ (Vite build)
				"/assets/*": {
					origin: s3Origin,
					viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
					cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
					cachePolicy: staticAssetsCachePolicy,
					compress: true,
				},
				// Public root-level static files (favicon, robots.txt, etc.)
				"/_build/*": {
					origin: s3Origin,
					viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
					cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
					cachePolicy: staticAssetsCachePolicy,
					compress: true,
				},
			},
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
			comment: isProd ? "VCM WebApp (Prod)" : `VCM WebApp (${environment}${branchSuffix})`,
			...(props.cloudFrontCertificate && props.hostedZone
				? {
						domainNames: [webappDomain],
						certificate: props.cloudFrontCertificate,
					}
				: {}),
		});

		// ── Static asset deployment ────────────────────────────────────────────
		new s3deploy.BucketDeployment(this, "WebAppAssetsDeployment", {
			sources: [s3deploy.Source.asset("apps/webapp/.output/public")],
			destinationBucket: assetsBucket,
			distribution: this.distribution,
			distributionPaths: ["/assets/*", "/_build/*"],
			prune: true,
			memoryLimit: 512,
		});

		// ── DNS record ─────────────────────────────────────────────────────────
		if (props.hostedZone && props.cloudFrontCertificate) {
			new route53.ARecord(this, "WebAppARecord", {
				zone: props.hostedZone,
				recordName: webappDomain,
				target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
			});

			this.webappUrl = `https://${webappDomain}`;
		} else {
			this.webappUrl = `https://${this.distribution.distributionDomainName}`;
		}

		// ── Outputs ────────────────────────────────────────────────────────────
		new cdk.CfnOutput(this, "WebAppUrl", {
			value: this.webappUrl,
			description: "VCM WebApp URL",
			exportName: `vcm-webapp-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "WebAppDistributionId", {
			value: this.distribution.distributionId,
			description: "CloudFront Distribution ID",
		});

		new cdk.CfnOutput(this, "WebAppLambdaArn", {
			value: this.webappLambda.functionArn,
			description: "WebApp Lambda Function ARN",
		});
	}
}
