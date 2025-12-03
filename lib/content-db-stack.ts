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
	public readonly locationsTable: dynamodb.Table;
	public readonly busTable: dynamodb.Table;

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

		// GSI for querying by type, status, updatedAt or slug
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-NewsQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [
				{ name: "status", type: dynamodb.AttributeType.STRING },
				{ name: "updatedAt", type: dynamodb.AttributeType.STRING },
				{ name: "slug", type: dynamodb.AttributeType.STRING },
			],
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 2. Events Table
		this.eventsTable = new dynamodb.Table(this, "EventsTable", {
			...commonTableProps,
			tableName: `vcm-events-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			// No sort key - use GSI for queries
			timeToLiveAttribute: "ttl", // TTL attribute for auto-delete
		});

		// GSI for querying by status and startDate
		this.eventsTable.addGlobalSecondaryIndex({
			indexName: "GSI-EventQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [{ name: "startDate", type: dynamodb.AttributeType.STRING }],
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 3. Teams Table
		this.teamsTable = new dynamodb.Table(this, "TeamsTable", {
			...commonTableProps,
			tableName: `vcm-teams-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			// No sort key - use GSIs for queries
		});

		// GSI for listing teams by slug, name or sbvvTeamId
		this.teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-TeamQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [
				{ name: "slug", type: dynamodb.AttributeType.STRING },
				{ name: "name", type: dynamodb.AttributeType.STRING },
				{ name: "sbvvTeamId", type: dynamodb.AttributeType.STRING },
			],
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

		// 6. Sponsors Table
		this.sponsorsTable = new dynamodb.Table(this, "SponsorsTable", {
			...commonTableProps,
			tableName: `vcm-sponsors-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			timeToLiveAttribute: "expiryTimestamp", // Auto-delete expired sponsors
		});
		// TTL handles cleanup automatically

		// 7. Locations Table
		this.locationsTable = new dynamodb.Table(this, "LocationsTable", {
			...commonTableProps,
			tableName: `vcm-locations-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		});

		// 8. Bus Bookings Table
		this.busTable = new dynamodb.Table(this, "BusBookingsTable", {
			...commonTableProps,
			tableName: `vcm-bus-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			timeToLiveAttribute: "ttl", // TTL attribute for auto-delete
		});

		// Outputs for easy reference

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

		new cdk.CfnOutput(this, "LocationsTableName", {
			value: this.locationsTable.tableName,
			description: "Locations table name",
		});

		new cdk.CfnOutput(this, "BusTableName", {
			value: this.busTable.tableName,
			description: "Bus bookings table name",
		});
	}
}
