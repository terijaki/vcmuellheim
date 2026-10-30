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
  /** DynamoDB stream ARN — a CFN token, but passed as a single scalar to avoid exporting the full table object. */
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

    // DynamoDB allows one GSI create or delete per table update.
    // This deploy removes GSI4-ByIdentifier only. GSI5 and GSI6 stay until later deploys.
    // Application code no longer reads or writes these indexes.
    this.contentTable.addGlobalSecondaryIndex({
      indexName: ContentTableIndexes.gsi1,
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.contentTable.addGlobalSecondaryIndex({
      indexName: "GSI5-ByPrivateEmail",
      partitionKey: { name: "gsi5pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi5sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.contentTable.addGlobalSecondaryIndex({
      indexName: "GSI6-ByEventId",
      partitionKey: { name: "gsi6pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi6sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
