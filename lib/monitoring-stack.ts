/**
 * CDK Stack for Comprehensive Monitoring
 * Includes CloudWatch dashboards, alarms, and SNS notifications
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
	trpcLambda?: lambda.IFunction;
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
	public readonly dashboard: cloudwatch.Dashboard;

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

		// ==================== CloudWatch Dashboard ====================
		this.dashboard = new cloudwatch.Dashboard(this, "MainDashboard", {
			dashboardName: `vcm-main-${environment}${branchSuffix}`,
			defaultInterval: cdk.Duration.hours(1),
		});

		// === Lambda Metrics ===
		if (props.trpcLambda) {
			this.dashboard.addWidgets(
				new cloudwatch.GraphWidget({
					title: "tRPC Lambda - Invocations & Errors",
					left: [
						props.trpcLambda.metricInvocations({
							statistic: "Sum",
							label: "Invocations",
						}),
						props.trpcLambda.metricErrors({
							statistic: "Sum",
							label: "Errors",
							color: cloudwatch.Color.RED,
						}),
					],
					width: 12,
				}),
				new cloudwatch.GraphWidget({
					title: "tRPC Lambda - Duration",
					left: [
						props.trpcLambda.metricDuration({
							statistic: "Average",
							label: "Avg Duration (ms)",
						}),
						props.trpcLambda.metricDuration({
							statistic: "Maximum",
							label: "Max Duration (ms)",
							color: cloudwatch.Color.ORANGE,
						}),
					],
					width: 12,
				}),
				new cloudwatch.GraphWidget({
					title: "tRPC Lambda - Throttles",
					left: [
						props.trpcLambda.metricThrottles({
							statistic: "Sum",
							label: "Throttles",
							color: cloudwatch.Color.ORANGE,
						}),
					],
					width: 12,
				}),
			);

			// tRPC Lambda Alarms
			const trpcErrorAlarm = new cloudwatch.Alarm(this, "TrpcErrorRateAlarm", {
				metric: props.trpcLambda.metricErrors({
					statistic: "Sum",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 10,
				evaluationPeriods: 2,
				alarmName: `vcm-trpc-errors-${environment}${branchSuffix}`,
				alarmDescription: "Alert when tRPC Lambda error rate exceeds threshold",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			trpcErrorAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));

			const trpcDurationAlarm = new cloudwatch.Alarm(this, "TrpcDurationAlarm", {
				metric: props.trpcLambda.metricDuration({
					statistic: "Average",
					period: cdk.Duration.minutes(5),
				}),
				threshold: isProd ? 3000 : 5000,
				evaluationPeriods: 2,
				alarmName: `vcm-trpc-duration-${environment}${branchSuffix}`,
				alarmDescription: "Alert when tRPC Lambda execution time is high",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			trpcDurationAlarm.addAlarmAction(new cw_actions.SnsAction(this.warningTopic));

			const trpcThrottlesAlarm = new cloudwatch.Alarm(this, "TrpcThrottlesAlarm", {
				metric: props.trpcLambda.metricThrottles({
					statistic: "Sum",
					period: cdk.Duration.minutes(5),
				}),
				threshold: 1,
				evaluationPeriods: 1,
				alarmName: `vcm-trpc-throttles-${environment}${branchSuffix}`,
				alarmDescription: "Alert when tRPC Lambda is throttled",
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			trpcThrottlesAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));
		}

		// === SAMS Lambda Metrics ===
		if (props.samsLambdas) {
			const samsMetrics: cloudwatch.IMetric[] = [];

			if (props.samsLambdas.clubsSync) {
				samsMetrics.push(props.samsLambdas.clubsSync.metricInvocations({ label: "Clubs Sync", statistic: "Sum" }));
			}
			if (props.samsLambdas.teamsSync) {
				samsMetrics.push(props.samsLambdas.teamsSync.metricInvocations({ label: "Teams Sync", statistic: "Sum" }));
			}

			if (samsMetrics.length > 0) {
				this.dashboard.addWidgets(
					new cloudwatch.GraphWidget({
						title: "SAMS Lambda - Sync Invocations",
						left: samsMetrics,
						width: 12,
					}),
				);
			}
		}

		// === DynamoDB Metrics ===
		if (props.contentTables) {
			const tables = Object.entries(props.contentTables).slice(0, 4);

			this.dashboard.addWidgets(
				new cloudwatch.GraphWidget({
					title: "DynamoDB - User Errors",
					left: tables.map(([, table]) =>
						table.metricUserErrors({
							statistic: "Sum",
							label: "User Errors",
						}),
					),
					width: 12,
				}),
				new cloudwatch.GraphWidget({
					title: "DynamoDB - Consumed Capacity Units",
					left: tables.map(([, table]) =>
						table.metricConsumedReadCapacityUnits({
							statistic: "Sum",
							label: "Read CUs",
						}),
					),
					right: tables.map(([, table]) =>
						table.metricConsumedWriteCapacityUnits({
							statistic: "Sum",
							label: "Write CUs",
						}),
					),
					width: 12,
				}),
			);

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

		// === S3 Metrics ===
		if (props.mediaBucket) {
			this.dashboard.addWidgets(
				new cloudwatch.GraphWidget({
					title: "S3 Media Bucket",
					left: [
						new cloudwatch.Metric({
							namespace: "AWS/S3",
							metricName: "BucketSizeBytes",
							dimensionsMap: {
								BucketName: props.mediaBucket.bucketName,
								StorageType: "StandardStorage",
							},
							statistic: "Average",
							label: "Bucket Size (bytes)",
						}),
					],
					width: 12,
				}),
			);
		}

		// === CloudFront Metrics ===
		const cfMetrics: cloudwatch.IMetric[] = [];
		const cfRequestMetrics: cloudwatch.IMetric[] = [];

		if (props.mediaDistribution) {
			const distId = props.mediaDistribution.distributionId;
			cfMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "CacheHitRate",
					dimensionsMap: { DistributionId: distId },
					statistic: "Average",
					label: "Media Cache Hit Rate (%)",
				}),
			);
			cfRequestMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "Requests",
					dimensionsMap: { DistributionId: distId },
					statistic: "Sum",
					label: "Media Requests",
				}),
			);
		}

		if (props.cmsDistribution) {
			const distId = props.cmsDistribution.distributionId;
			cfMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "CacheHitRate",
					dimensionsMap: { DistributionId: distId },
					statistic: "Average",
					label: "CMS Cache Hit Rate (%)",
				}),
			);
			cfRequestMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "Requests",
					dimensionsMap: { DistributionId: distId },
					statistic: "Sum",
					label: "CMS Requests",
				}),
			);
		}

		if (props.websiteDistribution) {
			const distId = props.websiteDistribution.distributionId;
			cfMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "CacheHitRate",
					dimensionsMap: { DistributionId: distId },
					statistic: "Average",
					label: "Website Cache Hit Rate (%)",
				}),
			);
			cfRequestMetrics.push(
				new cloudwatch.Metric({
					namespace: "AWS/CloudFront",
					metricName: "Requests",
					dimensionsMap: { DistributionId: distId },
					statistic: "Sum",
					label: "Website Requests",
				}),
			);
		}

		if (cfMetrics.length > 0) {
			this.dashboard.addWidgets(
				new cloudwatch.GraphWidget({
					title: "CloudFront - Cache Hit Rate (%)",
					left: cfMetrics,
					width: 12,
				}),
				new cloudwatch.GraphWidget({
					title: "CloudFront - Requests",
					left: cfRequestMetrics,
					width: 12,
				}),
			);
		}

		// === API Gateway Metrics ===
		if (props.api) {
			this.dashboard.addWidgets(
				new cloudwatch.GraphWidget({
					title: "API Gateway - Requests & Latency",
					left: [
						props.api.metricCount({
							statistic: "Sum",
							label: "Requests",
						}),
					],
					right: [
						props.api.metricLatency({
							statistic: "Average",
							label: "Avg Latency (ms)",
						}),
					],
					width: 12,
				}),
				new cloudwatch.GraphWidget({
					title: "API Gateway - Client & Server Errors",
					left: [
						props.api.metricClientError({
							statistic: "Sum",
							label: "4xx Errors",
							color: cloudwatch.Color.ORANGE,
						}),
						props.api.metricServerError({
							statistic: "Sum",
							label: "5xx Errors",
							color: cloudwatch.Color.RED,
						}),
					],
					width: 12,
				}),
			);

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

		new cdk.CfnOutput(this, "DashboardName", {
			value: `vcm-main-${environment}${branchSuffix}`,
			description: "CloudWatch Dashboard Name",
			exportName: `vcm-dashboard-${environment}${branchSuffix}`,
		});
	}
}
