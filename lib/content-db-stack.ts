import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ContentTableIndexes } from "./db/table-indexes";
import { computeContentTableName } from "./db/env";

interface ContentDbStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
}

/**
 * Single-table DynamoDB stack for all content entities.
 */
export class ContentDbStack extends cdk.Stack {
  public readonly contentTable: dynamodb.Table;
  /** Stable plain-string table name — safe to pass cross-stack without creating CloudFormation exports. */
  public readonly contentTableName: string;
  /**
   * DynamoDB stream ARN token. Passing this into another stack creates a
   * CloudFormation export. Do not pass it for prod: a table update cannot
   * change that export while another stack imports it.
   */
  public readonly contentTableStreamArn: string;

  constructor(scope: Construct, id: string, props?: ContentDbStackProps) {
    super(scope, id, props);

    const environment = props?.stackProps?.environment || "dev";
    const branch = props?.stackProps?.branch || "";
    const isProd = environment === "prod";

    this.contentTableName = computeContentTableName(environment, branch);
    this.contentTable = new dynamodb.Table(this, "ContentTable", {
      tableName: this.contentTableName,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: "ttl",
    });

    this.contentTableStreamArn = this.contentTable.tableStreamArn!;

    // Application code only queries GSI1. Unused GSI2–GSI6 were removed from prod
    // in staged deploys; CDK now declares GSI1 only for every environment.
    this.contentTable.addGlobalSecondaryIndex({
      indexName: ContentTableIndexes.gsi1,
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
