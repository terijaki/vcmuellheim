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
	public readonly usersTable: dynamodb.Table;
	public readonly authVerificationsTable: dynamodb.Table;
	// Alias for CDK stack type compatibility (Record<`${Lowercase<TableEntity>}Table`, ...>)
	get auth_verificationsTable(): dynamodb.Table {
		return this.authVerificationsTable;
	}

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

		// GSI for querying all news and sorting by updatedAt (supports getAllNews)
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-NewsByType",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI for querying news by status and sorting by updatedAt (supports getPublishedNews)
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-NewsByStatus",
			partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
			sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// GSI for querying news by slug (supports getNewsBySlug)
		this.newsTable.addGlobalSecondaryIndex({
			indexName: "GSI-NewsBySlug",
			partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
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

		// GSI for listing teams by slug or name
		this.teamsTable.addGlobalSecondaryIndex({
			indexName: "GSI-TeamQueries",
			partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
			sortKeys: [
				{ name: "slug", type: dynamodb.AttributeType.STRING },
				{ name: "name", type: dynamodb.AttributeType.STRING },
				// NOTE: Adding 'sbvvTeamId' is not possible because the SK must be a non empty string. Thus would results that non SBVV teams would not be part of this index at all!
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

		// 9. CMS Users Table (admin users allowed to log in via better-auth)
		this.usersTable = new dynamodb.Table(this, "UsersTable", {
			...commonTableProps,
			tableName: `vcm-users-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		});

		// GSI for looking up users by email
		this.usersTable.addGlobalSecondaryIndex({
			indexName: "GSI-UsersByEmail",
			partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// 10. Auth Verifications Table (OTP codes with TTL)
		this.authVerificationsTable = new dynamodb.Table(this, "AuthVerificationsTable", {
			...commonTableProps,
			tableName: `vcm-auth-verifications-${environment}${branchSuffix}`,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			timeToLiveAttribute: "ttl", // Auto-delete expired OTP codes
		});

		// GSI for looking up verifications by identifier (email)
		this.authVerificationsTable.addGlobalSecondaryIndex({
			indexName: "GSI-VerificationsByIdentifier",
			partitionKey: { name: "identifier", type: dynamodb.AttributeType.STRING },
			projectionType: dynamodb.ProjectionType.ALL,
		});

		// Outputs for easy reference

		// TODO: DynamoDB Stream on REMOVE event
		// When sponsor expires (TTL deletion), trigger Lambda to delete logoId from Media table
		// Media table stream will then handle S3 object deletion
	}
}
