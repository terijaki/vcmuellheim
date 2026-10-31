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

    // Application code only queries GSI1. Prod still has GSI3–GSI6.
    // DynamoDB allows one GSI change per table update, so this prod deploy
    // removes GSI3-BySlug only. GSI4–GSI6 stay until later deploys.
    // This branch's preview table was created with those same leftover indexes.
    // Declaring them for every environment keeps that update from deleting
    // more than one index.
    this.contentTable.addGlobalSecondaryIndex({
      indexName: ContentTableIndexes.gsi1,
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const retainedIndexes = [
      { indexName: "GSI4-ByIdentifier", partitionKey: "gsi4pk", sortKey: "gsi4sk" },
      { indexName: "GSI5-ByPrivateEmail", partitionKey: "gsi5pk", sortKey: "gsi5sk" },
      { indexName: "GSI6-ByEventId", partitionKey: "gsi6pk", sortKey: "gsi6sk" },
    ] as const;
    for (const index of retainedIndexes) {
      this.contentTable.addGlobalSecondaryIndex({
        indexName: index.indexName,
        partitionKey: { name: index.partitionKey, type: dynamodb.AttributeType.STRING },
        sortKey: { name: index.sortKey, type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }
  }
}
