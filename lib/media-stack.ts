/**
 * CDK Stack for Media Storage (S3) and CloudFront Distribution
 */

import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface MediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment?: string;
		branch?: string;
	};
}

export class MediaStack extends cdk.Stack {
	public readonly bucket: s3.Bucket;
	public readonly distribution: cloudfront.Distribution;
	public readonly cloudFrontUrl: string;

	constructor(scope: Construct, id: string, props?: MediaStackProps) {
		super(scope, id, props);

		const isProd = props?.stackProps?.environment === "prod";

		// S3 Bucket for media storage
		this.bucket = new s3.Bucket(this, "MediaBucket", {
			bucketName: `vcm-media-${this.account}-${this.region}`,
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
		});

		this.cloudFrontUrl = `https://${this.distribution.distributionDomainName}`;

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
