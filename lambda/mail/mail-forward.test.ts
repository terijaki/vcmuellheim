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
import { Sentry } from "../utils/sentry";

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
    vi.mocked(Sentry.captureException).mockClear();
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
      expect(rawMime).toMatch(/^From: postmaster@vcmuellheim\.de$/im);
    });

    test("removes DKIM-Signature headers before forwarding", async () => {
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
                "DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=selector1; h=from:to:subject; b=abc123",
                "DKIM-Signature: v=1; a=rsa-sha256; d=gmx.net; s=selector2; h=from:to:subject; b=def456",
                "From: sender@example.com",
                "To: max.mustermann@vcmuellheim.de",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/dkim-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).not.toMatch(/^DKIM-Signature:/im);
      expect(getForwardCalls()).toHaveLength(1);
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
      expect(rawMime).toMatch(/^From: postmaster@vcmuellheim\.de$/im);
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
      expect(rawMime).toMatch(/^From: postmaster@vcmuellheim\.de$/im);
      expect(rawMime).toMatch(/^Reply-To: original\.sender@example\.com$/im);
    });

    test("quotes Reply-To display name when sender name contains comma", async () => {
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
                "Volleyball Team, Muellheim <sender@example.com>",
              ),
            ),
        } as never,
      });

      await handler(makeEvent("emails/reply-to-comma-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^Reply-To: "Volleyball Team, Muellheim" <sender@example\.com>$/im);
    });

    test("replaces existing Reply-To header with sanitized original sender", async () => {
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
                "From: sender@example.com",
                "To: max.mustermann@vcmuellheim.de",
                "Reply-To: broken reply <broken@example.com>",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/replace-reply-to-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).not.toMatch(/^Reply-To: broken reply/im);
      expect(rawMime).toMatch(/^Reply-To: sender@example\.com$/im);
    });

    test("strips Cc and Bcc headers before forwarding", async () => {
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
                "From: sender@example.com",
                "To: max.mustermann@vcmuellheim.de",
                "Cc: cc@example.com",
                "Bcc: bcc@example.com",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/strip-cc-bcc-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).not.toMatch(/^Cc:/im);
      expect(rawMime).not.toMatch(/^Bcc:/im);
    });

    test("trims whitespace from destination email address", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: " max@example.com ",
          },
        ],
      });

      await handler(makeEvent("emails/trim-target-test.eml"), mockLambdaContext as never);

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
    });

    test("strips internal whitespace from destination email address", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max @example.com",
          },
        ],
      });

      await handler(makeEvent("emails/internal-whitespace-target.eml"), mockLambdaContext as never);

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["max@example.com"]);
    });

    test("strips folded To header continuations after rewrite", async () => {
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
                "From: sender@example.com",
                "To: other@example.com,",
                " max.mustermann@vcmuellheim.de",
                "Subject: Test",
                "",
                "Hello world",
              ].join("\n"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/folded-to-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^To: max@example\.com$/im);
      expect(rawMime).not.toMatch(/other@example\.com/im);
    });

    test("skips member with invalid privateEmail and forwards to valid ones", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "not-an-email",
          },
        ],
      });

      const result = await handler(
        makeEvent("emails/invalid-private-email.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: expect.stringContaining("dropped") });
    });

    test("reports SES header context to Sentry on forward failure", async () => {
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
              makeMime("max.mustermann@vcmuellheim.de", '"Max Mustermann" <sender@example.com>'),
            ),
        } as never,
      });
      sesMock.on(SendEmailCommand).rejects(new Error("Domain contains control or whitespace"));

      await expect(
        handler(makeEvent("emails/sentry-context-test.eml"), mockLambdaContext as never),
      ).rejects.toThrow("All forwards failed");

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          extra: expect.objectContaining({
            originalFrom: '"Max Mustermann" <sender@example.com>',
            rewrittenFrom: expect.stringContaining("postmaster@vcmuellheim.de"),
            replyTo: expect.stringContaining("sender@example.com"),
            target: "max@example.com",
          }),
        }),
      );
    });

    test("includes original sender name in From display name", async () => {
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
      expect(rawMime).toMatch(/^From: "Max Mustermann" <postmaster@vcmuellheim\.de>$/im);
      expect(rawMime).toMatch(/^Reply-To: "Max Mustermann" <max\.mustermann@example\.com>$/im);
    });

    test("preserves RFC 2047 encoded sender name in forwarded headers", async () => {
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
              makeMime("max.mustermann@vcmuellheim.de", "=?UTF-8?Q?M=C3=BCller?= <mueller@gmx.de>"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/rfc2047-from-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^From: =\?UTF-8\?Q\?M=C3=BCller\?= <postmaster@vcmuellheim\.de>$/im);
      expect(rawMime).toMatch(/^Reply-To: =\?UTF-8\?Q\?M=C3=BCller\?= <mueller@gmx\.de>$/im);
    });

    test("sanitizes angle address in preserved RFC 2047 Reply-To", async () => {
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
                "=?UTF-8?Q?M=C3=BCller?= <mueller @gmx.de>",
              ),
            ),
        } as never,
      });

      await handler(makeEvent("emails/rfc2047-reply-to-sanitize.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^Reply-To: =\?UTF-8\?Q\?M=C3=BCller\?= <mueller@gmx\.de>$/im);
    });

    test("RFC 2047-encodes question marks in display names", async () => {
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
              makeMime("max.mustermann@vcmuellheim.de", "Müller? <sender@example.com>"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/question-mark-reply-to.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^Reply-To: =\?UTF-8\?Q\?M=C3=BCller=3F\?= <sender@example\.com>$/im);
    });

    test("splits long non-ASCII display names into multiple RFC 2047 encoded-words", async () => {
      const longName = "Müller ".repeat(12).trim();
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
              makeMime("max.mustermann@vcmuellheim.de", `${longName} <sender@example.com>`),
            ),
        } as never,
      });

      await handler(makeEvent("emails/long-unicode-reply-to.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      const replyToLine = rawMime.match(/^Reply-To: (.+)$/im)?.[1] ?? "";
      const encodedWords = replyToLine.match(/=\?UTF-8\?Q\?[^?]+\?=/g) ?? [];
      expect(encodedWords.length).toBeGreaterThan(1);
      for (const word of encodedWords) {
        expect(word.length).toBeLessThanOrEqual(75);
      }
    });

    test("RFC 2047-encodes non-ASCII sender names when rebuilding Reply-To", async () => {
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
              makeMime("max.mustermann@vcmuellheim.de", "Müller <mueller@gmx.de>"),
            ),
        } as never,
      });

      await handler(makeEvent("emails/unicode-reply-to-test.eml"), mockLambdaContext as never);

      const rawMime = Buffer.from(
        getForwardCalls()[0].args[0].input.Content!.Raw!.Data!,
      ).toString();
      expect(rawMime).toMatch(/^From: =\?UTF-8\?Q\?M=C3=BCller\?= <postmaster@vcmuellheim\.de>$/im);
      expect(rawMime).toMatch(/^Reply-To: =\?UTF-8\?Q\?M=C3=BCller\?= <mueller@gmx\.de>$/im);
    });

    test("sanitizes FromEmailAddress in SES API call", async () => {
      mockByProxyEmailGo.mockResolvedValue({
        data: [
          {
            id: "m1",
            proxyEmail: "max.mustermann@vcmuellheim.de",
            privateEmail: "max@example.com",
          },
        ],
      });

      await handler(makeEvent("emails/from-api-sanitize-test.eml"), mockLambdaContext as never);

      expect(getForwardCalls()[0].args[0].input.FromEmailAddress).toBe("postmaster@vcmuellheim.de");
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

    test("notifies sender and drops when S3 metadata already exceeds SES v2 forwarding limit", async () => {
      const oversizedMime = [
        "From: sender@example.com",
        "To: max.mustermann@vcmuellheim.de",
        "Subject: Huge attachment",
        "",
        "A",
      ].join("\n");

      s3Mock.reset();
      s3Mock
        .on(GetObjectCommand)
        .resolvesOnce({
          Body: {
            transformToString: vi
              .fn()
              .mockRejectedValue(new Error("raw body should not be loaded")),
          } as never,
          ContentLength: 41 * 1024 * 1024,
        })
        .resolves({
          Body: {
            transformToString: vi.fn().mockResolvedValue(oversizedMime),
          } as never,
        });

      const result = await handler(makeEvent("emails/oversized.eml"), mockLambdaContext as never);

      const notifyCalls = getNotificationCalls();
      expect(notifyCalls).toHaveLength(1);
      expect(notifyCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["sender@example.com"]);

      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: "dropped: message too large" });
    });

    test("does not notify when sender cannot be parsed reliably", async () => {
      const oversizedMimeWithoutFrom = [
        "To: max.mustermann@vcmuellheim.de",
        "Subject: Huge attachment",
        "",
        "A",
      ].join("\n");

      s3Mock.reset();
      s3Mock
        .on(GetObjectCommand)
        .resolvesOnce({
          Body: {
            transformToString: vi
              .fn()
              .mockRejectedValue(new Error("raw body should not be loaded")),
          } as never,
          ContentLength: 41 * 1024 * 1024,
        })
        .resolves({
          Body: {
            transformToString: vi.fn().mockResolvedValue(oversizedMimeWithoutFrom),
          } as never,
        });

      const result = await handler(
        makeEvent("emails/oversized-missing-sender.eml"),
        mockLambdaContext as never,
      );

      expect(getNotificationCalls()).toHaveLength(0);
      expect(getForwardCalls()).toHaveLength(0);
      expect(result).toMatchObject({ statusCode: 200, body: "dropped: message too large" });
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

    test("deduplicates group members after email sanitization", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
        } as never,
      });
      mockByTypeWhereGo.mockResolvedValue({
        data: [
          { id: "t1", isTrainer: true, privateEmail: "trainer1@example.com" },
          { id: "t2", isTrainer: true, privateEmail: "trainer1 @example.com" },
        ],
      });

      const result = await handler(
        makeEvent("emails/trainer-dedupe-sanitize.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(1);
      expect(getForwardCalls()[0].args[0].input.Destination?.ToAddresses).toEqual([
        "trainer1@example.com",
      ]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("forwards vorstand@ to all board members with a privateEmail", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("vorstand@vcmuellheim.de")),
        } as never,
      });
      mockByTypeWhereGo.mockResolvedValue({
        data: [
          { id: "b1", isBoardMember: true, privateEmail: "board1@example.com" },
          { id: "b2", isBoardMember: true, privateEmail: "board2@example.com" },
        ],
      });

      const result = await handler(
        makeEvent("emails/vorstand-group.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(2);
      const destinations = sesCalls.map((c) => c.args[0].input.Destination!.ToAddresses![0]);
      expect(destinations).toContain("board1@example.com");
      expect(destinations).toContain("board2@example.com");
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 2" });
    });

    test("skips invalid group member emails and forwards to valid ones", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
        } as never,
      });
      mockByTypeWhereGo.mockResolvedValue({
        data: [
          { id: "t1", isTrainer: true, privateEmail: "trainer1@example.com" },
          { id: "t2", isTrainer: true, privateEmail: "not-an-email" },
        ],
      });

      const result = await handler(
        makeEvent("emails/trainer-invalid-member.eml"),
        mockLambdaContext as never,
      );

      const sesCalls = getForwardCalls();
      expect(sesCalls).toHaveLength(1);
      expect(sesCalls[0].args[0].input.Destination?.ToAddresses).toEqual(["trainer1@example.com"]);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
    });

    test("returns partial success when some group forwards fail", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
        } as never,
      });
      mockByTypeWhereGo.mockResolvedValue({
        data: [
          { id: "t1", isTrainer: true, privateEmail: "fail@example.com" },
          { id: "t2", isTrainer: true, privateEmail: "ok@example.com" },
        ],
      });
      sesMock
        .on(SendEmailCommand)
        .rejectsOnce(new Error("Domain contains control or whitespace"))
        .resolves({ MessageId: "test-message-id" });

      const result = await handler(
        makeEvent("emails/trainer-partial-failure.eml"),
        mockLambdaContext as never,
      );

      expect(getForwardCalls()).toHaveLength(2);
      expect(result).toMatchObject({ statusCode: 200, body: "forwarded: 1" });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });

    test("throws when all group forwards fail", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: vi.fn().mockResolvedValue(makeMime("trainer@vcmuellheim.de")),
        } as never,
      });
      mockByTypeWhereGo.mockResolvedValue({
        data: [
          { id: "t1", isTrainer: true, privateEmail: "fail1@example.com" },
          { id: "t2", isTrainer: true, privateEmail: "fail2@example.com" },
        ],
      });
      sesMock.on(SendEmailCommand).rejects(new Error("Domain contains control or whitespace"));

      await expect(
        handler(makeEvent("emails/trainer-all-fail.eml"), mockLambdaContext as never),
      ).rejects.toThrow(
        "All forwards failed: fail1@example.com: Domain contains control or whitespace",
      );
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
