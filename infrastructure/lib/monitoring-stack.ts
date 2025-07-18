import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface MonitoringStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  database: rds.DatabaseInstance;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: "vcmuellheim-alarms",
      displayName: "VCM Alarms",
    });

    // Add email subscription (to be configured manually)
    // this.alarmTopic.addSubscription(
    //   new snsSubscriptions.EmailSubscription("admin@vcmuellheim.de")
    // );

    // ECS Service Monitoring
    const ecsServiceRunningTasksAlarm = new cloudwatch.Alarm(this, "EcsServiceRunningTasksAlarm", {
      alarmName: "vcmuellheim-ecs-no-running-tasks",
      alarmDescription: "ECS service has no running tasks",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ECS",
        metricName: "RunningTaskCount",
        dimensionsMap: {
          ServiceName: props.ecsService.serviceName,
          ClusterName: props.ecsService.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    ecsServiceRunningTasksAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const ecsServiceCpuAlarm = new cloudwatch.Alarm(this, "EcsServiceCpuAlarm", {
      alarmName: "vcmuellheim-ecs-high-cpu",
      alarmDescription: "ECS service CPU utilization is high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ECS",
        metricName: "CPUUtilization",
        dimensionsMap: {
          ServiceName: props.ecsService.serviceName,
          ClusterName: props.ecsService.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 80,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
    });

    ecsServiceCpuAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const ecsServiceMemoryAlarm = new cloudwatch.Alarm(this, "EcsServiceMemoryAlarm", {
      alarmName: "vcmuellheim-ecs-high-memory",
      alarmDescription: "ECS service memory utilization is high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ECS",
        metricName: "MemoryUtilization",
        dimensionsMap: {
          ServiceName: props.ecsService.serviceName,
          ClusterName: props.ecsService.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 85,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
    });

    ecsServiceMemoryAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    // Load Balancer Monitoring
    const albHealthyTargetsAlarm = new cloudwatch.Alarm(this, "AlbHealthyTargetsAlarm", {
      alarmName: "vcmuellheim-alb-no-healthy-targets",
      alarmDescription: "ALB has no healthy targets",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "HealthyHostCount",
        dimensionsMap: {
          LoadBalancer: props.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(1),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    albHealthyTargetsAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const albResponseTimeAlarm = new cloudwatch.Alarm(this, "AlbResponseTimeAlarm", {
      alarmName: "vcmuellheim-alb-high-response-time",
      alarmDescription: "ALB response time is high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "TargetResponseTime",
        dimensionsMap: {
          LoadBalancer: props.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 2, // 2 seconds
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
    });

    albResponseTimeAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const alb5xxErrorsAlarm = new cloudwatch.Alarm(this, "Alb5xxErrorsAlarm", {
      alarmName: "vcmuellheim-alb-5xx-errors",
      alarmDescription: "ALB is returning 5xx errors",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "HTTPCode_Target_5XX_Count",
        dimensionsMap: {
          LoadBalancer: props.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: 5,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alb5xxErrorsAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    // Database Monitoring
    const dbCpuAlarm = new cloudwatch.Alarm(this, "DatabaseCpuAlarm", {
      alarmName: "vcmuellheim-db-high-cpu",
      alarmDescription: "RDS instance CPU utilization is high",
      metric: props.database.metricCPUUtilization({
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 80,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
    });

    dbCpuAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const dbConnectionsAlarm = new cloudwatch.Alarm(this, "DatabaseConnectionsAlarm", {
      alarmName: "vcmuellheim-db-high-connections",
      alarmDescription: "RDS instance connection count is high",
      metric: props.database.metricDatabaseConnections({
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 40, // Adjust based on instance type
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
    });

    dbConnectionsAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    const dbFreeStorageSpaceAlarm = new cloudwatch.Alarm(this, "DatabaseFreeStorageAlarm", {
      alarmName: "vcmuellheim-db-low-storage",
      alarmDescription: "RDS instance free storage space is low",
      metric: new cloudwatch.Metric({
        namespace: "AWS/RDS",
        metricName: "FreeStorageSpace",
        dimensionsMap: {
          DBInstanceIdentifier: props.database.instanceIdentifier,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: 2 * 1024 * 1024 * 1024, // 2 GB in bytes
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
    });

    dbFreeStorageSpaceAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: "vcmuellheim-monitoring",
    });

    // Add widgets to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "ECS Service Metrics",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "RunningTaskCount",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsService.cluster.clusterName,
            },
            label: "Running Tasks",
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "CPUUtilization",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsService.cluster.clusterName,
            },
            label: "CPU Utilization (%)",
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "MemoryUtilization",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsService.cluster.clusterName,
            },
            label: "Memory Utilization (%)",
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Load Balancer Metrics",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "RequestCount",
            dimensionsMap: {
              LoadBalancer: props.loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(5),
            statistic: cloudwatch.Statistic.SUM,
            label: "Request Count",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "TargetResponseTime",
            dimensionsMap: {
              LoadBalancer: props.loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(5),
            statistic: cloudwatch.Statistic.AVERAGE,
            label: "Response Time (s)",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Database Metrics",
        left: [
          props.database.metricCPUUtilization({
            label: "CPU Utilization (%)",
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          props.database.metricDatabaseConnections({
            label: "Database Connections",
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, "AlarmTopicArn", {
      value: this.alarmTopic.topicArn,
      description: "SNS topic ARN for alarms",
      exportName: "VcmuellheimAlarmTopicArn",
    });

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL",
      exportName: "VcmuellheimDashboardUrl",
    });
  }
}