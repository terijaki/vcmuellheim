import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvironmentConfig } from "../config/environment";

export interface HostingStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  databaseSecret: secretsmanager.Secret;
  mediaBucketName: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
}

export class HostingStack extends cdk.Stack {
  public readonly app: amplify.CfnApp;
  public readonly branch: amplify.CfnBranch;

  constructor(scope: Construct, id: string, props: HostingStackProps) {
    super(scope, id, props);

    const { config, databaseSecret, mediaBucketName, s3AccessKeyId, s3SecretAccessKey } = props;

    // IAM role for Amplify with permissions to access Secrets Manager
    const amplifyRole = new iam.Role(this, "AmplifyRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      description: "Role for Amplify to access AWS resources",
    });

    // Grant Amplify access to database secret
    databaseSecret.grantRead(amplifyRole);

    // Create Amplify App
    this.app = new amplify.CfnApp(this, "AmplifyApp", {
      name: `vcmuellheim-${config.environment}`,
      repository: `https://github.com/${config.githubOwner}/${config.githubRepo}`,
      // Note: OAuth token needs to be set up separately in AWS Console or via GitHub App
      // accessToken: "PLACEHOLDER - Set this via AWS Console or GitHub App",
      iamServiceRole: amplifyRole.roleArn,
      platform: "WEB_COMPUTE",
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
`,
      environmentVariables: [
        {
          name: "NODE_ENV",
          value: "production",
        },
        {
          name: "NEXT_TELEMETRY_DISABLED",
          value: "1",
        },
        {
          name: "DATABASE_SECRET_ARN",
          value: databaseSecret.secretArn,
        },
        {
          name: "S3_BUCKET",
          value: mediaBucketName,
        },
        {
          name: "S3_REGION",
          value: config.region,
        },
        {
          name: "S3_ACCESS_KEY_ID",
          value: s3AccessKeyId,
        },
        {
          name: "S3_SECRET_ACCESS_KEY",
          value: s3SecretAccessKey,
        },
        {
          name: "SAMS_SERVER",
          value: "https://www.volleyball-baden.de",
        },
        // Note: PAYLOAD_SECRET, RESEND_API_KEY, SENTRY_AUTH_TOKEN, etc.
        // should be set via Amplify Console or CI/CD secrets
      ],
      customRules: [
        {
          source: "/<*>",
          target: "/index.html",
          status: "404-200",
        },
      ],
    });

    // Create branch
    this.branch = new amplify.CfnBranch(this, "AmplifyBranch", {
      appId: this.app.attrAppId,
      branchName: config.amplifyBranch,
      enableAutoBuild: true,
      enablePullRequestPreview: config.environment !== "prod",
      framework: "Next.js - SSR",
      stage: config.environment === "prod" ? "PRODUCTION" : "DEVELOPMENT",
    });

    // Tags
    cdk.Tags.of(this.app).add("Environment", config.environment);
    cdk.Tags.of(this.app).add("Application", "vcmuellheim");

    // Outputs
    new cdk.CfnOutput(this, "AmplifyAppId", {
      value: this.app.attrAppId,
      description: "Amplify App ID",
      exportName: `${config.environment}-AmplifyAppId`,
    });

    new cdk.CfnOutput(this, "AmplifyDefaultDomain", {
      value: this.app.attrDefaultDomain,
      description: "Amplify default domain",
      exportName: `${config.environment}-AmplifyDefaultDomain`,
    });

    new cdk.CfnOutput(this, "AmplifyAppUrl", {
      value: `https://${config.amplifyBranch}.${this.app.attrDefaultDomain}`,
      description: "Amplify app URL",
    });
  }
}
