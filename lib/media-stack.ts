/**
 * CDK Stack for Media Storage (S3) and CloudFront Distribution
 */

import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { Club } from "@/project.config";

export interface MediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment?: string;
		branch?: string;
	};
	hostedZone?: route53.IHostedZone;
	cloudFrontCertificate?: acm.ICertificate; // Must be from us-east-1
}

export class MediaStack extends cdk.Stack {
	public readonly bucket: s3.Bucket;
	public readonly distribution: cloudfront.Distribution;
	public readonly cloudFrontUrl: string;

	constructor(scope: Construct, id: string, props?: MediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const mediaDomain = `${envPrefix}media.new.${Club.domain}`;

		// S3 Bucket for media storage
		this.bucket = new s3.Bucket(this, "MediaBucket", {
			bucketName: `${Club.slug}-media-${environment}${branchSuffix}`,
			encryption: s3.BucketEncryption.S3_MANAGED,
			cors: [
				{
					allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
					allowedOrigins: ["*"], // For presigned upload URLs
					allowedHeaders: ["*"],
					maxAge: 3000,
				},
			],
			lifecycleRules: [
				{
					abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
				},
			],
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: !isProd, // Auto-delete objects on stack deletion in dev
		});

		// CloudFront Distribution with OAC for public read access
		// Dev environment uses shorter cache TTL for faster iteration
		const cachePolicy = isProd
			? cloudfront.CachePolicy.CACHING_OPTIMIZED
			: new cloudfront.CachePolicy(this, "DevCachePolicy", {
					defaultTtl: cdk.Duration.minutes(5),
					minTtl: cdk.Duration.seconds(0),
					maxTtl: cdk.Duration.minutes(10),
					comment: "Dev cache policy with short TTL",
				});

		this.distribution = new cloudfront.Distribution(this, "MediaDistribution", {
			defaultBehavior: {
				origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
				cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
				cachePolicy,
				compress: true,
			},
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
			comment: isProd ? "VCM Media Distribution (Prod)" : "VCM Media Distribution (Dev)",
			...(props?.cloudFrontCertificate && props?.hostedZone
				? {
						domainNames: [mediaDomain],
						certificate: props.cloudFrontCertificate,
					}
				: {}),
		});

		// Create A record for media subdomain if hosted zone provided
		if (props?.hostedZone && props?.cloudFrontCertificate) {
			new route53.ARecord(this, "MediaARecord", {
				zone: props.hostedZone,
				recordName: mediaDomain,
				target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
			});

			this.cloudFrontUrl = `https://${mediaDomain}`;
		} else {
			this.cloudFrontUrl = `https://${this.distribution.distributionDomainName}`;
		}

		// Outputs
		new cdk.CfnOutput(this, "MediaBucketName", {
			value: this.bucket.bucketName,
			description: "S3 Bucket for media storage",
		});

		new cdk.CfnOutput(this, "CloudFrontUrl", {
			value: this.cloudFrontUrl,
			description: "CloudFront URL for media distribution",
		});

		new cdk.CfnOutput(this, "CloudFrontDistributionId", {
			value: this.distribution.distributionId,
			description: "CloudFront Distribution ID",
		});
	}
}
