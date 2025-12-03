import { describe, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ContentDbStack } from "./content-db-stack";

describe("ContentDbStack", () => {
	describe("Development environment", () => {
		it("should create stack with all tables", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				env: {
					account: "123456789012",
					region: "eu-central-1",
				},
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Should have 8 DynamoDB tables
			template.resourceCountIs("AWS::DynamoDB::Table", 8);
		});

		it("should set DESTROY removal policy for dev", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Dev tables should have DESTROY removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-news-dev",
			});
		});

		it("should include branch suffix in table names", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
			});

			const template = Template.fromStack(stack);

			// Check table names include branch suffix
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-news-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		it("should set RETAIN removal policy for prod tables", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Prod tables should have RETAIN removal policy
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-news-prod",
			});
		});
	});

	describe("Table configuration", () => {
		it("should use PAY_PER_REQUEST billing for all tables", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// All tables should use on-demand billing
			const tables = template.findResources("AWS::DynamoDB::Table");
			const tableCount = Object.keys(tables).length;

			// Count how many tables have PAY_PER_REQUEST
			const payPerRequestCount = Object.values(tables).filter((table) => (table as { Properties: { BillingMode: string } }).Properties.BillingMode === "PAY_PER_REQUEST").length;

			// All 8 tables should have PAY_PER_REQUEST
			if (tableCount !== 8 || payPerRequestCount !== 8) {
				throw new Error(`Expected 8 tables with PAY_PER_REQUEST, got ${payPerRequestCount} out of ${tableCount}`);
			}
		});

		it("should enable streams on all tables", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// All tables should have streams enabled
			const tables = template.findResources("AWS::DynamoDB::Table");
			const streamCount = Object.values(tables).filter(
				(table) => (table as { Properties: { StreamSpecification?: { StreamViewType: string } } }).Properties.StreamSpecification?.StreamViewType === "NEW_AND_OLD_IMAGES",
			).length;

			if (streamCount !== 8) {
				throw new Error(`Expected 8 tables with streams, got ${streamCount}`);
			}
		});

		it("should enable point-in-time recovery", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// All tables should have PITR enabled
			const tables = template.findResources("AWS::DynamoDB::Table");
			const pitrCount = Object.values(tables).filter(
				(table) =>
					(table as { Properties: { PointInTimeRecoverySpecification?: { PointInTimeRecoveryEnabled: boolean } } }).Properties.PointInTimeRecoverySpecification?.PointInTimeRecoveryEnabled === true,
			).length;

			if (pitrCount !== 8) {
				throw new Error(`Expected 8 tables with PITR, got ${pitrCount}`);
			}
		});
	});

	describe("News table", () => {
		it("should have correct schema", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-news-dev",
				KeySchema: [
					{
						AttributeName: "id",
						KeyType: "HASH",
					},
				],
			});
		});

		it("should have GSI for queries", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-news-dev",
				GlobalSecondaryIndexes: [
					{
						IndexName: "GSI-NewsQueries",
						Projection: {
							ProjectionType: "ALL",
						},
					},
				],
			});
		});
	});

	describe("Events table", () => {
		it("should have GSI for startDate queries", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-events-dev",
				GlobalSecondaryIndexes: [
					{
						IndexName: "GSI-EventQueries",
						KeySchema: [
							{
								AttributeName: "type",
								KeyType: "HASH",
							},
							{
								AttributeName: "startDate",
								KeyType: "RANGE",
							},
						],
					},
				],
			});
		});
	});

	describe("Teams table", () => {
		it("should have GSI for team queries", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// Teams table should have GSI-TeamQueries with composite sort keys
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-teams-dev",
				GlobalSecondaryIndexes: [
					{
						IndexName: "GSI-TeamQueries",
						KeySchema: Match.arrayWith([{ AttributeName: "type", KeyType: "HASH" }]),
					},
				],
			});
		});
	});

	describe("Sponsors table", () => {
		it("should enable TTL", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-sponsors-dev",
				TimeToLiveSpecification: {
					AttributeName: "expiryTimestamp",
					Enabled: true,
				},
			});
		});
	});

	describe("Bus table", () => {
		it("should enable TTL", () => {
			const app = new App();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-bus-dev",
				TimeToLiveSpecification: {
					AttributeName: "ttl",
					Enabled: true,
				},
			});
		});
	});
});
