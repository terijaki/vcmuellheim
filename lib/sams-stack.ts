import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { SamsClubsSyncLambdaEnvironment, SamsCommonLambdaEnvironment, SamsTeamsSyncLambdaEnvironment } from "@/lambda/sams/types";
import { computeSamsDataTableName } from "./db/env";
import { buildLambdaFunctionName, VcmNodejsFunction } from "./construct/vcm-nodejs-function";

interface SamsStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	mediaBucketName?: string;
	mediaCloudFrontUrl?: string;
}

export class SamsStack extends cdk.Stack {
	public readonly samsDataTable: dynamodb.Table;
	public readonly samsClubsSync: NodejsFunction;
	public readonly samsTeamsSync: NodejsFunction;
	/** Stable plain-string function names — safe to pass cross-stack without creating CloudFormation exports. */
	public readonly samsClubsSyncFunctionName: string;
	public readonly samsTeamsSyncFunctionName: string;

	constructor(scope: Construct, id: string, props?: SamsStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const isProd = environment === "prod";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";

		// Environment variables for all Lambda functions
		const samsKey = process.env.SAMS_API_KEY;
		const isCdkDestroy = process.env.CDK_DESTROY === "true";

		if (!isCdkDestroy) {
			if (!samsKey) throw new Error("❌ SAMS_API_KEY environment variable is required");
		}

		const commonEnvironment = {
			SAMS_API_KEY: samsKey || "",
			CDK_ENVIRONMENT: environment,
		} satisfies SamsCommonLambdaEnvironment;

		// Create single DynamoDB table for all SAMS data
		const samsDataTable = new dynamodb.Table(this, "SamsDataTable", {
			tableName: computeSamsDataTableName(environment, branch),
			partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			timeToLiveAttribute: "ttl",
		});

		// GSI1 — type-based list queries for clubs and teams
		samsDataTable.addGlobalSecondaryIndex({
			indexName: "GSI1-BySamsType",
			partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI2 — season-scoped team queries
		samsDataTable.addGlobalSecondaryIndex({
			indexName: "GSI2-BySamsSeasonUuid",
			partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// Expose table for cross-stack reference
		this.samsDataTable = samsDataTable;

		const CLUBS_SYNC_FUNCTION_NAME = "sams-clubs-sync";
		const TEAMS_SYNC_FUNCTION_NAME = "sams-teams-sync";
		this.samsClubsSyncFunctionName = buildLambdaFunctionName(CLUBS_SYNC_FUNCTION_NAME);
		this.samsTeamsSyncFunctionName = buildLambdaFunctionName(TEAMS_SYNC_FUNCTION_NAME);

		// Create Lambda function for nightly clubs sync
		this.samsClubsSync = new VcmNodejsFunction(this, "SamsClubsSync", {
			namespace: "sams",
			name: CLUBS_SYNC_FUNCTION_NAME,
			entry: path.join(__dirname, "../lambda/sams/sams-clubs-sync.ts"),
			timeout: cdk.Duration.minutes(3),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
				MEDIA_BUCKET_NAME: props?.mediaBucketName ?? "",
				MEDIA_CLOUDFRONT_URL: props?.mediaCloudFrontUrl ?? "",
			} satisfies SamsClubsSyncLambdaEnvironment,
		}).lambdaFunction;

		// Grant DynamoDB permissions to clubs sync Lambda
		samsDataTable.grantReadWriteData(this.samsClubsSync);
		if (props?.mediaBucketName) {
			s3.Bucket.fromBucketName(this, "MediaBucketRef", props.mediaBucketName).grantWrite(this.samsClubsSync);
		}

		// Create Lambda function for nightly teams sync
		this.samsTeamsSync = new VcmNodejsFunction(this, "SamsTeamsSync", {
			namespace: "sams",
			name: TEAMS_SYNC_FUNCTION_NAME,
			entry: path.join(__dirname, "../lambda/sams/sams-teams-sync.ts"),
			timeout: cdk.Duration.minutes(3),
			environment: {
				...commonEnvironment,
				SAMS_TABLE_NAME: samsDataTable.tableName,
			} satisfies SamsTeamsSyncLambdaEnvironment,
		}).lambdaFunction;

		// Grant DynamoDB permissions to teams sync Lambda
		samsDataTable.grantReadWriteData(this.samsTeamsSync);

		// Create EventBridge rule to trigger sync Lambda weekly on Wednesday at 2 AM UTC
		const syncRule = new events.Rule(this, "SamsClubsSyncRule", {
			ruleName: `sams-clubs-weekly-sync-${environment}${branchSuffix}`,
			description: `Trigger SAMS clubs sync every Wednesday at 2 AM UTC (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				weekDay: "WED",
				hour: "2",
				minute: "0",
			}),
		}); // Add Lambda as target for EventBridge rule
		syncRule.addTarget(new targets.LambdaFunction(this.samsClubsSync));

		// Create EventBridge rule to trigger teams sync nightly at 3 AM UTC
		const teamsSyncRule = new events.Rule(this, "SamsTeamsSyncRule", {
			ruleName: `sams-teams-nightly-sync-${environment}${branchSuffix}`,
			description: `Trigger SAMS teams sync every night at 3 AM UTC - after clubs sync (${environment}${branchSuffix})`,
			schedule: events.Schedule.cron({
				hour: "3",
				minute: "0",
			}),
		});

		// Add teams Lambda as target for EventBridge rule
		teamsSyncRule.addTarget(new targets.LambdaFunction(this.samsTeamsSync));
	}
}
