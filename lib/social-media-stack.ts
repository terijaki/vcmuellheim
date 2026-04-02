import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { MastodonShareLambdaEnvironment, MastodonStreamHandlerLambdaEnvironment } from "@/lambda/social/types";

interface SocialMediaStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentTable?: dynamodb.ITable;
	websiteUrl?: string;
	mediaBucket?: s3.IBucket;
}

export class SocialMediaStack extends cdk.Stack {
	public readonly mastodonLambda: lambda.IFunction;

	constructor(scope: Construct, id: string, props: SocialMediaStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";

		// AWS Lambda Powertools Layer for structured logging and X-Ray tracing
		const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "PowertoolsLayer", `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:41`);

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
		const mastodonShare = new NodejsFunction(this, "MastodonShare", {
			functionName: `mastodon-share-${environment}${branchSuffix}`,
			runtime: lambda.Runtime.NODEJS_24_X,
			handler: "handler",
			entry: path.join(__dirname, "../lambda/social/mastodon-share.ts"),
			environment: {
				...commonEnvironment,
				MASTODON_ACCESS_TOKEN: mastodonAccessToken || "",
				...(props.mediaBucket ? { MEDIA_BUCKET_NAME: props.mediaBucket.bucketName } : {}),
			} satisfies Omit<MastodonShareLambdaEnvironment, "AWS_REGION">,
			timeout: cdk.Duration.seconds(60), // Increased timeout for image uploads
			memorySize: 512, // Increased memory for image processing
			layers: [powertoolsLayer],
			logGroup: new cdk.aws_logs.LogGroup(this, "MastodonShareLogGroup", {
				retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			}),
			bundling: {
				externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core", "@aws-sdk/client-s3"],
				minify: true,
				sourceMap: true,
			},
		});

		// Grant S3 read permissions to Mastodon Lambda for image uploads
		if (props.mediaBucket) {
			props.mediaBucket.grantRead(mastodonShare);
		}

		// Create Lambda function for Mastodon stream handler (DynamoDB streams)
		if (props.contentTable && props.websiteUrl) {
			const mastodonStreamHandler = new NodejsFunction(this, "MastodonStreamHandler", {
				functionName: `mastodon-stream-handler-${environment}${branchSuffix}`,
				runtime: lambda.Runtime.NODEJS_24_X,
				handler: "handler",
				entry: path.join(__dirname, "../lambda/social/mastodon-stream-handler.ts"),
				environment: {
					...commonEnvironment,
					MASTODON_LAMBDA_NAME: mastodonShare.functionName,
					ENVIRONMENT: environment,
					WEBSITE_URL: props.websiteUrl,
					CONTENT_TABLE_NAME: props.contentTable.tableName,
				} satisfies Omit<MastodonStreamHandlerLambdaEnvironment, "AWS_REGION">,
				timeout: cdk.Duration.seconds(30),
				memorySize: 256,
				layers: [powertoolsLayer],
				logGroup: new cdk.aws_logs.LogGroup(this, "MastodonStreamHandlerLogGroup2", {
					retention: cdk.aws_logs.RetentionDays.TWO_MONTHS,
					removalPolicy: cdk.RemovalPolicy.DESTROY,
				}),
				bundling: {
					externalModules: ["@aws-lambda-powertools/logger", "@aws-lambda-powertools/tracer", "aws-xray-sdk-core", "@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-lambda"],
					minify: true,
					sourceMap: true,
				},
			});

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
