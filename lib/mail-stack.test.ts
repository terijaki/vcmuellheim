import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vite-plus/test";
import { MailStack } from "./mail-stack";
import { createTestApp } from "./test-helpers";

const testEnv = {
  account: "123456789012",
  region: "eu-central-1",
};

function getPolicyStatements(template: Template): Array<Record<string, unknown>> {
  const policies = template.findResources("AWS::IAM::Policy");

  return Object.values(policies).flatMap((policy) => {
    const statement = (policy as { Properties?: { PolicyDocument?: { Statement?: unknown } } })
      .Properties?.PolicyDocument?.Statement;

    if (!statement) {
      return [];
    }

    if (Array.isArray(statement)) {
      return statement.filter((entry): entry is Record<string, unknown> => {
        return typeof entry === "object" && entry !== null;
      });
    }

    if (typeof statement === "object" && statement !== null) {
      return [statement as Record<string, unknown>];
    }

    return [];
  });
}

function findSesForwardStatement(template: Template): Record<string, unknown> | undefined {
  const statements = getPolicyStatements(template);

  return statements.find((statement) => {
    const action = statement.Action;
    const actions = Array.isArray(action) ? action : [action];
    return actions.includes("ses:SendEmail") && actions.includes("ses:SendRawEmail");
  });
}

describe("MailStack", () => {
  it("grants mail-forward Lambda both SES send permissions", () => {
    const app = createTestApp();
    const stack = new MailStack(app, "TestMailStack", {
      env: testEnv,
      stackProps: {
        environment: "dev",
        branch: "feature-x",
      },
      contentTableName: "vcm-content-dev-feature-x",
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["ses:SendEmail", "ses:SendRawEmail"]),
          }),
        ]),
      },
    });
  });

  it("targets the dev SES identity in development", () => {
    const app = createTestApp();
    const stack = new MailStack(app, "TestMailStackDevIdentity", {
      env: testEnv,
      stackProps: {
        environment: "dev",
        branch: "feature-x",
      },
      contentTableName: "vcm-content-dev-feature-x",
    });

    const template = Template.fromStack(stack);
    const sesForwardStatement = findSesForwardStatement(template);

    expect(sesForwardStatement).toBeDefined();
    expect(JSON.stringify(sesForwardStatement?.Resource)).toContain("identity/new.vcmuellheim.de");
  });

  it("targets the prod SES identity in production", () => {
    const app = createTestApp();
    const stack = new MailStack(app, "TestMailStackProdIdentity", {
      env: testEnv,
      stackProps: {
        environment: "prod",
        branch: "",
      },
      contentTableName: "vcm-content-prod",
    });

    const template = Template.fromStack(stack);
    const sesForwardStatement = findSesForwardStatement(template);
    const serializedResource = JSON.stringify(sesForwardStatement?.Resource);

    expect(sesForwardStatement).toBeDefined();
    expect(serializedResource).toContain("identity/vcmuellheim.de");
    expect(serializedResource).not.toContain("identity/new.vcmuellheim.de");
  });
});
