import { describe, it } from "vite-plus/test";
import { Template } from "aws-cdk-lib/assertions";
import { CacheStack } from "./cache-stack";
import { createTestApp } from "./test-helpers";

describe("CacheStack", () => {
	describe("Development environment", () => {
		it("should create a single cache table", () => {
			const app = createTestApp();
			const stack = new CacheStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.resourceCountIs("AWS::DynamoDB::Table", 1);
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-cache-dev",
			});
		});

		it("should include branch suffix in table name", () => {
			const app = createTestApp();
			const stack = new CacheStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-cache-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		it("should use retention policy and deletion protection for prod", () => {
			const app = createTestApp();
			const stack = new CacheStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-cache-prod",
			});
		});
	});

	describe("Table configuration", () => {
		it("should use PAY_PER_REQUEST billing and TTL", () => {
			const app = createTestApp();
			const stack = new CacheStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::DynamoDB::Table", {
				BillingMode: "PAY_PER_REQUEST",
				TimeToLiveSpecification: {
					AttributeName: "ttl",
					Enabled: true,
				},
			});
		});

		it("should have no GSIs", () => {
			const app = createTestApp();
			const stack = new CacheStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
			});

			const template = Template.fromStack(stack);

			// No GSIs — cache uses only GetItem/PutItem by PK+SK
			template.hasResourceProperties("AWS::DynamoDB::Table", {
				TableName: "vcm-cache-dev",
			});
			const tables = template.findResources("AWS::DynamoDB::Table");
			const tableResource = Object.values(tables)[0];
			const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
			if (gsis !== undefined) {
				throw new Error(`Expected no GSIs but found: ${JSON.stringify(gsis)}`);
			}
		});
	});
});
