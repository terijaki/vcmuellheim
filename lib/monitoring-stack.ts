/**
 * CDK Stack for Comprehensive Monitoring
 * Includes CloudWatch alarms and SNS notifications
 * Native Lambda and API Gateway logs are created automatically by AWS
 */

import * as cdk from "aws-cdk-lib";
import type * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import type * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";

export interface MonitoringStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	alertEmail: string;
	// Lambda functions to monitor
	webappLambda?: lambda.IFunction;
	samsLambdas?: {
		clubsSync?: lambda.IFunction;
		teamsSync?: lambda.IFunction;
		leagueMatches?: lambda.IFunction;
		rankings?: lambda.IFunction;
		logoProxy?: lambda.IFunction;
	};
	contentLambdas?: {
		s3Cleanup?: lambda.IFunction;
		icsCalendar?: lambda.IFunction;
	};
	socialLambdas?: {
		instagramSync?: lambda.IFunction;
		instagramPosts?: lambda.IFunction;
	};
	// DynamoDB tables
	contentTables?: Record<Lowercase<string>, dynamodb.ITable>;
	samsTables?: {
		clubs?: dynamodb.ITable;
		teams?: dynamodb.ITable;
	};
	// S3 buckets
	mediaBucket?: s3.IBucket;
	// CloudFront distributions
	mediaDistribution?: cloudfront.IDistribution;
	cmsDistribution?: cloudfront.IDistribution;
	websiteDistribution?: cloudfront.IDistribution;
	// API Gateway
	api?: apigatewayv2.IHttpApi;
}

export class MonitoringStack extends cdk.Stack {
	public readonly alertTopic: sns.Topic;
	public readonly warningTopic: sns.Topic;

	constructor(scope: Construct, id: string, props: MonitoringStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";

		// ==================== SNS Topics ====================
		this.alertTopic = new sns.Topic(this, "AlertTopic", {
			topicName: `vcm-alerts-${environment}${branchSuffix}`,
			displayName: `VC Müllheim Alerts (${environment}${branchSuffix})`,
		});

		this.warningTopic = new sns.Topic(this, "WarningTopic", {
			topicName: `vcm-warnings-${environment}${branchSuffix}`,
			displayName: `VC Müllheim Warnings (${environment}${branchSuffix})`,
		});

		// Subscribe to SNS topics
		this.alertTopic.addSubscription(
			new snsSubscriptions.EmailSubscription(props.alertEmail, {
				json: false,
			}),
		);

		this.warningTopic.addSubscription(
			new snsSubscriptions.EmailSubscription(props.alertEmail, {
				json: false,
			}),
		);

		// === Lambda ===
		if (props.webappLambda) {
			// WebApp Lambda Alarms
			const webappErrorAlarm = new cloudwatch.Alarm(this, "WebappErrorRateAlarm", {
				metric: props.webappLambda.metricErrors({
					statistic: "Sum",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 10,
				evaluationPeriods: 2,
				alarmName: `vcm-webapp-errors-${environment}${branchSuffix}`,
				alarmDescription: "Alert when WebApp Lambda error rate exceeds threshold",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			webappErrorAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));

			const webappDurationAlarm = new cloudwatch.Alarm(this, "WebappDurationAlarm", {
				metric: props.webappLambda.metricDuration({
					statistic: "Average",
					period: cdk.Duration.minutes(5),
				}),
				threshold: isProd ? 3000 : 5000,
				evaluationPeriods: 2,
				alarmName: `vcm-webapp-duration-${environment}${branchSuffix}`,
				alarmDescription: "Alert when WebApp Lambda execution time is high",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			webappDurationAlarm.addAlarmAction(new cw_actions.SnsAction(this.warningTopic));

			const webappThrottlesAlarm = new cloudwatch.Alarm(this, "WebappThrottlesAlarm", {
				metric: props.webappLambda.metricThrottles({
					statistic: "Sum",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 1,
				evaluationPeriods: 1,
				alarmName: `vcm-webapp-throttles-${environment}${branchSuffix}`,
				alarmDescription: "Alert when WebApp Lambda is throttled",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			webappThrottlesAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));
		}

		// === DynamoDB ===
		if (props.contentTables) {
			// DynamoDB Alarms
			for (const [tableName, table] of Object.entries(props.contentTables)) {
				const alarm = new cloudwatch.Alarm(this, `DynamoUserErrorsAlarm-${tableName}`, {
					metric: table.metricUserErrors({
						statistic: "Sum",
						period: cdk.Duration.minutes(5),
					}),
					threshold: 5,
					evaluationPeriods: 1,
					alarmName: `vcm-dynamodb-errors-${tableName}-${environment}${branchSuffix}`,
					alarmDescription: `Alert when ${tableName} DynamoDB errors exceed threshold`,
					treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
				});
				alarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));
			}
		}

		// === API Gateway ===
		if (props.api) {
			// API Gateway Alarms
			const apiServerErrorAlarm = new cloudwatch.Alarm(this, "ApiServerErrorsAlarm", {
				metric: props.api.metricServerError({
					statistic: "Sum",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 10,
				evaluationPeriods: 1,
				alarmName: `vcm-api-server-errors-${environment}${branchSuffix}`,
				alarmDescription: "Alert when API Gateway server errors exceed threshold",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			apiServerErrorAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));

			const apiLatencyAlarm = new cloudwatch.Alarm(this, "ApiHighLatencyAlarm", {
				metric: props.api.metricLatency({
					statistic: "Average",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 3000,
				evaluationPeriods: isProd ? 4 : 2,
				alarmName: `vcm-api-high-latency-${environment}${branchSuffix}`,
				alarmDescription: "Alert when API Gateway latency is high",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			apiLatencyAlarm.addAlarmAction(new cw_actions.SnsAction(this.warningTopic));
		}

		// ==================== Outputs ====================
		new cdk.CfnOutput(this, "AlertTopicArn", {
			value: this.alertTopic.topicArn,
			description: "SNS Alert Topic ARN",
			exportName: `vcm-alert-topic-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "WarningTopicArn", {
			value: this.warningTopic.topicArn,
			description: "SNS Warning Topic ARN",
			exportName: `vcm-warning-topic-${environment}${branchSuffix}`,
		});
	}
}
