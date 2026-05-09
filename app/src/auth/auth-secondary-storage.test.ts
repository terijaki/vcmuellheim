import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

let storage: typeof import("./auth-secondary-storage").dynamoDBSecondaryStorage;

beforeAll(async () => {
  process.env.CONTENT_TABLE_NAME = "test-content-table";
  const module = await import("./auth-secondary-storage");
  storage = module.dynamoDBSecondaryStorage;
});

beforeEach(() => {
  ddbMock.reset();
});

describe("get", () => {
  it("returns null when no item exists", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await storage.get("otp-key");

    expect(result).toBeNull();
  });

  it("returns the stored string value", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pk: "auth-storage#otp-key", sk: "auth-storage", value: "123456" },
    });

    const result = await storage.get("otp-key");

    expect(result).toBe("123456");
  });

  it("queries DynamoDB with the correct key scheme", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    await storage.get("some-key");

    const calls = ddbMock.commandCalls(GetCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toEqual({
      pk: "auth-storage#some-key",
      sk: "auth-storage",
    });
    expect(calls[0].args[0].input.TableName).toBe("test-content-table");
  });
});

describe("set", () => {
  it("stores the value with the correct key scheme", async () => {
    ddbMock.on(PutCommand).resolves({});

    await storage.set("otp-key", "654321");

    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    const item = calls[0].args[0].input.Item as Record<string, unknown>;
    expect(item.pk).toBe("auth-storage#otp-key");
    expect(item.sk).toBe("auth-storage");
    expect(item.value).toBe("654321");
  });

  it("omits ttl when none is provided", async () => {
    ddbMock.on(PutCommand).resolves({});

    await storage.set("no-ttl-key", "val");

    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item.ttl).toBeUndefined();
  });

  it("sets ttl as unix epoch seconds relative to now when ttl is provided", async () => {
    ddbMock.on(PutCommand).resolves({});
    const before = Math.floor(Date.now() / 1000);

    await storage.set("rate-limit-key", "1", 600);

    const after = Math.floor(Date.now() / 1000);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item.ttl).toBeGreaterThanOrEqual(before + 600);
    expect(item.ttl).toBeLessThanOrEqual(after + 600);
  });
});

describe("delete", () => {
  it("deletes the item with the correct key scheme", async () => {
    ddbMock.on(DeleteCommand).resolves({});

    await storage.delete("otp-key");

    const calls = ddbMock.commandCalls(DeleteCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toEqual({
      pk: "auth-storage#otp-key",
      sk: "auth-storage",
    });
    expect(calls[0].args[0].input.TableName).toBe("test-content-table");
  });
});
