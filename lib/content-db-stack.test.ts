import { describe, it } from "vite-plus/test";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ContentDbStack } from "./content-db-stack";
import { ContentTableIndexes } from "./db/electrodb-entities";
import { createTestApp } from "./test-helpers";

describe("ContentDbStack", () => {
	describe("Development environment", () => {
		it("should create a single content table", () => {
			const app = createTestApp();
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

			// Should have exactly 1 DynamoDB table (single-table design)
			template.resourceCountIs("AWS::DynamoDB::Table", 1);
		});

		it("should set DESTROY removal policy for dev", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-content-dev",
			});
		});

		it("should include branch suffix in table name", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-content-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		it("should set RETAIN removal policy for prod", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-content-prod",
			});
		});
	});

	describe("Table configuration", () => {
		it("should use PAY_PER_REQUEST billing", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				BillingMode: "PAY_PER_REQUEST",
			});
		});

		it("should enable DynamoDB stream", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
			});
		});

		it("should enable point-in-time recovery", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
			});
		});

		it("should enable TTL on the content table", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
			});
		});

		it("should use pk/sk composite primary key", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				KeySchema: [
					{ AttributeName: "pk", KeyType: "HASH" },
					{ AttributeName: "sk", KeyType: "RANGE" },
				],
			});
		});
	});

	describe("GSI configuration", () => {
		it("should create all four required GSIs", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				GlobalSecondaryIndexes: Match.arrayWith([
					Match.objectLike({ IndexName: ContentTableIndexes.gsi1 }),
					Match.objectLike({ IndexName: ContentTableIndexes.gsi2 }),
					Match.objectLike({ IndexName: ContentTableIndexes.gsi3 }),
					Match.objectLike({ IndexName: ContentTableIndexes.gsi4 }),
				]),
			});
		});

		it("should have correct key schema for GSI1 (type+date)", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				GlobalSecondaryIndexes: Match.arrayWith([
					Match.objectLike({
						IndexName: ContentTableIndexes.gsi1,
						KeySchema: [
							{ AttributeName: "gsi1pk", KeyType: "HASH" },
							{ AttributeName: "gsi1sk", KeyType: "RANGE" },
						],
					}),
				]),
			});
		});

		it("should have correct key schema for GSI4 (email/identifier)", () => {
			const app = createTestApp();
			const stack = new ContentDbStack(app, "TestStack", {
				stackProps: { environment: "dev", branch: "" },
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				GlobalSecondaryIndexes: Match.arrayWith([
					Match.objectLike({
						IndexName: ContentTableIndexes.gsi4,
						KeySchema: [
							{ AttributeName: "gsi4pk", KeyType: "HASH" },
							{ AttributeName: "gsi4sk", KeyType: "RANGE" },
						],
					}),
				]),
			});
		});
	});
});
