#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkingStack } from "../lib/networking-stack";
import { DatabaseStack } from "../lib/database-stack";
import { ComputeStack } from "../lib/compute-stack";
import { CicdStack } from "../lib/cicd-stack";
import { DomainStack } from "../lib/domain-stack";
import { MonitoringStack } from "../lib/monitoring-stack";

const app = new cdk.App();

// Configuration
const config = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "eu-central-1",
  },
  domainName: "vcmuellheim.de",
  subdomainName: "vcmuellheim.de", // Using apex domain
  certificateArn: "", // Will be created by Domain stack
  hostedZoneId: "", // Existing hosted zone ID for vcmuellheim.de
  githubOwner: "terijaki",
  githubRepo: "vcmuellheim",
  githubBranch: "main",
  containerPort: 3080,
  dbName: "vcmuellheim",
  dbUsername: "vcmuellheim",
};

// Networking Stack - VPC, Subnets, Security Groups
const networkingStack = new NetworkingStack(app, "VcmuellheimNetworking", {
  env: config.env,
  description: "Networking infrastructure for vcmuellheim.de",
});

// Database Stack - RDS PostgreSQL
const databaseStack = new DatabaseStack(app, "VcmuellheimDatabase", {
  env: config.env,
  description: "Database infrastructure for vcmuellheim.de",
  vpc: networkingStack.vpc,
  dbName: config.dbName,
  dbUsername: config.dbUsername,
  databaseSecurityGroup: networkingStack.databaseSecurityGroup,
});

// Domain Stack - Route 53, ACM Certificate
const domainStack = new DomainStack(app, "VcmuellheimDomain", {
  env: config.env,
  description: "Domain and SSL infrastructure for vcmuellheim.de",
  domainName: config.domainName,
  subdomainName: config.subdomainName,
});

// Compute Stack - ECS Fargate, ALB, CloudFront
const computeStack = new ComputeStack(app, "VcmuellheimCompute", {
  env: config.env,
  description: "Compute infrastructure for vcmuellheim.de",
  vpc: networkingStack.vpc,
  database: databaseStack.database,
  certificate: domainStack.certificate,
  domainName: config.domainName,
  containerPort: config.containerPort,
  albSecurityGroup: networkingStack.albSecurityGroup,
  ecsSecurityGroup: networkingStack.ecsSecurityGroup,
  appSecrets: databaseStack.appSecrets,
});

// CI/CD Stack - CodePipeline, CodeBuild, ECR
const cicdStack = new CicdStack(app, "VcmuellheimCicd", {
  env: config.env,
  description: "CI/CD infrastructure for vcmuellheim.de",
  ecsService: computeStack.ecsService,
  ecrRepository: computeStack.ecrRepository,
  githubOwner: config.githubOwner,
  githubRepo: config.githubRepo,
  githubBranch: config.githubBranch,
});

// Monitoring Stack - CloudWatch, Alarms
const monitoringStack = new MonitoringStack(app, "VcmuellheimMonitoring", {
  env: config.env,
  description: "Monitoring infrastructure for vcmuellheim.de",
  ecsService: computeStack.ecsService,
  loadBalancer: computeStack.loadBalancer,
  database: databaseStack.database,
});

// Add dependencies
databaseStack.addDependency(networkingStack);
computeStack.addDependency(networkingStack);
computeStack.addDependency(databaseStack);
computeStack.addDependency(domainStack);
cicdStack.addDependency(computeStack);
monitoringStack.addDependency(computeStack);
monitoringStack.addDependency(databaseStack);