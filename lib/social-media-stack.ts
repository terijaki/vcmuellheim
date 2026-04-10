import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3Bucket from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { BeholdSyncLambdaEnvironment, MastodonShareLambdaEnvironment, MastodonStreamHandlerLambdaEnvironment } from "@/lambda/social/types";
import { computeContentTableName } from "./db/env";
import { VcmNodejsFunction } from "./construct/vcm-nodejs-function";

interface SocialMediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentTable?: dynamodb.ITable;
	websiteUrl?: string;
	mediaBucketName?: string;
}

export class SocialMediaStack extends cdk.Stack {
	public readonly mastodonLambda: lambda.IFunction;

	constructor(scope: Construct, id: string, props: SocialMediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";

		const isCdkDestroy = process.env.CDK_DESTROY === "true";
		const commonEnvironment = {
			CDK_ENVIRONMENT: environment,
		};

		// Environment variables for Mastodon
		const mastodonAccessToken = process.env.MASTODON_ACCESS_TOKEN;

		if (!mastodonAccessToken && !isCdkDestroy && isProd) {
			console.warn("⚠️  MASTODON_ACCESS_TOKEN not set - Mastodon sharing will be disabled in production");
		}

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
			s3Bucket.Bucket.fromBucketName(this, "MediaBucketRef", props.mediaBucketName).grantRead(mastodonShare);
		}

		// Create scheduled Lambda to proactively sync Behold Instagram posts to DynamoDB.
		// Runs hourly during German daytime — ~465 calls/month (~39% of Behold's 1200/month free-tier limit).
		const contentTableName = computeContentTableName(environment, branch);
		if (props.contentTable) {
			const beholdSync = new VcmNodejsFunction(this, "BeholdSync", {
				namespace: "social",
				name: "behold-sync",
				entry: path.join(__dirname, "../lambda/social/behold-sync.ts"),
				memorySize: 128,
				environment: {
					...commonEnvironment,
					CONTENT_TABLE_NAME: contentTableName,
				} satisfies BeholdSyncLambdaEnvironment,
			}).lambdaFunction;

			props.contentTable.grantReadWriteData(beholdSync);

			// Trigger hourly during German daytime (7:00–21:00 UTC = 8–22h CET / 9–23h CEST)
			// ~15 runs/day, ~465 calls/month (~39% of Behold's 1200/month free-tier limit)
			const beholdSyncRule = new events.Rule(this, "BeholdSyncRule", {
				ruleName: `behold-sync-schedule-${environment}${branchSuffix}`,
				description: `Trigger Behold Instagram feed sync hourly during German daytime (${environment}${branchSuffix})`,
				schedule: events.Schedule.cron({ minute: "0", hour: "7-21" }),
			});
			beholdSyncRule.addTarget(new targets.LambdaFunction(beholdSync));
		}

		// Create Lambda function for Mastodon stream handler (DynamoDB streams)
		if (props.contentTable && props.websiteUrl) {
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
			props.contentTable.grantStreamRead(mastodonStreamHandler);
			props.contentTable.grantReadWriteData(mastodonStreamHandler);
			mastodonShare.grantInvoke(mastodonStreamHandler);

			// Attach DynamoDB stream event source
			mastodonStreamHandler.addEventSource(
				new DynamoEventSource(props.contentTable, {
					startingPosition: lambda.StartingPosition.LATEST,
					bisectBatchOnError: true,
					retryAttempts: 2,
				}),
			);

			console.log("✅ Mastodon stream handler configured for news table");
		}

		// Export Mastodon Lambda for use in other stacks
		this.mastodonLambda = mastodonShare;

		new cdk.CfnOutput(this, "MastodonLambdaArn", {
			value: mastodonShare.functionArn,
			description: "Mastodon Sharing Lambda ARN",
		});
	}
}
