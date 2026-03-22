import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ContentTableIndexes } from "./db/electrodb-entities";

interface ContentDbStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
}

/**
 * Single-table DynamoDB stack for all content entities.
 *
 * Replaces the previous 10-table design.  ElectroDB entities (lib/db/electrodb-entities.ts)
 * describe each entity's key structure within this shared table.
 */
export class ContentDbStack extends cdk.Stack {
	public readonly contentTable: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: ContentDbStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";

		// Single content table — all entities share this table using composite PK/SK
		this.contentTable = new dynamodb.Table(this, "ContentTable", {
			tableName: `vcm-content-${environment}${branchSuffix}`,
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

		// GSI1 — type-based list queries sorted by a date/slug field
		// Used by: news (by type+updatedAt), events (by type+startDate), teams (by type+slug)
		this.contentTable.addGlobalSecondaryIndex({
			indexName: ContentTableIndexes.gsi1,
			partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI2 — status-based queries sorted by creation date
		// Used by: news (published/draft/archived + createdAt)
		this.contentTable.addGlobalSecondaryIndex({
			indexName: ContentTableIndexes.gsi2,
			partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI3 — slug lookups
		// Used by: news (by slug), teams (by slug)
		this.contentTable.addGlobalSecondaryIndex({
			indexName: ContentTableIndexes.gsi3,
			partitionKey: { name: "gsi3pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi3sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI4 — email / identifier lookups
		// Used by: users (by email), auth verifications (by identifier)
		// The SK (gsi4sk) is populated by ElectroDB with a constant entity-type prefix,
		// enabling safe co-existence of user and verification items under the same GSI partition.
		this.contentTable.addGlobalSecondaryIndex({
			indexName: ContentTableIndexes.gsi4,
			partitionKey: { name: "gsi4pk", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "gsi4sk", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});
	}
}
