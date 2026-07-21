import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, it } from "vite-plus/test";
import { MonitoringStack } from "./monitoring-stack";
import { createTestApp } from "./test-helpers";

const testEnv = {
  account: "123456789012",
  region: "eu-central-1",
};

function createMonitoringWithWebapp(environment: string) {
  const app = createTestApp();
  const lambdaStack = new cdk.Stack(app, "LambdaStack", { env: testEnv });
  const webappLambda = new lambda.Function(lambdaStack, "WebappLambda", {
    functionName: `vcm-webapp-${environment}`,
    runtime: lambda.Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: lambda.Code.fromInline("exports.handler = async () => ({});"),
  });

  const stack = new MonitoringStack(app, "TestMonitoringStack", {
    env: testEnv,
    alertEmail: "alerts@example.com",
    stackProps: {
      environment,
      branch: "",
    },
    webappLambda,
  });

  return Template.fromStack(stack);
}

describe("MonitoringStack", () => {
  it("gates webapp duration average on sample count ≥ 20", () => {
    const template = createMonitoringWithWebapp("prod");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "vcm-webapp-duration-prod",
      Threshold: 3000,
      EvaluationPeriods: 2,
      TreatMissingData: "notBreaching",
      Metrics: Match.arrayWith([
        Match.objectLike({
          Id: Match.anyValue(),
          Expression: "IF(SAMPLE_COUNT(duration) >= 20, AVG(duration), 0)",
        }),
      ]),
    });
  });

  it("keeps the non-prod duration threshold at 5000 ms", () => {
    const template = createMonitoringWithWebapp("dev");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "vcm-webapp-duration-dev",
      Threshold: 5000,
      Metrics: Match.arrayWith([
        Match.objectLike({
          Expression: "IF(SAMPLE_COUNT(duration) >= 20, AVG(duration), 0)",
        }),
      ]),
    });
  });
});
