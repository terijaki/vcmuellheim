import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { SamsProviderProcessorLambdaEnvironment } from "@/lambda/sams/types";
import {
  computeResourceBranchSuffix,
  computeSamsDataTableName,
  computeSqsQueueArn,
  computeSqsQueueUrl,
} from "./db/env";
import { SamsTableIndexes } from "./db/sams-electrodb-entities";
import { VcmNodejsFunction } from "./construct/vcm-nodejs-function";
import {
  computeSamsProviderEventsDlqName,
  computeSamsProviderEventsQueueName,
  getProviderEventDeliveryRoleArn,
  SAMS_PROVIDER_ACCOUNT_ID,
} from "./sams-provider-env";

interface SamsStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
  /** Optional alert email for DLQ alarm (feature branches may omit). */
  alertEmail?: string;
  /**
   * Plain-string match→Mastodon queue name owned by SocialMediaStack.
   * Avoids CloudFormation cross-stack exports of the queue object.
   */
  matchMastodonQueueName?: string;
}

export class SamsStack extends cdk.Stack {
  public readonly samsDataTable: dynamodb.Table;
  public readonly providerEventsQueue: sqs.Queue;
  public readonly providerEventsQueueUrl: string;
  public readonly providerEventsQueueArn: string;

  constructor(scope: Construct, id: string, props?: SamsStackProps) {
    super(scope, id, props);

    const environment = props?.stackProps?.environment || "dev";
    const isProd = environment === "prod";
    const branch = props?.stackProps?.branch || "";
    const branchSuffix = computeResourceBranchSuffix(environment, branch);

    const commonEnvironment = {
      CDK_ENVIRONMENT: environment,
    };

    const samsDataTable = new dynamodb.Table(this, "SamsDataTable", {
      tableName: computeSamsDataTableName(environment, branch),
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    samsDataTable.addGlobalSecondaryIndex({
      indexName: SamsTableIndexes.gsi1,
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.samsDataTable = samsDataTable;

    const dlq = new sqs.Queue(this, "SamsProviderEventsDlq", {
      queueName: computeSamsProviderEventsDlqName(environment, branch),
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const providerEventsQueue = new sqs.Queue(this, "SamsProviderEventsQueue", {
      queueName: computeSamsProviderEventsQueueName(environment, branch),
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
      visibilityTimeout: cdk.Duration.minutes(6),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 5,
      },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.providerEventsQueue = providerEventsQueue;
    this.providerEventsQueueUrl = providerEventsQueue.queueUrl;
    this.providerEventsQueueArn = providerEventsQueue.queueArn;

    if (isProd) {
      providerEventsQueue.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowSamsProviderEventBridgeSendMessage",
          effect: iam.Effect.ALLOW,
          principals: [new iam.AccountPrincipal(SAMS_PROVIDER_ACCOUNT_ID)],
          actions: ["sqs:SendMessage"],
          resources: [providerEventsQueue.queueArn],
          conditions: {
            ArnEquals: {
              "aws:PrincipalArn": getProviderEventDeliveryRoleArn(),
            },
          },
        }),
      );
    } else {
      const githubActionsRoleArn = `arn:aws:iam::${cdk.Stack.of(this).account}:role/GitHubActionsCDKRole`;
      providerEventsQueue.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowGitHubActionsCdkRoleSeed",
          effect: iam.Effect.ALLOW,
          principals: [new iam.ArnPrincipal(githubActionsRoleArn)],
          actions: ["sqs:SendMessage", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"],
          resources: [providerEventsQueue.queueArn],
        }),
      );
    }

    const matchMastodonQueueUrl =
      props?.matchMastodonQueueName && this.account && this.region
        ? computeSqsQueueUrl(this.account, this.region, props.matchMastodonQueueName)
        : undefined;

    const PROCESSOR_FUNCTION_NAME = "sams-provider-processor";
    const processor = new VcmNodejsFunction(this, "SamsProviderProcessor", {
      namespace: "sams",
      name: PROCESSOR_FUNCTION_NAME,
      entry: path.join(__dirname, "../lambda/sams/sams-provider-events.ts"),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        ...commonEnvironment,
        SAMS_TABLE_NAME: samsDataTable.tableName,
        ...(matchMastodonQueueUrl ? { MATCH_MASTODON_QUEUE_URL: matchMastodonQueueUrl } : {}),
      } satisfies SamsProviderProcessorLambdaEnvironment,
    }).lambdaFunction;

    samsDataTable.grantReadWriteData(processor);

    if (props?.matchMastodonQueueName && this.account && this.region) {
      const matchMastodonQueue = sqs.Queue.fromQueueArn(
        this,
        "MatchMastodonQueueRef",
        computeSqsQueueArn(this.account, this.region, props.matchMastodonQueueName),
      );
      matchMastodonQueue.grantSendMessages(processor);
    }

    processor.addEventSource(
      new lambdaEventSources.SqsEventSource(providerEventsQueue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        reportBatchItemFailures: true,
      }),
    );

    const dlqAlarm = new cloudwatch.Alarm(this, "SamsProviderDlqAlarm", {
      alarmName: `sams-provider-dlq-depth-${environment}${branchSuffix}`,
      alarmDescription: "SAMS provider events dead-letter queue has messages",
      metric: dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    if (props?.alertEmail) {
      const dlqAlarmTopic = new sns.Topic(this, "SamsProviderDlqAlarmTopic", {
        displayName: `SAMS provider DLQ alarms (${environment}${branchSuffix})`,
      });
      dlqAlarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(props.alertEmail));
      dlqAlarm.addAlarmAction(new actions.SnsAction(dlqAlarmTopic));
    }

    new cdk.CfnOutput(this, "SamsProviderEventsQueueUrl", {
      value: providerEventsQueue.queueUrl,
      exportName: `SamsProviderEventsQueueUrl-${environment}${branchSuffix}`,
    });

    new cdk.CfnOutput(this, "SamsProviderEventsQueueArn", {
      value: providerEventsQueue.queueArn,
      exportName: `SamsProviderEventsQueueArn-${environment}${branchSuffix}`,
    });
  }
}
