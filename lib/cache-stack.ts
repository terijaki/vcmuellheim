import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { computeCacheTableName } from "./db/env";

interface CacheStackProps extends cdk.StackProps {
  stackProps?: {
    environment: string;
    branch: string;
  };
}

/**
 * Dedicated DynamoDB table for ephemeral cache entries.
 *
 * Stores serialized JSON payloads written by ddb-cache.ts.
 * Key scheme: PK `cache#<cacheKey>` / SK `cache` — no GSIs needed (GetItem/PutItem only).
 * DynamoDB TTL attribute `ttl` handles hygiene deletion of old entries.
 */
export class CacheStack extends cdk.Stack {
  /** Stable plain-string table name — safe to pass cross-stack without creating CloudFormation exports. */
  public readonly cacheTableName: string;

  constructor(scope: Construct, id: string, props?: CacheStackProps) {
    super(scope, id, props);

    const environment = props?.stackProps?.environment || "dev";
    const branch = props?.stackProps?.branch || "";

    this.cacheTableName = computeCacheTableName(environment, branch);

    new dynamodb.Table(this, "CacheTable", {
      tableName: this.cacheTableName,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });
  }
}
