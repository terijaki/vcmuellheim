/**
 * CDK Stack for CMS Admin Panel (S3 + CloudFront)
 * Builds Vite app and deploys to S3 with CloudFront distribution
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { Club } from "@/project.config";

export interface CmsStackProps extends cdk.StackProps {
	stackProps?: {
		environment?: string;
		branch?: string;
	};
	hostedZone?: route53.IHostedZone;
	cloudFrontCertificate?: acm.ICertificate; // Must be from us-east-1
}

export class CmsStack extends cdk.Stack {
	public readonly bucket: s3.Bucket;
	public readonly distribution: cloudfront.Distribution;
	public readonly cmsUrl: string;

	constructor(scope: Construct, id: string, props?: CmsStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;
		const cmsDomain = `${envPrefix}admin.${baseDomain}`;

		// S3 Bucket for CMS static files
		this.bucket = new s3.Bucket(this, "CmsBucket", {
			bucketName: `${Club.slug}-cms-${environment}${branchSuffix}`,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: !isProd,
		});

		// CloudFront Distribution with OAC for SPA
		// SPA needs special error handling for client-side routing
		const cachePolicy = isProd
			? cloudfront.CachePolicy.CACHING_OPTIMIZED
			: new cloudfront.CachePolicy(this, "DevCachePolicy", {
					defaultTtl: cdk.Duration.minutes(5),
					minTtl: cdk.Duration.seconds(0),
					maxTtl: cdk.Duration.minutes(10),
					comment: "Dev cache policy with short TTL for CMS",
				});

		this.distribution = new cloudfront.Distribution(this, "CmsDistribution", {
			defaultBehavior: {
				origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
				cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
				cachePolicy,
				compress: true,
			},
			defaultRootObject: "index.html",
			errorResponses: [
				{
					// SPA routing: redirect all 404s to index.html
					httpStatus: 404,
					responseHttpStatus: 200,
					responsePagePath: "/index.html",
					ttl: cdk.Duration.minutes(0),
				},
				{
					httpStatus: 403,
					responseHttpStatus: 200,
					responsePagePath: "/index.html",
					ttl: cdk.Duration.minutes(0),
				},
			],
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
			comment: isProd ? "VCM Admin CMS (Prod)" : "VCM Admin CMS (Dev)",
			...(props?.cloudFrontCertificate && props?.hostedZone
				? {
						domainNames: [cmsDomain],
						certificate: props.cloudFrontCertificate,
					}
				: {}),
		});

		// Grant CloudFront distribution access to S3 bucket
		// When using OAC with S3 origin, we need to add a bucket policy
		this.bucket.addToResourcePolicy(
			new cdk.aws_iam.PolicyStatement({
				sid: "AllowCloudFrontOAC",
				effect: cdk.aws_iam.Effect.ALLOW,
				principals: [new cdk.aws_iam.ServicePrincipal("cloudfront.amazonaws.com")],
				actions: ["s3:GetObject"],
				resources: [this.bucket.arnForObjects("*")],
			}),
		);

		// Create A record for admin subdomain if hosted zone provided
		if (props?.hostedZone && props?.cloudFrontCertificate) {
			new route53.ARecord(this, "CmsARecord", {
				zone: props.hostedZone,
				recordName: cmsDomain,
				target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
			});

			this.cmsUrl = `https://${cmsDomain}`;
		} else {
			this.cmsUrl = `https://${this.distribution.distributionDomainName}`;
		}

		// Deploy Vite build output to S3
		// Build CMS during deployment using local bundling
		new s3deploy.BucketDeployment(this, "CmsDeployment", {
			sources: [
				s3deploy.Source.asset("./apps/cms", {
					bundling: {
						image: cdk.DockerImage.fromRegistry("oven/bun:latest"),
						local: {
							tryBundle(outputDir: string) {
								try {
									// Build the CMS
									const cmsCwd = path.join(process.cwd(), "apps/cms");
									execFileSync("bun", ["run", "build", "--outDir", outputDir], {
										env: { ...process.env, VITE_CDK_ENVIRONMENT: environment },
										cwd: cmsCwd,
										stdio: "inherit",
									});
									return true;
								} catch (error) {
									console.error("Local bundling failed:", error);
									return false;
								}
							},
						},
					},
				}),
			],
			destinationKeyPrefix: "", // Deploy to root of bucket, not in a subdirectory
			destinationBucket: this.bucket,
			distribution: this.distribution,
			distributionPaths: ["/*"],
			prune: true, // Remove old files not in new deployment
			memoryLimit: 256, // Slightly higher memory for CMS build
		});

		// Outputs
		new cdk.CfnOutput(this, "CmsBucketName", {
			value: this.bucket.bucketName,
			description: "S3 Bucket for CMS static files",
		});

		new cdk.CfnOutput(this, "CmsUrl", {
			value: this.cmsUrl,
			description: "CMS Admin Panel URL",
		});

		new cdk.CfnOutput(this, "CloudFrontDistributionId", {
			value: this.distribution.distributionId,
			description: "CloudFront Distribution ID for CMS",
		});
	}
}
