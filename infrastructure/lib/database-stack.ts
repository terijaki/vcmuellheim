import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/environment";

export interface DatabaseStackProps extends cdk.StackProps {
	config: EnvironmentConfig;
	vpc: ec2.Vpc;
	securityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
	public readonly cluster: rds.DatabaseCluster;
	public readonly secret: secretsmanager.Secret;
	public readonly clusterEndpoint: string;

	constructor(scope: Construct, id: string, props: DatabaseStackProps) {
		super(scope, id, props);

		const { config, vpc, securityGroup } = props;

		// Create database credentials secret
		this.secret = new secretsmanager.Secret(this, "DatabaseSecret", {
			secretName: `vcmuellheim-${config.environment}-db-credentials`,
			description: "Aurora PostgreSQL database credentials",
			generateSecretString: {
				secretStringTemplate: JSON.stringify({
					username: "vcmuellheim_admin",
				}),
				generateStringKey: "password",
				excludePunctuation: true,
				includeSpace: false,
				passwordLength: 32,
			},
		});

		// Create subnet group for database
		const subnetGroup = new rds.SubnetGroup(this, "DatabaseSubnetGroup", {
			description: "Subnet group for Aurora PostgreSQL cluster",
			vpc,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
			},
		});

		// Create Aurora Serverless v2 cluster with PostgreSQL
		// Note: Aurora DSQL is not yet fully supported in CDK, so we use Aurora Serverless v2
		// which provides similar benefits (serverless scaling, PostgreSQL compatibility)
		this.cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
			engine: rds.DatabaseClusterEngine.auroraPostgres({
				version: rds.AuroraPostgresEngineVersion.VER_15_4,
			}),
			writer: rds.ClusterInstance.serverlessV2("writer", {
				autoMinorVersionUpgrade: true,
			}),
			readers:
				config.environment === "prod"
					? [
							rds.ClusterInstance.serverlessV2("reader1", {
								scaleWithWriter: true,
							}),
						]
					: undefined,
			serverlessV2MinCapacity: config.environment === "prod" ? 1 : 0.5,
			serverlessV2MaxCapacity: config.environment === "prod" ? 4 : 2,
			credentials: rds.Credentials.fromSecret(this.secret),
			defaultDatabaseName: "vcmuellheim",
			vpc,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
			},
			securityGroups: [securityGroup],
			subnetGroup,
			backup: {
				retention: config.environment === "prod" ? cdk.Duration.days(30) : cdk.Duration.days(7),
				preferredWindow: "03:00-04:00",
			},
			preferredMaintenanceWindow: "sun:04:00-sun:05:00",
			storageEncrypted: true,
			removalPolicy: config.environment === "prod" ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
			deletionProtection: config.environment === "prod",
			cloudwatchLogsExports: ["postgresql"],
			cloudwatchLogsRetention: config.environment === "prod" ? 30 : 7,
		});

		this.clusterEndpoint = this.cluster.clusterEndpoint.socketAddress;

		// Tags
		cdk.Tags.of(this.cluster).add("Environment", config.environment);
		cdk.Tags.of(this.cluster).add("Application", "vcmuellheim");

		// Outputs
		new cdk.CfnOutput(this, "ClusterEndpoint", {
			value: this.cluster.clusterEndpoint.hostname,
			description: "Aurora cluster endpoint",
			exportName: `${config.environment}-ClusterEndpoint`,
		});

		new cdk.CfnOutput(this, "ClusterPort", {
			value: this.cluster.clusterEndpoint.port.toString(),
			description: "Aurora cluster port",
			exportName: `${config.environment}-ClusterPort`,
		});

		new cdk.CfnOutput(this, "SecretArn", {
			value: this.secret.secretArn,
			description: "Database credentials secret ARN",
			exportName: `${config.environment}-DatabaseSecretArn`,
		});

		new cdk.CfnOutput(this, "DatabaseName", {
			value: "vcmuellheim",
			description: "Database name",
			exportName: `${config.environment}-DatabaseName`,
		});
	}
}
