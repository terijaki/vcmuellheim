import { BUN_DOCKER_IMAGE, BUN_TIME_LAYER_SSM_NAME, BUN_VERSION } from "@utils/buntime";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { execFileSync } from "node:child_process";
import path from "node:path";

export interface BunTimeStackProps extends cdk.StackProps {
  stackProps?: {
    environment?: string;
  };
}

/**
 * Account-scoped Bun custom runtime layer (singleton per environment).
 *
 * Deploy manually with `cdk:deploy:buntime`, never via `cdk deploy --all` or
 * GitHub Actions. Feature-branch destroy must not include this stack.
 */
export class BunTimeStack extends cdk.Stack {
  public readonly layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props?: BunTimeStackProps) {
    super(scope, id, props);

    const environment = props?.stackProps?.environment || "dev";

    const assetDir = path.join(__dirname, "buntime");
    const bundleScript = path.join(assetDir, "bundle-layer.ts");

    this.layer = new lambda.LayerVersion(this, "BunTime", {
      layerVersionName: `vcm-buntime-${environment}`,
      description: `Bun ${BUN_VERSION} custom runtime (classic handler(event, context))`,
      compatibleRuntimes: [lambda.Runtime.PROVIDED_AL2023],
      compatibleArchitectures: [lambda.Architecture.X86_64],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      code: lambda.Code.fromAsset(assetDir, {
        exclude: ["**/*.test.ts"],
        bundling: {
          image: cdk.DockerImage.fromRegistry(BUN_DOCKER_IMAGE),
          local: {
            tryBundle(outputDir: string) {
              try {
                execFileSync("bun", ["run", bundleScript, outputDir], { stdio: "inherit" });
                return true;
              } catch (error) {
                throw new Error(
                  `Bun time layer bundling failed (Docker fallback is disabled): ${error}`,
                );
              }
            },
          },
        },
      }),
    });

    new ssm.StringParameter(this, "BunTimeLayerArn", {
      parameterName: BUN_TIME_LAYER_SSM_NAME,
      stringValue: this.layer.layerVersionArn,
      description: `Bun ${BUN_VERSION} custom Lambda runtime layer ARN`,
    });

    new cdk.CfnOutput(this, "LayerArn", {
      value: this.layer.layerVersionArn,
      description: "Bun custom runtime layer ARN (also stored in SSM)",
    });
  }
}
