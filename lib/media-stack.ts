/**
 * CDK Stack for Media Storage (S3)
 */

import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class MediaStack extends cdk.Stack {
	public readonly bucket: s3.Bucket;

	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// S3 Bucket for media storage
		this.bucket = new s3.Bucket(this, "MediaBucket", {
			bucketName: `vcm-media-${this.account}-${this.region}`,
			encryption: s3.BucketEncryption.S3_MANAGED,
			cors: [
				{
					allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
					allowedOrigins: ["*"], // TODO: Restrict to actual domains
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
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		});

		// CloudFront OAI for public read access (optional, for future CDN integration)
		// For now, we'll use presigned URLs

		// Output bucket name
		new cdk.CfnOutput(this, "MediaBucketName", {
			value: this.bucket.bucketName,
			description: "S3 Bucket for media storage",
		});
	}
}
