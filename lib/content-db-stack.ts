import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

interface ContentDbStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
}

export class ContentDbStack extends cdk.Stack {
	public readonly newsTable: dynamodb.Table;
	public readonly eventsTable: dynamodb.Table;
	public readonly teamsTable: dynamodb.Table;
	public readonly membersTable: dynamodb.Table;
	public readonly mediaTable: dynamodb.Table;
	public readonly sponsorsTable: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: ContentDbStackProps) {
		super(scope, id, props);

		const environment = props?.stackProps?.environment || "dev";
		const branch = props?.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";

		// Common table configuration
		const commonTableProps: Partial<dynamodb.TableProps> = {
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: true, // Enable PITR for backups
			},
			removalPolicy: environment === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For future event-driven workflows
		};

		// 1. News Table
		this.newsTable = new dynamodb.Table(this, "NewsTable", {
			...commonTableProps,
			tableName: `vcm-news-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			// No sort key - use GSIs for queries
		});

		// GSI for querying by status and publishedDate
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-PublishedDate",
			partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "publishedDate", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI for querying by slug
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-Slug",
			partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 2. Events Table
		this.eventsTable = new dynamodb.Table(this, "EventsTable", {
			...commonTableProps,
			tableName: `vcm-events-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			// No sort key - use GSI for queries
		});

		// GSI for querying by status and startDate
		this.eventsTable.addGlobalSecondaryIndex({
			indexName: "GSI-StartDate",
			partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "startDate", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 3. Teams Table
		this.teamsTable = new dynamodb.Table(this, "TeamsTable", {
			...commonTableProps,
			tableName: `vcm-teams-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			// No sort key - use GSIs for queries
		});

		// GSI for querying by slug
		this.teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-Slug",
			partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI for listing teams by status
		this.teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-Status",
			partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "name", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI for mapping to SAMS teams
		this.teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-SamsTeam",
			partitionKey: { name: "sbvvTeamId", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 4. Members Table
		this.membersTable = new dynamodb.Table(this, "MembersTable", {
			...commonTableProps,
			tableName: `vcm-members-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		});

		// 5. Media Table
		this.mediaTable = new dynamodb.Table(this, "MediaTable", {
			...commonTableProps,
			tableName: `vcm-media-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		});

		// TODO: Add DynamoDB Stream + Lambda for S3 cleanup
		// When media item is deleted, Lambda should delete corresponding S3 object
		// This handles orphaned files when sponsors expire (TTL), news/events are deleted, etc.

		// 6. Sponsors Table
		this.sponsorsTable = new dynamodb.Table(this, "SponsorsTable", {
			...commonTableProps,
			tableName: `vcm-sponsors-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			timeToLiveAttribute: "expiryTimestamp", // Auto-delete expired sponsors
		});
		// TTL handles cleanup automatically

		// TODO: DynamoDB Stream on REMOVE event
		// When sponsor expires (TTL deletion), trigger Lambda to delete logoId from Media table
		// Media table stream will then handle S3 object deletion

		// Outputs for easy reference
		new cdk.CfnOutput(this, "NewsTableName", {
			value: this.newsTable.tableName,
			description: "News table name",
		});

		new cdk.CfnOutput(this, "EventsTableName", {
			value: this.eventsTable.tableName,
			description: "Events table name",
		});

		new cdk.CfnOutput(this, "TeamsTableName", {
			value: this.teamsTable.tableName,
			description: "Teams table name",
		});

		new cdk.CfnOutput(this, "MembersTableName", {
			value: this.membersTable.tableName,
			description: "Members table name",
		});

		new cdk.CfnOutput(this, "MediaTableName", {
			value: this.mediaTable.tableName,
			description: "Media table name",
		});

		new cdk.CfnOutput(this, "SponsorsTableName", {
			value: this.sponsorsTable.tableName,
			description: "Sponsors table name",
		});
	}
}
