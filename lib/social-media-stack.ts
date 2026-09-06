import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3Bucket from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type {
  BeholdSyncLambdaEnvironment,
  MastodonShareLambdaEnvironment,
  MastodonStreamHandlerLambdaEnvironment,
} from "@/lambda/social/types";
import {
  computeContentTableName,
  computeResourceBranchSuffix,
  computeSocialTableName,
} from "./db/env";
import { VcmNodejsFunction } from "./construct/vcm-nodejs-function";

interface SocialMediaStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
  /** Plain-string table name — avoids CloudFormation cross-stack export of the full table object. */
  contentTableName?: string;
  /** Stream ARN for the content table — needed by DynamoEventSource on the stream handler. */
  contentTableStreamArn?: string;
  websiteUrl?: string;
  mediaBucketName?: string;
}

export class SocialMediaStack extends cdk.Stack {
  /** Stable plain-string table name — safe to pass cross-stack without creating CloudFormation exports. */
  public readonly socialTableName: string;
  public readonly mastodonLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: SocialMediaStackProps) {
    super(scope, id, props);

    const environment = props?.stackProps?.environment || "dev";
    const branch = props?.stackProps?.branch || "";
    const branchSuffix = computeResourceBranchSuffix(environment, branch);
    const isProd = environment === "prod";

    const isCdkDestroy = process.env.CDK_DESTROY === "true";
    const commonEnvironment = {
      CDK_ENVIRONMENT: environment,
    };

    // Environment variables for Mastodon
    const mastodonAccessToken = process.env.MASTODON_ACCESS_TOKEN;

    if (!mastodonAccessToken && !isCdkDestroy && isProd) {
      console.warn(
        "⚠️  MASTODON_ACCESS_TOKEN not set - Mastodon sharing will be disabled in production",
      );
    }

    this.socialTableName = computeSocialTableName(environment, branch);

    const socialTable = new dynamodb.Table(this, "SocialTable", {
      tableName: this.socialTableName,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // Create Lambda function for Mastodon sharing
    const mastodonShare = new VcmNodejsFunction(this, "MastodonShare", {
      namespace: "social",
      name: "mastodon-share",
      entry: path.join(__dirname, "../lambda/social/mastodon-share.ts"),
      environment: {
        ...commonEnvironment,
        MASTODON_ACCESS_TOKEN: mastodonAccessToken || "",
        ...(props.mediaBucketName ? { MEDIA_BUCKET_NAME: props.mediaBucketName } : {}),
      } satisfies MastodonShareLambdaEnvironment,
    }).lambdaFunction;

    // Grant S3 read permissions to Mastodon Lambda for image uploads
    if (props.mediaBucketName) {
      s3Bucket.Bucket.fromBucketName(this, "MediaBucketRef", props.mediaBucketName).grantRead(
        mastodonShare,
      );
    }

    // Create scheduled Lambda to proactively sync Behold Instagram posts to DynamoDB.
    // Runs hourly during German daytime — ~465 calls/month (~39% of Behold's 1200/month free-tier limit).
    const beholdSync = new VcmNodejsFunction(this, "BeholdSync", {
      namespace: "social",
      name: "behold-sync",
      entry: path.join(__dirname, "../lambda/social/behold-sync.ts"),
      memorySize: 128,
      environment: {
        ...commonEnvironment,
        SOCIAL_TABLE_NAME: this.socialTableName,
        BEHOLD_FEED_URL: process.env.BEHOLD_FEED_URL,
      } satisfies BeholdSyncLambdaEnvironment,
    }).lambdaFunction;

    socialTable.grantReadWriteData(beholdSync);

    // Trigger hourly during German daytime (7:00–21:00 UTC = 8–22h CET / 9–23h CEST)
    // ~15 runs/day, ~465 calls/month (~39% of Behold's 1200/month free-tier limit)
    const beholdSyncRule = new events.Rule(this, "BeholdSyncRule", {
      ruleName: `behold-sync-schedule-${environment}${branchSuffix}`,
      description: `Trigger Behold Instagram feed sync hourly during German daytime (${environment}${branchSuffix})`,
      schedule: events.Schedule.cron({ minute: "0", hour: "7-21" }),
    });
    beholdSyncRule.addTarget(new targets.LambdaFunction(beholdSync));

    // Create Lambda function for Mastodon stream handler (DynamoDB streams)
    const contentTableName = props.contentTableName ?? computeContentTableName(environment, branch);
    if (props.contentTableName && props.contentTableStreamArn && props.websiteUrl) {
      const contentTableArn = cdk.Stack.of(this).formatArn({
        service: "dynamodb",
        resource: "table",
        resourceName: contentTableName,
      });
      // fromTableAttributes includes the stream ARN so DynamoEventSource can access it
      const contentTableWithStream = dynamodb.Table.fromTableAttributes(
        this,
        "ContentTableWithStream",
        {
          tableArn: contentTableArn,
          tableStreamArn: props.contentTableStreamArn,
        },
      );

      const mastodonStreamHandler = new VcmNodejsFunction(this, "MastodonStreamHandler", {
        namespace: "social",
        name: "mastodon-stream-handler",
        entry: path.join(__dirname, "../lambda/social/mastodon-stream-handler.ts"),
        memorySize: 256,
        environment: {
          ...commonEnvironment,
          MASTODON_LAMBDA_NAME: mastodonShare.functionName,
          ENVIRONMENT: environment,
          WEBSITE_URL: props.websiteUrl,
          CONTENT_TABLE_NAME: contentTableName,
        } satisfies MastodonStreamHandlerLambdaEnvironment,
      }).lambdaFunction;

      // Grant permissions
      contentTableWithStream.grantStreamRead(mastodonStreamHandler);
      contentTableWithStream.grantReadWriteData(mastodonStreamHandler);
      mastodonStreamHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["dynamodb:Query"],
          resources: [`${contentTableArn}/index/*`],
        }),
      );
      mastodonShare.grantInvoke(mastodonStreamHandler);

      // Attach DynamoDB stream event source
      mastodonStreamHandler.addEventSource(
        new DynamoEventSource(contentTableWithStream, {
          startingPosition: lambda.StartingPosition.LATEST,
          bisectBatchOnError: true,
          retryAttempts: 2,
        }),
      );

      console.log("✅ Mastodon stream handler configured for news table");
    }

    // Export Mastodon Lambda for use in other stacks
    this.mastodonLambda = mastodonShare;
  }
}
