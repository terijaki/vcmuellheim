import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { buildLambdaFunctionName, buildLambdaLogGroupName } from "@utils/lambda-names";

export interface VcmNodejsFunctionProps extends Omit<
  NodejsFunctionProps,
  "runtime" | "handler" | "logGroup"
> {
  namespace: string;
  name: string;
}

/** Shared NodejsFunction defaults with managed CloudWatch log group. */
export class VcmNodejsFunction extends cdk.Resource {
  public readonly lambdaFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: VcmNodejsFunctionProps) {
    super(scope, id);

    const { bundling, namespace, name, ...restProps } = props;

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: buildLambdaLogGroupName(namespace, name ?? id),
      retention: logs.RetentionDays.TWO_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.lambdaFunction = new NodejsFunction(this, "Function", {
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      functionName: buildLambdaFunctionName(name),
      handler: "handler",
      ...restProps,
      runtime: lambda.Runtime.NODEJS_24_X,
      bundling: {
        minify: true,
        sourceMap: true,
        ...bundling,
      },
      logGroup,
    });
  }
}
