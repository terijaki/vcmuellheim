import * as cdk from "aws-cdk-lib";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbName: string;
  dbUsername: string;
  databaseSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly appSecrets: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Create database credentials secret
    this.databaseSecret = new secretsmanager.Secret(this, "DatabaseSecret", {
      description: "RDS PostgreSQL credentials for vcmuellheim.de",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.dbUsername }),
        generateStringKey: "password",
        excludeCharacters: '"@/\\',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create DB subnet group
    const dbSubnetGroup = new rds.SubnetGroup(this, "DatabaseSubnetGroup", {
      vpc: props.vpc,
      description: "Subnet group for RDS PostgreSQL database",
      vpcSubnets: { subnets: props.vpc.isolatedSubnets },
    });

    // Create database parameter group for PostgreSQL optimization
    const parameterGroup = new rds.ParameterGroup(this, "DatabaseParameterGroup", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_8,
      }),
      description: "Parameter group for vcmuellheim PostgreSQL database",
      parameters: {
        // Optimize for small to medium workloads
        shared_preload_libraries: "pg_stat_statements",
        log_statement: "mod",
        log_min_duration_statement: "1000", // Log queries taking >1s
        work_mem: "32MB",
        maintenance_work_mem: "256MB",
        effective_cache_size: "1GB", // Adjust based on instance size
        random_page_cost: "1.1", // SSD optimized
      },
    });

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_8,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO), // Cost-optimized
      vpc: props.vpc,
      subnetGroup: dbSubnetGroup,
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: props.dbName,
      parameterGroup: parameterGroup,
      
      // Storage configuration
      allocatedStorage: 20, // Start small, can scale up
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      maxAllocatedStorage: 100, // Auto-scaling up to 100GB
      
      // Backup and maintenance
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      deleteAutomatedBackups: false,
      preferredBackupWindow: "03:00-04:00", // 3-4 AM CET
      preferredMaintenanceWindow: "sun:04:00-sun:05:00", // Sunday 4-5 AM CET
      
      // Monitoring
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      
      // Security
      multiAz: false, // Single AZ for cost optimization, can be changed later
      publiclyAccessible: false,
      securityGroups: [props.databaseSecurityGroup],
      
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT, // Create snapshot on deletion
    });

    // Create application secrets for environment variables
    this.appSecrets = new secretsmanager.Secret(this, "AppSecrets", {
      description: "Application secrets for vcmuellheim.de",
      secretObjectValue: {
        PAYLOAD_SECRET: cdk.SecretValue.unsafePlainText(this.generateRandomString(64)),
        RESEND_API_KEY: cdk.SecretValue.unsafePlainText(""), // To be filled manually
        S3_BUCKET: cdk.SecretValue.unsafePlainText("vcmuellheim-assets"), // Will be created
        S3_REGION: cdk.SecretValue.unsafePlainText(cdk.Stack.of(this).region),
        S3_ACCESS_KEY_ID: cdk.SecretValue.unsafePlainText(""), // To be filled after S3 setup
        S3_SECRET_ACCESS_KEY: cdk.SecretValue.unsafePlainText(""), // To be filled after S3 setup
        SAMS_SERVER: cdk.SecretValue.unsafePlainText("https://www.volleyball-baden.de"),
        NODE_ENV: cdk.SecretValue.unsafePlainText("production"),
        SENTRY_ENVIRONMENT: cdk.SecretValue.unsafePlainText("production"),
        TZ: cdk.SecretValue.unsafePlainText("Europe/Berlin"),
        NEXT_TELEMETRY_DISABLED: cdk.SecretValue.unsafePlainText("1"),
      },
    });

    // Output database connection string format
    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: this.database.instanceEndpoint.hostname,
      description: "RDS PostgreSQL endpoint",
      exportName: "VcmuellheimDatabaseEndpoint",
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: this.databaseSecret.secretArn,
      description: "Database credentials secret ARN",
      exportName: "VcmuellheimDatabaseSecretArn",
    });

    new cdk.CfnOutput(this, "AppSecretsArn", {
      value: this.appSecrets.secretArn,
      description: "Application secrets ARN",
      exportName: "VcmuellheimAppSecretsArn",
    });
  }

  private generateRandomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}