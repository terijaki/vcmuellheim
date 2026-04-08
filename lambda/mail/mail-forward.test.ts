/**
 * Tests for the mail-forward Lambda handler.
 *
 * Tests focus on externally observable behavior:
 *   - Unknown alias → silent drop
 *   - Known alias → forward to privateEmail
 *   - Multiple To addresses → all resolved and forwarded
 *   - Group aliases: expansion, zero-member drop, info@ union
 *   - MIME rewrite: From rewritten, Reply-To added
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

// ── Environment setup (must happen before module import) ─────────────────────
process.env.CONTENT_TABLE_NAME = "test-content-table";
process.env.FORWARD_FROM_EMAIL = "no-reply@vcmuellheim.de";
process.env.RECIPIENT_DOMAIN = "vcmuellheim.de";
process.env.AWS_REGION = "eu-central-1";
process.env.BRANCH_NAME = "";

// ── AWS SDK mocks ────────────────────────────────────────────────────────────
const s3Mock = mockClient(S3Client);
const sesMock = mockClient(SESClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

// ── ElectroDB mock via vi.hoisted + vi.mock ──────────────────────────────────
// createDb is called at module-level in mail-forward.ts; must be intercepted
// before the module is first imported.
const { mockByProxyEmailGo, mockByTypeWhereGo } = vi.hoisted(() => {
	return {
		mockByProxyEmailGo: vi.fn(),
		mockByTypeWhereGo: vi.fn(),
	};
});

vi.mock("@/lib/db/electrodb-client", () => ({
	createDb: vi.fn(() => ({
		member: {
			query: {
				byProxyEmail: () => ({ go: mockByProxyEmailGo }),
				byType: () => ({
					where: () => ({ go: mockByTypeWhereGo }),
				}),
			},
		},
	})),
}));

// ── Sentry mock (no-op in tests) ─────────────────────────────────────────────
vi.mock("../utils/sentry", () => ({
	Sentry: {
		init: vi.fn(),
		addBreadcrumb: vi.fn(),
		captureException: vi.fn(),
		captureMessage: vi.fn(),
	},
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeMime = (to: string, from = "sender@example.com") => [`From: ${from}`, `To: ${to}`, "Subject: Test", "MIME-Version: 1.0", "", "Hello world"].join("\n");

const makeEvent = (s3Key: string) => ({
	detail: {
		bucket: { name: "test-inbound-bucket" },
		object: { key: s3Key },
	},
});

const mockLambdaContext = {
	functionName: "mail-forward",
	functionVersion: "$LATEST",
	invokedFunctionArn: "arn:aws:lambda:eu-central-1:123:function:mail-forward",
	memoryLimitInMB: "256",
	awsRequestId: "test-request-id",
	logGroupName: "/aws/lambda/mail-forward",
	logStreamName: "2024/01/01/[$LATEST]test",
	getRemainingTimeInMillis: () => 30000,
	done: vi.fn(),
	fail: vi.fn(),
	succeed: vi.fn(),
	callbackWaitsForEmptyEventLoop: false,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("mail-forward Lambda", () => {
	let handler: typeof import("./mail-forward").handler;

	beforeEach(async () => {
		s3Mock.reset();
		sesMock.reset();
		ddbMock.reset();

		// Default: S3 returns a test MIME email addressed to an individual alias
		s3Mock.on(GetObjectCommand).resolves({
			Body: {
				transformToString: vi.fn().mockResolvedValue(makeMime("max.mustermann@vcmuellheim.de")),
			} as never,
		});

		// Default: SES send succeeds
		sesMock.on(SendRawEmailCommand).resolves({ MessageId: "test-message-id" });

		// Default: individual alias lookup returns nothing (unknown alias)
		mockByProxyEmailGo.mockResolvedValue({ data: [] });
		mockByTypeWhereGo.mockResolvedValue({ data: [] });

		const mod = await import("./mail-forward");
		handler = mod.handler;
	});

	describe("unknown alias", () => {
		test("silently drops when proxyEmail not found in DDB", async () => {
			mockByProxyEmailGo.mockResolvedValue({ data: [] });

			const result = await handler(makeEvent("emails/test-unknown.eml"), mockLambdaContext as never);

			expect(sesMock.commandCalls(SendRawEmailCommand)).toHaveLength(0);
			expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
		});

		test("silently drops when member exists but has no privateEmail", async () => {
			mockByProxyEmailGo.mockResolvedValue({
				data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: undefined }],
			});

			const result = await handler(makeEvent("emails/test-no-private.eml"), mockLambdaContext as never);

			expect(sesMock.commandCalls(SendRawEmailCommand)).toHaveLength(0);
			expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
		});
	});

	describe("individual alias forwarding", () => {
		test("forwards email to privateEmail when alias matches", async () => {
			mockByProxyEmailGo.mockResolvedValue({
				data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: "max@gmail.com" }],
			});

			const result = await handler(makeEvent("emails/test-match.eml"), mockLambdaContext as never);

			const sesCalls = sesMock.commandCalls(SendRawEmailCommand);
			expect(sesCalls).toHaveLength(1);
			expect(sesCalls[0].args[0].input.Destinations).toEqual(["max@gmail.com"]);
			expect(sesCalls[0].args[0].input.Source).toBe("no-reply@vcmuellheim.de");
			expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
		});

		test("rewrites From header to forward-from address in MIME", async () => {
			mockByProxyEmailGo.mockResolvedValue({
				data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: "max@gmail.com" }],
			});

			await handler(makeEvent("emails/rewrite-test.eml"), mockLambdaContext as never);

			const rawMime = Buffer.from(sesMock.commandCalls(SendRawEmailCommand)[0].args[0].input.RawMessage!.Data!).toString();
			expect(rawMime).toMatch(/^From: no-reply@vcmuellheim\.de/im);
		});

		test("in dev, looks up DDB with the full plus-address (suffix included)", async () => {
			// In dev the admin stores max.mueller+feat-x@vcmuellheim.de in DDB.
			// The inbound email also carries that full address in To:.
			// The Lambda must query DDB with the un-stripped address.
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("max.mustermann+feat-x@vcmuellheim.de")),
				} as never,
			});
			// DDB entry stores the full suffixed alias as written by the admin in dev
			mockByProxyEmailGo.mockResolvedValue({
				data: [{ id: "m1", proxyEmail: "max.mustermann+feat-x@vcmuellheim.de", privateEmail: "max@gmail.com" }],
			});

			const result = await handler(makeEvent("emails/test-dev-branch.eml"), mockLambdaContext as never);

			const sesCalls = sesMock.commandCalls(SendRawEmailCommand);
			expect(sesCalls).toHaveLength(1);
			expect(sesCalls[0].args[0].input.Destinations).toEqual(["max@gmail.com"]);
			expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
		});

		test("adds Reply-To with original sender in forwarded MIME", async () => {
			mockByProxyEmailGo.mockResolvedValue({
				data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: "max@gmail.com" }],
			});
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("max.mustermann@vcmuellheim.de", "original.sender@example.com")),
				} as never,
			});

			await handler(makeEvent("emails/reply-to-test.eml"), mockLambdaContext as never);

			const rawMime = Buffer.from(sesMock.commandCalls(SendRawEmailCommand)[0].args[0].input.RawMessage!.Data!).toString();
			expect(rawMime).toMatch(/Reply-To:.*original\.sender@example\.com/i);
		});
		test("forwards to all matching To addresses in a single email", async () => {
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("max.mustermann@vcmuellheim.de, erika.mustermann@vcmuellheim.de")),
				} as never,
			});
			mockByProxyEmailGo
				.mockResolvedValueOnce({ data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: "max@gmail.com" }] })
				.mockResolvedValueOnce({ data: [{ id: "m2", proxyEmail: "erika.mustermann@vcmuellheim.de", privateEmail: "erika@gmail.com" }] });

			const result = await handler(makeEvent("emails/multi-to.eml"), mockLambdaContext as never);

			const sesCalls = sesMock.commandCalls(SendRawEmailCommand);
			expect(sesCalls).toHaveLength(2);
			const destinations = sesCalls.map((c) => c.args[0].input.Destinations![0]);
			expect(destinations).toContain("max@gmail.com");
			expect(destinations).toContain("erika@gmail.com");
			expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
		});
	});

	describe("event parsing", () => {
		test("skips events that do not match S3 ObjectCreated shape", async () => {
			const result = await handler({ source: "aws.not-s3", detail: {} }, mockLambdaContext as never);

			expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
			expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("skipped") });
		});
	});

	describe("group alias routing", () => {
		test("drops trainer@ when no trainers have a privateEmail configured", async () => {
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
				} as never,
			});
			// byType returns trainers without a privateEmail
			mockByTypeWhereGo.mockResolvedValue({
				data: [{ id: "t1", isTrainer: true, privateEmail: undefined }],
			});

			const result = await handler(makeEvent("emails/trainer-empty.eml"), mockLambdaContext as never);

			expect(sesMock.commandCalls(SendRawEmailCommand)).toHaveLength(0);
			expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
		});

		// Note: BRANCH_NAME is captured as a module-level constant at cold start.
		// Branch-suffix stripping for group aliases (e.g. trainer+feat-x@ → trainer)
		// is covered by the stripBranchSuffix unit tests in member-alias.test.ts.

		test("forwards trainer@ to all trainers with a privateEmail", async () => {
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
				} as never,
			});
			mockByTypeWhereGo.mockResolvedValue({
				data: [
					{ id: "t1", isTrainer: true, privateEmail: "trainer1@gmail.com" },
					{ id: "t2", isTrainer: true, privateEmail: "trainer2@gmail.com" },
					{ id: "t3", isTrainer: true, privateEmail: undefined }, // excluded
				],
			});

			const result = await handler(makeEvent("emails/trainer-group.eml"), mockLambdaContext as never);

			const sesCalls = sesMock.commandCalls(SendRawEmailCommand);
			expect(sesCalls).toHaveLength(2);
			const destinations = sesCalls.map((c) => c.args[0].input.Destinations![0]);
			expect(destinations).toContain("trainer1@gmail.com");
			expect(destinations).toContain("trainer2@gmail.com");
			expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
		});

		test("info@ forwards to union of trainers and board members, deduplicated", async () => {
			s3Mock.on(GetObjectCommand).resolves({
				Body: {
					transformToString: vi.fn().mockResolvedValue(makeMime("info@vcmuellheim.de")),
				} as never,
			});
			// Two parallel queries (trainers, board) — a member in both is deduplicated via Set
			mockByTypeWhereGo.mockResolvedValueOnce({ data: [{ id: "t1", isTrainer: true, privateEmail: "trainer@gmail.com" }] }).mockResolvedValueOnce({
				data: [
					{ id: "b1", isBoardMember: true, privateEmail: "board@gmail.com" },
					{ id: "t1", isTrainer: true, isBoardMember: true, privateEmail: "trainer@gmail.com" }, // also a trainer — deduplicated
				],
			});

			const result = await handler(makeEvent("emails/info-group.eml"), mockLambdaContext as never);

			const sesCalls = sesMock.commandCalls(SendRawEmailCommand);
			expect(sesCalls).toHaveLength(2);
			const destinations = sesCalls.map((c) => c.args[0].input.Destinations![0]);
			expect(destinations).toContain("trainer@gmail.com");
			expect(destinations).toContain("board@gmail.com");
			expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
		});
	});
});
