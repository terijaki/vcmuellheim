import { BUN_DOCKER_IMAGE, BUN_TIME_LAYER_SSM_NAME } from "@utils/buntime";
import { getSanitizedBranch } from "@utils/git";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { buildLambdaFunctionName } from "./vcm-nodejs-function";

export interface VcmBunFunctionProps {
  namespace: string;
  name: string;
  /** Path to the TypeScript handler entry (must export `handler`). */
  entry: string;
  timeout?: cdk.Duration;
  memorySize?: number;
  environment?: Record<string, string>;
}

function buildLogGroupName(namespace: string, baseName: string): string {
  const environment = process.env.CDK_ENVIRONMENT || "dev";
  const branch = getSanitizedBranch();
  const branchSuffix = branch ? `-${branch}` : "";
  return `/vcm/${environment}${branchSuffix}/${namespace}/${baseName}`;
}

/**
 * Lambda on the account-scoped Bun custom runtime layer (`provided.al2023`).
 *
 * Function code is bundled locally with `bun build` (no Docker). The Bun binary
 * comes from the layer published by {@link BunTimeStack}.
 */
export class VcmBunFunction extends cdk.Resource {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: VcmBunFunctionProps) {
    super(scope, id);

    const {
      namespace,
      name,
      entry,
      timeout = cdk.Duration.seconds(30),
      memorySize = 512,
      environment = {},
    } = props;

    const bunLayerArn = ssm.StringParameter.valueForStringParameter(this, BUN_TIME_LAYER_SSM_NAME);
    const bunLayer = lambda.LayerVersion.fromLayerVersionArn(this, "BunTimeLayer", bunLayerArn);

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: buildLogGroupName(namespace, name),
      retention: logs.RetentionDays.TWO_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const repoRoot = path.join(__dirname, "../..");
    const entryPath = path.isAbsolute(entry) ? entry : path.join(repoRoot, entry);

    this.lambdaFunction = new lambda.Function(this, "Function", {
      functionName: buildLambdaFunctionName(name),
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.X86_64,
      handler: "index.handler",
      timeout,
      memorySize,
      logGroup,
      layers: [bunLayer],
      environment: {
        CDK_ENVIRONMENT: process.env.CDK_ENVIRONMENT || "dev",
        TMPDIR: "/tmp",
        HOME: "/tmp",
        BUN_RUNTIME_TRANSPILER_CACHE_PATH: "/tmp",
        ...environment,
      },
      code: lambda.Code.fromAsset(path.dirname(entryPath), {
        bundling: {
          image: cdk.DockerImage.fromRegistry(BUN_DOCKER_IMAGE),
          local: {
            tryBundle(outputDir: string) {
              try {
                mkdirSync(outputDir, { recursive: true });
                execFileSync(
                  "bun",
                  [
                    "build",
                    entryPath,
                    "--outfile",
                    path.join(outputDir, "index.js"),
                    "--target=bun",
                    "--minify",
                  ],
                  { cwd: repoRoot, stdio: "inherit" },
                );
                const indexPath = path.join(outputDir, "index.js");
                if (!existsSync(indexPath)) {
                  throw new Error(
                    `Bun build did not produce ${indexPath}. Do not combine --outfile with --sourcemap=linked for CDK temp output dirs.`,
                  );
                }
                const bootstrapPath = path.join(outputDir, "bootstrap");
                copyFileSync(path.join(__dirname, "../buntime/bootstrap"), bootstrapPath);
                chmodSync(bootstrapPath, 0o755);
                return true;
              } catch (error) {
                throw new Error(
                  `Bun Lambda bundling failed for ${name} (Docker fallback is disabled): ${error}`,
                );
              }
            },
          },
        },
      }),
    });
  }
}
