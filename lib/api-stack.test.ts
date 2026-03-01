import { describe, it } from "bun:test";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as route53 from "aws-cdk-lib/aws-route53";
import { ApiStack } from "./api-stack";
import { createTestApp } from "./test-helpers";

// Helper to create mock DynamoDB tables in the same stack
function createMockTables(stack: Stack, env: string) {
	const streamConfig = { stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES };

	const newsTable = new dynamodb.Table(stack, "MockNewsTable", {
		tableName: `vcm-news-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const eventsTable = new dynamodb.Table(stack, "MockEventsTable", {
		tableName: `vcm-events-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const teamsTable = new dynamodb.Table(stack, "MockTeamsTable", {
		tableName: `vcm-teams-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const membersTable = new dynamodb.Table(stack, "MockMembersTable", {
		tableName: `vcm-members-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const mediaTable = new dynamodb.Table(stack, "MockMediaTable", {
		tableName: `vcm-media-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const sponsorsTable = new dynamodb.Table(stack, "MockSponsorsTable", {
		tableName: `vcm-sponsors-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const locationsTable = new dynamodb.Table(stack, "MockLocationsTable", {
		tableName: `vcm-locations-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const busTable = new dynamodb.Table(stack, "MockBusTable", {
		tableName: `vcm-bus-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
		...streamConfig,
	});

	const usersTable = new dynamodb.Table(stack, "MockUsersTable", {
		tableName: `vcm-users-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
	});

	const authVerificationsTable = new dynamodb.Table(stack, "MockAuthVerificationsTable", {
		tableName: `vcm-auth-verifications-${env}`,
		partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
	});

	return {
		newsTable,
		eventsTable,
		teamsTable,
		membersTable,
		mediaTable,
		sponsorsTable,
		locationsTable,
		busTable,
		usersTable,
		auth_verificationsTable: authVerificationsTable,
	};
}

// Helper to create mock DNS resources
function createMockDnsResources(stack: Stack) {
	const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, "MockHostedZone", {
		hostedZoneId: "Z1234567890ABC",
		zoneName: "new.vcmuellheim.de",
	});

	const regionalCertificate = acm.Certificate.fromCertificateArn(stack, "MockRegionalCertificate", "arn:aws:acm:eu-central-1:123456789012:certificate/test-cert-id");

	return { hostedZone, regionalCertificate };
}

describe("ApiStack", () => {
	describe("Development environment", () => {
		it("should create stack with correct resources", () => {
			const app = createTestApp();
			const stack = new Stack(app, "TestStack", {
				env: {
					account: "123456789012",
					region: "eu-central-1",
				},
			});

			const mockTables = createMockTables(stack, "dev");
			const mockDns = createMockDnsResources(stack);

			const apiStack = new ApiStack(app, "ApiTestStack", {
				env: {
					account: "123456789012",
					region: "eu-central-1",
				},
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(apiStack);

			// Should NOT have Cognito resources
			template.resourceCountIs("AWS::Cognito::UserPool", 0);

			// Should have 4 Lambda functions (tRPC API + ICS calendar + Sitemap + S3 Cleanup)
			template.resourceCountIs("AWS::Lambda::Function", 4);

			// Should have HTTP API
			template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);

			// Should have API routes
			template.resourceCountIs("AWS::ApiGatewayV2::Route", 6); // 2 for /api/{proxy+}, 1 for /ics/{teamSlug}, 1 for /sitemap.xml, 2 for /{proxy+}
		});

		it("should include branch suffix in resource names", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev-feature-xyz");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "feature-xyz",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			// Check Lambda function name includes branch suffix
			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-trpc-api-dev-feature-xyz",
			});
		});
	});

	describe("Production environment", () => {
		it("should configure Lambda for prod", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "prod");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "prod",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-trpc-api-prod",
			});
		});
	});

	describe("Lambda function", () => {
		it("should configure correct timeout and memory", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::Lambda::Function", {
				FunctionName: "vcm-trpc-api-dev",
				Timeout: 30,
				MemorySize: 512,
			});
		});

		it("should set environment variables for DynamoDB tables", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			// Check that environment variables exist (table names are references)
			const lambdas = template.findResources("AWS::Lambda::Function");
			const trpcLambda = Object.values(lambdas).find((lambda) => (lambda as { Properties?: { FunctionName?: string } }).Properties?.FunctionName === "vcm-trpc-api-dev") as {
				Properties: { Environment: { Variables: Record<string, unknown> } };
			};

			const env = trpcLambda.Properties.Environment.Variables;

			// Verify all required environment variables are present
			if (
				!env.NEWS_TABLE_NAME ||
				!env.EVENTS_TABLE_NAME ||
				!env.TEAMS_TABLE_NAME ||
				!env.MEMBERS_TABLE_NAME ||
				!env.MEDIA_TABLE_NAME ||
				!env.SPONSORS_TABLE_NAME ||
				!env.LOCATIONS_TABLE_NAME ||
				!env.BUS_TABLE_NAME ||
				!env.USERS_TABLE_NAME ||
				!env.AUTH_VERIFICATIONS_TABLE_NAME
			) {
				throw new Error("Missing required table environment variables");
			}

			if (env.CDK_ENVIRONMENT !== "dev") {
				throw new Error(`Expected CDK_ENVIRONMENT to be dev, got ${env.CDK_ENVIRONMENT}`);
			}
		});

		it("should have BETTER_AUTH_SECRET environment variable", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev");
			const mockDns = createMockDnsResources(mockStack);

			// Provide BETTER_AUTH_SECRET env var (required by ApiStack)
			process.env.BETTER_AUTH_SECRET = "test-secret";

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			const lambdas = template.findResources("AWS::Lambda::Function");
			const trpcLambda = Object.values(lambdas).find((lambda) => (lambda as { Properties?: { FunctionName?: string } }).Properties?.FunctionName === "vcm-trpc-api-dev") as {
				Properties: { Environment: { Variables: Record<string, unknown> } };
			};

			const env = trpcLambda.Properties.Environment.Variables;
			if (!env.BETTER_AUTH_SECRET) {
				throw new Error("Missing BETTER_AUTH_SECRET environment variable");
			}
		});
	});

	describe("HTTP API Gateway", () => {
		it("should configure CORS for dev", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
				Name: "vcm-trpc-api-dev",
				CorsConfiguration: {
					AllowOrigins: Match.arrayWith(["https://vcmuellheim.de"]),
					AllowMethods: ["GET", "POST", "OPTIONS"],
					AllowCredentials: true,
				},
			});
		});

		it("should create routes for tRPC", () => {
			const app = createTestApp();
			const mockStack = new Stack(app, "MockStack");
			const mockTables = createMockTables(mockStack, "dev");
			const mockDns = createMockDnsResources(mockStack);

			const stack = new ApiStack(app, "TestStack", {
				stackProps: {
					environment: "dev",
					branch: "",
				},
				contentDbStack: mockTables,
				...mockDns,
			});

			const template = Template.fromStack(stack);

			// Should have routes for GET and POST
			template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
				RouteKey: "GET /api/{proxy+}",
			});

			template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
				RouteKey: "POST /api/{proxy+}",
			});
		});
	});
});

// Helper to create mock DynamoDB tables in the same stack
