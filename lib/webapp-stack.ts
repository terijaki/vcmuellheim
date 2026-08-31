/**
 * CDK Stack for the combined WebApp (TanStack Start / Nitro aws-lambda preset)
 *
 * Replaces: WebsiteStack + CmsStack + ApiStack
 *
 * Architecture:
 * - Lambda Function URL (streaming) ← Nitro server handler (.output/server/index.mjs)
 * - CloudFront distribution
 *   · Default behavior → Lambda Function URL (all requests: SSR + API routes)
 *   · /api/sams/logos → Lambda Function URL (cached per club query string)
 *   · /assets/* behavior → S3 static assets origin (immutable, long TTL)
 *   · /docs/* behavior → S3 static assets origin (downloadable documents)
 * - S3 bucket for static assets (.output/public/)
 * - Route53 A record pointing to CloudFront
 */

import { execFileSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { Club } from "@project.config";
import {
  CONTENT_TABLE_ENV_VAR,
  SOCIAL_TABLE_ENV_VAR,
  computeResourceBranchSuffix,
  computeSamsDataTableName,
} from "./db/env";
import { buildWebappDomain, buildWebappUrl } from "@utils/webapp-url";

export interface WebAppStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
  contentTableName: string;
  socialTableName: string;
  mediaBucketName: string;
  /** CloudFront URL of the media stack — used for serving uploaded images */
  mediaCloudFrontUrl?: string;
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
    const branchSuffix = computeResourceBranchSuffix(environment, branch);
    const isProd = environment === "prod";
    const isCdkDestroy = process.env.CDK_DESTROY === "true";
    // prod: vcmuellheim.de  dev: dev.new.vcmuellheim.de  feature: dev-<branch>.new.vcmuellheim.de
    const webappDomain = buildWebappDomain(environment, branch);
    const webappDomainAliases = isProd ? [webappDomain, `www.${webappDomain}`] : [webappDomain];
    const webappUrl = buildWebappUrl(environment, branch);

    if (!isCdkDestroy && !process.env.BETTER_AUTH_SECRET) {
      throw new Error("❌ BETTER_AUTH_SECRET environment variable is required");
    }

    // Build the webapp once upfront so .output/server and .output/public exist
    if (!isCdkDestroy) {
      execFileSync("vp", ["build"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
    }

    // Compute ARNs for cross-stack table and bucket grants (no CF cross-stack reference)
    const stack = cdk.Stack.of(this);
    const contentTableArn = stack.formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: props.contentTableName,
    });
    const samsTableName = computeSamsDataTableName(environment, branch);
    const samsTableArn = stack.formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: samsTableName,
    });
    const socialTableArn = stack.formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: props.socialTableName,
    });

    const lambdaEnvironment: Record<string, string> = {
      [CONTENT_TABLE_ENV_VAR]: props.contentTableName,
      [SOCIAL_TABLE_ENV_VAR]: props.socialTableName,
      CDK_ENVIRONMENT: environment,
      APP_BASE_URL: webappUrl,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
      MEDIA_BUCKET_NAME: props.mediaBucketName,
      SAMS_TABLE_NAME: samsTableName,
      ...(branch ? { BRANCH_NAME: branch } : {}),
      ...(props.mediaCloudFrontUrl ? { MEDIA_CLOUDFRONT_URL: props.mediaCloudFrontUrl } : {}),
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
      logGroupName: `/vcm/${environment}${branchSuffix}/webapp/webapp`,
      retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Nitro's aws-lambda preset outputs a single ESM handler file
    this.webappLambda = new lambda.Function(this, "WebAppLambda", {
      functionName: `vcm-webapp-${environment}${branchSuffix}`,
      // During destroy the build output doesn't exist — use a stub so CDK can synthesize
      code: isCdkDestroy
        ? lambda.Code.fromInline("exports.handler = async () => {};")
        : lambda.Code.fromAsset("app/.output/server"),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      logGroup,
      environment: lambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant Lambda access to content, social, and SAMS tables via computed ARNs (no CF cross-stack exports)
    dynamodb.Table.fromTableArn(this, "ContentTableRef", contentTableArn).grantReadWriteData(
      this.webappLambda,
    );
    dynamodb.Table.fromTableArn(this, "SocialTableRef", socialTableArn).grantReadData(
      this.webappLambda,
    );
    this.webappLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["dynamodb:Query"],
        resources: [`${contentTableArn}/index/*`],
      }),
    );
    dynamodb.Table.fromTableArn(this, "SamsDataTableRef", samsTableArn).grantReadWriteData(
      this.webappLambda,
    );
    this.webappLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["dynamodb:Query"],
        resources: [`${samsTableArn}/index/*`],
      }),
    );

    // Grant S3 access for media uploads and reads
    s3.Bucket.fromBucketName(this, "MediaBucketRef", props.mediaBucketName).grantReadWrite(
      this.webappLambda,
    );

    // Grant SES access for OTP emails
    this.webappLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [
          `arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/${isProd ? Club.domain : `new.${Club.domain}`}`,
        ],
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

    // SSR/API: no cache by default — let the app set Cache-Control headers.
    // Club logos are a dedicated behavior so prod (CACHING_DISABLED default)
    // still caches /api/sams/logos?clubUuid=X separately from clubUuid=Y.
    const ssrCachePolicy = isProd
      ? cloudfront.CachePolicy.CACHING_DISABLED
      : new cloudfront.CachePolicy(this, "SsrCachePolicy", {
          cachePolicyName: `vcm-webapp-ssr-${environment}${branchSuffix}`,
          defaultTtl: cdk.Duration.seconds(0),
          minTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.seconds(60),
          comment: "Dev: passthrough (no cache) for SSR + API",
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        });

    const clubLogosCachePolicy = new cloudfront.CachePolicy(this, "ClubLogosCachePolicy", {
      cachePolicyName: `vcm-webapp-club-logos-${environment}${branchSuffix}`,
      defaultTtl: cdk.Duration.days(1),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.days(7),
      comment: "Cache /api/sams/logos per clubUuid query string",
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList("clubUuid"),
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
        // Same-origin club logo proxy (provider URLs are not used as <img src>)
        "/api/sams/logos": {
          origin: lambdaOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: clubLogosCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          compress: true,
        },
        // Downloadable documents (PDFs, spreadsheets, etc.)
        "/docs/*": {
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
            domainNames: webappDomainAliases,
            certificate: props.cloudFrontCertificate,
          }
        : {}),
    });

    // ── Static asset deployment ────────────────────────────────────────────
    // Skip during destroy — the bucket itself is deleted by CloudFormation
    if (!isCdkDestroy) {
      new s3deploy.BucketDeployment(this, "WebAppAssetsDeployment", {
        sources: [s3deploy.Source.asset("app/.output/public")],
        destinationBucket: assetsBucket,
        distribution: this.distribution,
        distributionPaths: ["/assets/*", "/_build/*", "/docs/*"],
        prune: true,
        memoryLimit: 512,
      });
    }

    // ── DNS record ─────────────────────────────────────────────────────────
    if (props.hostedZone && props.cloudFrontCertificate) {
      new route53.ARecord(this, "WebAppARecord", {
        zone: props.hostedZone,
        recordName: webappDomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      if (isProd) {
        new route53.ARecord(this, "WebAppWwwARecord", {
          zone: props.hostedZone,
          recordName: `www.${webappDomain}`,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.CloudFrontTarget(this.distribution),
          ),
        });
      }

      this.webappUrl = webappUrl;
    } else {
      this.webappUrl = `https://${this.distribution.distributionDomainName}`;
    }

    // ── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "WebAppUrl", {
      value: this.webappUrl,
      description: "VCM WebApp URL",
      exportName: `vcm-webapp-url-${environment}${branchSuffix}`,
    });
  }
}
