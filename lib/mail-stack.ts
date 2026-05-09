import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import { Mail } from "@/project.config";
import type { MailForwardLambdaEnvironment } from "@/lambda/mail/types";
import { VcmNodejsFunction } from "./construct/vcm-nodejs-function";

interface MailStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
  contentTableName: string;
  alertEmail?: string;
}

/**
 * Branch-scoped mail forwarding stack.
 *
 * Singleton resources (SES receipt rule set, inbound S3 bucket, SES identity)
 * are provisioned once per environment manually — see docs/EMAIL_PROXY_AWS_SETUP.md.
 *
 * This stack deploys only the branch-scoped moving parts:
 *   - EventBridge rule filtering S3 Object Created events from the inbound bucket
 *   - Lambda for proxy lookup + MIME retrieval + SES forwarding
 *   - Dead-letter queue (DLQ) for failed forwarding attempts
 *   - CloudWatch alarm on DLQ depth
 */
export class MailStack extends cdk.Stack {
  public readonly mailForwardLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: MailStackProps) {
    super(scope, id, props);

    const environment = props.stackProps?.environment || "dev";
    const branch = props.stackProps?.branch || "";
    const branchSuffix = branch ? `-${branch}` : "";
    const isProd = environment === "prod";

    const mailConfig = isProd ? Mail.prod : Mail.dev;

    // Dead-letter queue — catches emails that could not be forwarded
    const dlq = new sqs.Queue(this, "MailForwardDlq", {
      queueName: `mail-forward-dlq-${environment}${branchSuffix}`,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    // Reference the manually provisioned inbound S3 bucket (shared, not branch-scoped)
    const inboundBucket = s3.Bucket.fromBucketName(
      this,
      "InboundBucket",
      mailConfig.inboundBucketName,
    );

    // Lambda for mail forwarding
    const mailForward = new VcmNodejsFunction(this, "MailForward", {
      namespace: "mail",
      name: "mail-forward",
      entry: path.join(__dirname, "../lambda/mail/mail-forward.ts"),
      memorySize: 128,
      deadLetterQueue: dlq,
      retryAttempts: 2,
      environment: {
        CDK_ENVIRONMENT: environment,
        BRANCH_NAME: isProd ? "" : branch,
        CONTENT_TABLE_NAME: props.contentTableName,
        FORWARD_FROM_EMAIL: mailConfig.systemFromEmail,
        RECIPIENT_DOMAIN: mailConfig.recipientDomain,
      } satisfies MailForwardLambdaEnvironment,
    }).lambdaFunction;

    // Grant S3 read access for retrieving raw MIME email objects
    inboundBucket.grantRead(mailForward);

    // Grant DynamoDB read access for proxy email → privateEmail lookups
    const contentTableArn = cdk.Stack.of(this).formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: props.contentTableName,
    });
    dynamodb.Table.fromTableArn(this, "ContentTableRef", contentTableArn).grantReadData(
      mailForward,
    );
    mailForward.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [`${contentTableArn}/index/*`],
      }),
    );

    // Grant SES send-email permission for forwarding
    mailForward.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendRawEmail"],
        resources: ["*"],
      }),
    );

    // EventBridge rule: S3 Object Created in inbound bucket → Lambda
    // Uses the source S3 bucket ARN to filter only inbound emails.
    // Branch-scoped rule name ensures concurrent branches don't share the rule.
    const rule = new events.Rule(this, "InboundMailRule", {
      ruleName: `mail-inbound-${environment}${branchSuffix}`,
      description: `Route inbound SES emails from S3 to mail-forward Lambda (${environment}${branchSuffix})`,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [mailConfig.inboundBucketName],
          },
        },
      },
    });

    rule.addTarget(
      new targets.LambdaFunction(mailForward, {
        deadLetterQueue: dlq,
        retryAttempts: 2,
      }),
    );

    // CloudWatch alarm: DLQ message count > 0 → alert
    const dlqAlarm = new cloudwatch.Alarm(this, "MailForwardDlqAlarm", {
      alarmName: `mail-forward-dlq-${environment}${branchSuffix}`,
      alarmDescription: "Mail forwarding Lambda has failed processing — check DLQ",
      metric: dlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    if (props.alertEmail) {
      const alarmTopic = new sns.Topic(this, "MailForwardAlarmTopic", {
        topicName: `mail-forward-alarm-${environment}${branchSuffix}`,
      });
      alarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(props.alertEmail));
      dlqAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    }

    this.mailForwardLambda = mailForward;
  }
}
