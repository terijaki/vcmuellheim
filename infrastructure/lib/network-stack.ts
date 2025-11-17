import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvironmentConfig } from "../config/environment";

export interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly applicationSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, "VCMuellheimVPC", {
      vpcName: `vcmuellheim-${config.environment}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "Database",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Security group for Aurora DSQL database
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Aurora DSQL database",
      allowAllOutbound: false,
    });

    // Security group for application (Amplify/ECS)
    this.applicationSecurityGroup = new ec2.SecurityGroup(this, "ApplicationSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Next.js application",
      allowAllOutbound: true,
    });

    // Allow application to access database on PostgreSQL port
    this.databaseSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow PostgreSQL access from application"
    );

    // Tags
    cdk.Tags.of(this.vpc).add("Environment", config.environment);
    cdk.Tags.of(this.vpc).add("Application", "vcmuellheim");

    // Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "VPC ID",
      exportName: `${config.environment}-VpcId`,
    });

    new cdk.CfnOutput(this, "DatabaseSecurityGroupId", {
      value: this.databaseSecurityGroup.securityGroupId,
      description: "Database Security Group ID",
      exportName: `${config.environment}-DatabaseSecurityGroupId`,
    });

    new cdk.CfnOutput(this, "ApplicationSecurityGroupId", {
      value: this.applicationSecurityGroup.securityGroupId,
      description: "Application Security Group ID",
      exportName: `${config.environment}-ApplicationSecurityGroupId`,
    });
  }
}
