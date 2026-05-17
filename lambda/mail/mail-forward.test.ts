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
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

// ── Environment setup (must happen before module import) ─────────────────────
process.env.CONTENT_TABLE_NAME = "test-content-table";
process.env.FORWARD_FROM_EMAIL = "postmaster@vcmuellheim.de";
process.env.RECIPIENT_DOMAIN = "vcmuellheim.de";
process.env.BRANCH_NAME = "";

// ── AWS SDK mocks ────────────────────────────────────────────────────────────
const s3Mock = mockClient(S3Client);
const sesMock = mockClient(SESv2Client);
const ddbMock = mockClient(DynamoDBDocumentClient);

function getForwardCalls() {
  return sesMock.commandCalls(SendEmailCommand).filter((call) => call.args[0].input.Content?.Raw);
}

function getNotificationCalls() {
  return sesMock
    .commandCalls(SendEmailCommand)
    .filter((call) => call.args[0].input.Content?.Simple);
}

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
    wrapHandler: vi.fn((fn) => fn),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeMime = (to: string, from = "sender@example.com") =>
  [`From: ${from}`, `To: ${to}`, "Subject: Test", "MIME-Version: 1.0", "", "Hello world"].join(
    "\n",
  );

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
  // Typed loosely because Sentry.wrapHandler wraps to the full 3-arg Lambda Handler
  // signature; tests only need to call it as async (event, context).
  let handler: (event: unknown, context: unknown) => Promise<unknown>;

  beforeEach(async () => {
    process.env.FORWARD_FROM_EMAIL = "postmaster@vcmuellheim.de";
    process.env.RECIPIENT_DOMAIN = "vcmuellheim.de";
    process.env.BRANCH_NAME = "";
    vi.resetModules();

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
    sesMock.on(SendEmailCommand).resolves({ MessageId: "test-message-id" });

    // Default: individual alias lookup returns nothing (unknown alias)
    mockByProxyEmailGo.mockResolvedValue({ data: [] });
    mockByTypeWhereGo.mockResolvedValue({ data: [] });

    const mod = await import("./mail-forward");
    handler = mod.handler as unknown as (event: unknown, context: unknown) => Promise<unknown>;
  });

  describe("unknown alias", () => {
    test("silently drops when proxyEmail not found in DDB", async () => {
      mockByProxyEmailGo.mockResolvedValue({ data: [] });

      const result = await handler(
        makeEvent("emails/test-unknown.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
    });

    test("silently drops when member exists but has no privateEmail", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [{ id: "m1", proxyEmail: "max.mustermann@vcmuellheim.de", privateEmail: undefined }],
      });

      const result = await handler(
        makeEvent("emails/test-no-private.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
    });
  });

  describe("individual alias forwarding", () => {
    test("forwards email to privateEmail when alias matches", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      const result = await handler(makeEvent("emails/test-match.eml"), mockLambdaContext as never);

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
      expect(sesCalls[0].args[0].input.FromEmailAddress).toBe("postmaster@vcmuellheim.de");
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("rewrites From header to forward-from address in MIME", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      await handler(makeEvent("emails/rewrite-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(
        /^From: "sender \(sender@example\.com\)" <postmaster@vcmuellheim\.de>$/im,
      );
    });

    test("removes original Return-Path before forwarding", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              [
                "Return-Path: <mail@example.com>",
                "From: mail@example.com",
                "To: max.mustermann@vcmuellheim.de",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/return-path-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).not.toMatch(/^Return-Path:/im);
      expect(rawMime).toMatch(
        /^From: "mail \(mail@example\.com\)" <postmaster@vcmuellheim\.de>$/im,
      );
    });

    test("in dev, looks up DDB with the full plus-address (suffix included)", async () => {
      // In dev the admin stores max.mueller+feat-x@vcmuellheim.de in DDB.
      // The inbound email also carries that full address in To:.
      // The Lambda must query DDB with the un-stripped address.
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(makeMime("max.mustermann+feat-x@vcmuellheim.de")),
        } as never,
      });
      // DDB entry stores the full suffixed alias as written by the admin in dev
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann+feat-x@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      const result = await handler(
        makeEvent("emails/test-dev-branch.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("in dev, matches new.vcmuellheim.de and keeps the branch suffix for member lookup", async () => {
      vi.resetModules();
      process.env.FORWARD_FROM_EMAIL = "postmaster@new.vcmuellheim.de";
      process.env.RECIPIENT_DOMAIN = "new.vcmuellheim.de";
      process.env.BRANCH_NAME = "feat-x";

      s3Mock.reset();
      sesMock.reset();
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(makeMime("max.mustermann+feat-x@new.vcmuellheim.de")),
        } as never,
      });
      sesMock.on(SendEmailCommand).resolves({ MessageId: "test-message-id" });
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann+feat-x@new.vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      const { handler: devHandler } = await import("./mail-forward");
      const result = await (devHandler as unknown as (e: unknown, c: unknown) => Promise<unknown>)(
        makeEvent("emails/test-dev-domain.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.FromEmailAddress).toBe("postmaster@new.vcmuellheim.de");
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("adds Reply-To with original sender in forwarded MIME", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              makeMime("max.mustermann@vcmuellheim.de", "original.sender@example.com"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/reply-to-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(
        /^From: "original\.sender \(original\.sender@example\.com\)" <postmaster@vcmuellheim\.de>$/im,
      );
      expect(rawMime).toMatch(/Reply-To:.*original\.sender@example\.com/i);
    });

    test("includes original name and email in From display name", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              makeMime(
                "max.mustermann@vcmuellheim.de",
                '"Max Mustermann" <max.mustermann@example.com>',
              ),
            ),
        } as never,
      });

      await handler(makeEvent("emails/from-display-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(
        /^From: "Max Mustermann \(max\.mustermann@example\.com\)" <postmaster@vcmuellheim\.de>$/im,
      );
      expect(rawMime).toMatch(/Reply-To:.*"Max Mustermann" <max\.mustermann@example\.com>/i);
    });
    test("forwards to all matching To addresses in a single email", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              makeMime("max.mustermann@vcmuellheim.de, erika.mustermann@vcmuellheim.de"),
            ),
        } as never,
      });
      mockByProxyEmailGo
        .mockResolvedValueOnce({
          data: [
            {
              id: "m1",
              proxyEmail: "max.mustermann@vcmuellheim.de",
              privateEmail: "max@example.com",
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: "m2",
              proxyEmail: "erika.mustermann@vcmuellheim.de",
              privateEmail: "erika@example.com",
            },
          ],
        });

      const result = await handler(makeEvent("emails/multi-to.eml"), mockLambdaContext as never);

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(2);
      const destinations = sesCalls.map((c) => c.args[0].input.Destination!.ToAddresses![0]);
      expect(destinations).toContain("max@example.com");
      expect(destinations).toContain("erika@example.com");
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
    });

    test("deduplicates duplicate aliases from To header and forwards only once", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              makeMime("max.mustermann@vcmuellheim.de, max.mustermann@vcmuellheim.de"),
            ),
        } as never,
      });
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      const result = await handler(
        makeEvent("emails/multi-to-dedupe.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("prefers X-Original-To over To list to avoid duplicate forwarding", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue(
              [
                "From: sender@example.com",
                "To: max.mustermann@vcmuellheim.de, erika.mustermann@vcmuellheim.de, john.doe@vcmuellheim.de",
                "X-Original-To: erika.mustermann@vcmuellheim.de",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });
      mockByProxyEmailGo.mockResolvedValueOnce({
        data: [
          {
            id: "m2",
            proxyEmail: "erika.mustermann@vcmuellheim.de",
            privateEmail: "erika@example.com",
          },
        ],
      });

      const result = await handler(
        makeEvent("emails/multi-to-original-to.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["erika@example.com"]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });
  });

  describe("event parsing", () => {
    test("skips events that do not match S3 ObjectCreated shape", async () => {
      const result = await handler(
        { source: "aws.not-s3", detail: {} },
        mockLambdaContext as never,
      );

      expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("skipped") });
    });
  });

  describe("oversized message handling", () => {
    test("allows forwarding of messages above the old SES v1 10 MB limit", async () => {
      const largerThanV1LimitMime = [
        "From: sender@example.com",
        "To: max.mustermann@vcmuellheim.de",
        "Subject: Large attachment",
        "",
        "A",
      ].join("\n");

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(largerThanV1LimitMime),
        } as never,
      });
      const byteLengthSpy = vi.spyOn(Buffer, "byteLength").mockReturnValue(11 * 1024 * 1024);
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      const result = await handler(
        makeEvent("emails/larger-than-v1-limit.eml"),
        mockLambdaContext as never,
      );

      expect(getNotificationCalls()).toHaveLength(0);
      expect(getForwardCalls()).toHaveLength(1);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
      byteLengthSpy.mockRestore();
    });

    test("notifies sender and drops when raw MIME exceeds SES v2 forwarding limit", async () => {
      const oversizedMime = [
        "From: sender@example.com",
        "To: max.mustermann@vcmuellheim.de",
        "Subject: Huge attachment",
        "",
        "A",
      ].join("\n");

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(oversizedMime),
        } as never,
      });
      const byteLengthSpy = vi.spyOn(Buffer, "byteLength").mockReturnValue(41 * 1024 * 1024);

      const result = await handler(makeEvent("emails/oversized.eml"), mockLambdaContext as never);

      const notifyCalls = getNotificationCalls();
      expect(notifyCalls).toHaveLength(1);
      expect(notifyCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["sender@example.com"]);

      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: "dropped: message too large" });
      byteLengthSpy.mockRestore();
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

      const result = await handler(
        makeEvent("emails/trainer-empty.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(0);
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
          { id: "t1", isTrainer: true, privateEmail: "trainer1@example.com" },
          { id: "t2", isTrainer: true, privateEmail: "trainer2@example.com" },
          { id: "t3", isTrainer: true, privateEmail: undefined }, // excluded
        ],
      });

      const result = await handler(
        makeEvent("emails/trainer-group.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(2);
      const destinations = sesCalls.map((c) => c.args[0].input.Destination!.ToAddresses![0]);
      expect(destinations).toContain("trainer1@example.com");
      expect(destinations).toContain("trainer2@example.com");
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
    });

    test("info@ forwards to union of trainers and board members, deduplicated", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("info@vcmuellheim.de")),
        } as never,
      });
      // Two parallel queries (trainers, board) — a member in both is deduplicated via Set
      mockByTypeWhereGo
        .mockResolvedValueOnce({
          data: [{ id: "t1", isTrainer: true, privateEmail: "trainer@example.com" }],
        })
        .mockResolvedValueOnce({
          data: [
            { id: "b1", isBoardMember: true, privateEmail: "board@example.com" },
            { id: "t1", isTrainer: true, isBoardMember: true, privateEmail: "trainer@example.com" }, // also a trainer — deduplicated
          ],
        });

      const result = await handler(makeEvent("emails/info-group.eml"), mockLambdaContext as never);

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(2);
      const destinations = sesCalls.map((c) => c.args[0].input.Destination!.ToAddresses![0]);
      expect(destinations).toContain("trainer@example.com");
      expect(destinations).toContain("board@example.com");
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
    });
  });
});
