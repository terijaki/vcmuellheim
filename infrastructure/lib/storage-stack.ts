import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { EnvironmentConfig } from "../config/environment";

export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly uploadUser: iam.User;
  public readonly uploadAccessKey: iam.CfnAccessKey;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // S3 bucket for media uploads (Payload CMS)
    this.mediaBucket = new s3.Bucket(this, "MediaBucket", {
      bucketName: `vcmuellheim-${config.environment}-media`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: config.environment === "prod",
      lifecycleRules: [
        {
          id: "DeleteOldVersions",
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: config.subdomain 
            ? [`https://${config.subdomain}.${config.domainName}`]
            : [`https://${config.domainName}`],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      removalPolicy: config.environment === "prod"
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== "prod",
    });

    // CloudFront Origin Access Identity (OAI) for S3 access
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: `OAI for vcmuellheim-${config.environment} media bucket`,
    });

    // Grant CloudFront read access to S3 bucket
    this.mediaBucket.grantRead(oai);

    // CloudFront distribution for media delivery
    this.distribution = new cloudfront.Distribution(this, "MediaDistribution", {
      comment: `vcmuellheim-${config.environment} media CDN`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.mediaBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // IAM user for S3 uploads from Payload CMS
    this.uploadUser = new iam.User(this, "MediaUploadUser", {
      userName: `vcmuellheim-${config.environment}-media-upload`,
    });

    // Grant upload user full access to media bucket
    this.mediaBucket.grantReadWrite(this.uploadUser);

    // Create access key for upload user
    this.uploadAccessKey = new iam.CfnAccessKey(this, "MediaUploadAccessKey", {
      userName: this.uploadUser.userName,
    });

    // Tags
    cdk.Tags.of(this.mediaBucket).add("Environment", config.environment);
    cdk.Tags.of(this.mediaBucket).add("Application", "vcmuellheim");

    // Outputs
    new cdk.CfnOutput(this, "MediaBucketName", {
      value: this.mediaBucket.bucketName,
      description: "S3 bucket name for media uploads",
      exportName: `${config.environment}-MediaBucketName`,
    });

    new cdk.CfnOutput(this, "MediaBucketArn", {
      value: this.mediaBucket.bucketArn,
      description: "S3 bucket ARN for media uploads",
      exportName: `${config.environment}-MediaBucketArn`,
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: this.distribution.distributionId,
      description: "CloudFront distribution ID",
      exportName: `${config.environment}-CloudFrontDistributionId`,
    });

    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: this.distribution.distributionDomainName,
      description: "CloudFront distribution domain name",
      exportName: `${config.environment}-CloudFrontDomainName`,
    });

    new cdk.CfnOutput(this, "MediaUploadAccessKeyId", {
      value: this.uploadAccessKey.ref,
      description: "Access Key ID for S3 media uploads",
      exportName: `${config.environment}-MediaUploadAccessKeyId`,
    });

    new cdk.CfnOutput(this, "MediaUploadSecretAccessKey", {
      value: this.uploadAccessKey.attrSecretAccessKey,
      description: "Secret Access Key for S3 media uploads (SENSITIVE - Store securely)",
    });
  }
}
