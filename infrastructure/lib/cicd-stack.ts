import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface CicdStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  ecrRepository: ecr.Repository;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
}

export class CicdStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly buildProject: codebuild.Project;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // Create S3 bucket for CodePipeline artifacts
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      bucketName: `vcmuellheim-cicd-artifacts-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: "DeleteOldArtifacts",
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // Create GitHub connection secret (to be filled manually)
    const githubSecret = new secretsmanager.Secret(this, "GitHubSecret", {
      description: "GitHub personal access token for vcmuellheim.de CI/CD",
      secretStringValue: cdk.SecretValue.unsafePlainText(""), // To be filled manually
    });

    // Create CodeBuild service role
    const codeBuildRole = new iam.Role(this, "CodeBuildRole", {
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      description: "Service role for CodeBuild project",
    });

    // Add permissions for CodeBuild
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/codebuild/*`,
        ],
      })
    );

    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ],
        resources: ["*"],
      })
    );

    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
        ],
        resources: [
          `${artifactsBucket.bucketArn}/*`,
        ],
      })
    );

    // Create CodeBuild project
    this.buildProject = new codebuild.Project(this, "BuildProject", {
      projectName: "vcmuellheim-build",
      role: codeBuildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true, // Required for Docker builds
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: props.ecrRepository.repositoryUri,
        },
        ECS_CLUSTER_NAME: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: props.ecsService.cluster.clusterName,
        },
        ECS_SERVICE_NAME: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: props.ecsService.serviceName,
        },
        AWS_DEFAULT_REGION: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: cdk.Stack.of(this).region,
        },
        AWS_ACCOUNT_ID: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: cdk.Stack.of(this).account,
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "echo Logging in to Amazon ECR...",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI",
              "echo Build started on `date`",
              "echo $ECR_REPOSITORY_URI",
              "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
              "IMAGE_TAG=${COMMIT_HASH:=latest}",
            ],
          },
          build: {
            commands: [
              "echo Build started on `date`",
              "echo Building the Docker image...",
              "docker build -t $ECR_REPOSITORY_URI:latest -f Containerfile .",
              "docker tag $ECR_REPOSITORY_URI:latest $ECR_REPOSITORY_URI:$IMAGE_TAG",
            ],
          },
          post_build: {
            commands: [
              "echo Build completed on `date`",
              "echo Pushing the Docker images...",
              "docker push $ECR_REPOSITORY_URI:latest",
              "docker push $ECR_REPOSITORY_URI:$IMAGE_TAG",
              "echo Writing image definitions file...",
              "printf '[{\"name\":\"vcmuellheim\",\"imageUri\":\"%s\"}]' $ECR_REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json",
              "cat imagedefinitions.json",
            ],
          },
        },
        artifacts: {
          files: ["imagedefinitions.json"],
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
    });

    // Create CodePipeline
    const sourceOutput = new codepipeline.Artifact("SourceOutput");
    const buildOutput = new codepipeline.Artifact("BuildOutput");

    this.pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "vcmuellheim-pipeline",
      artifactBucket: artifactsBucket,
      restartExecutionOnUpdate: true,
      stages: [
        {
          stageName: "Source",
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: "GitHub",
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: props.githubBranch,
              oauthToken: githubSecret.secretValue,
              output: sourceOutput,
              trigger: codepipelineActions.GitHubTrigger.WEBHOOK,
            }),
          ],
        },
        {
          stageName: "Build",
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: "Build",
              project: this.buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: "Deploy",
          actions: [
            new codepipelineActions.EcsDeployAction({
              actionName: "Deploy",
              service: props.ecsService,
              input: buildOutput,
              deploymentTimeout: cdk.Duration.minutes(20),
            }),
          ],
        },
      ],
    });

    // Grant ECR permissions to the pipeline
    props.ecrRepository.grantPullPush(this.buildProject);
    
    // Grant ECS permissions to CodePipeline service role
    const pipelineRole = this.pipeline.role;
    if (pipelineRole) {
      // Create a policy for ECS update permissions
      const ecsUpdatePolicy = new iam.Policy(this, "EcsUpdatePolicy", {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "ecs:UpdateService",
              "ecs:DescribeServices",
              "ecs:DescribeTaskDefinition",
              "ecs:RegisterTaskDefinition",
            ],
            resources: [
              props.ecsService.serviceArn,
              `arn:aws:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:service/${props.ecsService.cluster.clusterName}/${props.ecsService.serviceName}`,
            ],
          }),
        ],
      });
      
      // Attach policy to role
      ecsUpdatePolicy.attachToRole(pipelineRole);
    }

    // Create a manual deployment script alternative
    const deploymentRole = new iam.Role(this, "ManualDeploymentRole", {
      assumedBy: new iam.AccountRootPrincipal(),
      description: "Role for manual deployments",
      inlinePolicies: {
        DeploymentPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ecs:UpdateService",
                "ecs:DescribeServices",
                "ecs:DescribeTaskDefinition",
                "ecs:RegisterTaskDefinition",
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "PipelineName", {
      value: this.pipeline.pipelineName,
      description: "CodePipeline name",
      exportName: "VcmuellheimPipelineName",
    });

    new cdk.CfnOutput(this, "BuildProjectName", {
      value: this.buildProject.projectName,
      description: "CodeBuild project name",
      exportName: "VcmuellheimBuildProjectName",
    });

    new cdk.CfnOutput(this, "GitHubSecretArn", {
      value: githubSecret.secretArn,
      description: "GitHub token secret ARN (needs to be populated)",
      exportName: "VcmuellheimGitHubSecretArn",
    });

    new cdk.CfnOutput(this, "ManualDeploymentRoleArn", {
      value: deploymentRole.roleArn,
      description: "Role ARN for manual deployments",
      exportName: "VcmuellheimManualDeploymentRoleArn",
    });
  }
}