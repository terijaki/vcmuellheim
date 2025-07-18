import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  database: rds.DatabaseInstance;
  certificate: acm.Certificate;
  domainName: string;
  containerPort: number;
  albSecurityGroup: ec2.SecurityGroup;
  ecsSecurityGroup: ec2.SecurityGroup;
  appSecrets: secretsmanager.Secret;
}

export class ComputeStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsService: ecs.FargateService;
  public readonly ecrRepository: ecr.Repository;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly cloudFrontDistribution: cloudfront.Distribution;
  public readonly assetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create S3 bucket for assets and file uploads
    this.assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: `vcmuellheim-assets-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: [`https://${props.domainName}`],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: "DeleteIncompleteMultipartUploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // Create ECR repository
    this.ecrRepository = new ecr.Repository(this, "EcrRepository", {
      repositoryName: "vcmuellheim",
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: "Keep only 10 latest images",
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create ECS cluster
    this.ecsCluster = new ecs.Cluster(this, "EcsCluster", {
      vpc: props.vpc,
      clusterName: "vcmuellheim-cluster",
      containerInsights: true,
    });

    // Create CloudWatch log group
    const logGroup = new logs.LogGroup(this, "EcsLogGroup", {
      logGroupName: "/ecs/vcmuellheim",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create task role for ECS tasks
    const taskRole = new iam.Role(this, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Role for vcmuellheim ECS tasks",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });

    // Add permissions for S3, Secrets Manager, and other AWS services
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ],
        resources: [
          this.assetsBucket.bucketArn,
          `${this.assetsBucket.bucketArn}/*`,
        ],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:*`,
        ],
      })
    );

    // Create task execution role
    const executionRole = new iam.Role(this, "EcsExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Execution role for vcmuellheim ECS tasks",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });

    // Create Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      family: "vcmuellheim",
      cpu: 512, // 0.5 vCPU
      memoryLimitMiB: 1024, // 1 GB RAM
      taskRole: taskRole,
      executionRole: executionRole,
    });

    // Add container to task definition
    const container = taskDefinition.addContainer("vcmuellheim", {
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, "latest"),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "vcmuellheim",
        logGroup: logGroup,
      }),
      environment: {
        PORT: props.containerPort.toString(),
        HOSTNAME: "0.0.0.0",
        S3_BUCKET: this.assetsBucket.bucketName,
        S3_REGION: cdk.Stack.of(this).region,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(props.database.secret!, "engine"),
        PAYLOAD_SECRET: ecs.Secret.fromSecretsManager(props.appSecrets, "PAYLOAD_SECRET"),
        RESEND_API_KEY: ecs.Secret.fromSecretsManager(props.appSecrets, "RESEND_API_KEY"),
        S3_ACCESS_KEY_ID: ecs.Secret.fromSecretsManager(props.appSecrets, "S3_ACCESS_KEY_ID"),
        S3_SECRET_ACCESS_KEY: ecs.Secret.fromSecretsManager(props.appSecrets, "S3_SECRET_ACCESS_KEY"),
      },
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3080/health || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: props.containerPort,
      protocol: ecs.Protocol.TCP,
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
    });

    // Create HTTPS listener
    const httpsListener = this.loadBalancer.addListener("HttpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [props.certificate],
      defaultTargetGroups: [targetGroup],
    });

    // Create HTTP listener that redirects to HTTPS
    this.loadBalancer.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // Create ECS Fargate service
    this.ecsService = new ecs.FargateService(this, "EcsService", {
      cluster: this.ecsCluster,
      taskDefinition: taskDefinition,
      serviceName: "vcmuellheim-service",
      desiredCount: 1, // Start with 1 instance
      minHealthyPercent: 0, // Allow zero-downtime deployments
      maxHealthyPercent: 200,
      assignPublicIp: false,
      securityGroups: [props.ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Attach service to target group
    this.ecsService.attachToApplicationTargetGroup(targetGroup);

    // Create CloudFront distribution
    this.cloudFrontDistribution = new cloudfront.Distribution(this, "CloudFrontDistribution", {
      defaultBehavior: {
        origin: new cloudfrontOrigins.LoadBalancerV2Origin(this.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Disable caching for dynamic content
        compress: true,
      },
      additionalBehaviors: {
        "/_next/static/*": {
          origin: new cloudfrontOrigins.LoadBalancerV2Origin(this.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        "/images/*": {
          origin: new cloudfrontOrigins.LoadBalancerV2Origin(this.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      domainNames: [props.domainName],
      certificate: props.certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Europe and North America only
      enabled: true,
      comment: "CloudFront distribution for vcmuellheim.de",
    });

    // Create Route 53 record pointing to CloudFront
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domainName,
    });

    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(this.cloudFrontDistribution)
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: this.ecrRepository.repositoryUri,
      description: "ECR Repository URI",
      exportName: "VcmuellheimEcrRepositoryUri",
    });

    new cdk.CfnOutput(this, "LoadBalancerDnsName", {
      value: this.loadBalancer.loadBalancerDnsName,
      description: "Load Balancer DNS Name",
      exportName: "VcmuellheimLoadBalancerDnsName",
    });

    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: this.cloudFrontDistribution.distributionDomainName,
      description: "CloudFront Distribution Domain Name",
      exportName: "VcmuellheimCloudFrontDomainName",
    });

    new cdk.CfnOutput(this, "AssetsBucketName", {
      value: this.assetsBucket.bucketName,
      description: "S3 Assets Bucket Name",
      exportName: "VcmuellheimAssetsBucketName",
    });
  }
}