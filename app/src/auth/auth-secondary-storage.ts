/**
 * DynamoDB-backed SecondaryStorage for better-auth.
 *
 * better-auth routes OTP verification codes and rate-limit counters through
 * SecondaryStorage when one is provided, keeping those short-lived records out
 * of the primary adapter entirely.
 *
 * Key scheme (single content table, single-table design):
 *   PK: `auth-storage#<key>`
 *   SK: `auth-storage`
 *
 * The `ttl` attribute is a Unix epoch seconds value used by DynamoDB TTL to
 * automatically delete expired entries.
 *
 * better-auth 1.7 requires atomic `increment` (fixed-window rate limits) and
 * `getAndDelete` (single-use verification consume).
 */

import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { SecondaryStorage } from "better-auth";
import { docClient } from "@/lib/db/client";
import { getContentTableName } from "@/lib/db/env";

const SK = "auth-storage";

function buildPk(key: string): string {
  return `auth-storage#${key}`;
}

function storageKey(key: string) {
  return { pk: buildPk(key), sk: SK };
}

export const dynamoDBSecondaryStorage: SecondaryStorage = {
  async get(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: getContentTableName(),
        Key: storageKey(key),
      }),
    );

    if (!result.Item) return null;
    return result.Item.value;
  },

  async getAndDelete(key) {
    const result = await docClient.send(
      new DeleteCommand({
        TableName: getContentTableName(),
        Key: storageKey(key),
        ReturnValues: "ALL_OLD",
      }),
    );

    if (!result.Attributes) return null;
    return result.Attributes.value;
  },

  async increment(key, ttl) {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: getContentTableName(),
        Key: storageKey(key),
        // Create at 1 with fixed-window TTL; later increments never extend TTL.
        UpdateExpression:
          "SET #value = if_not_exists(#value, :zero) + :one, #ttl = if_not_exists(#ttl, :expiry)",
        ExpressionAttributeNames: {
          "#value": "value",
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":expiry": Math.floor(Date.now() / 1000) + ttl,
        },
        ReturnValues: "UPDATED_NEW",
      }),
    );

    const next = result.Attributes?.value;
    if (typeof next !== "number") {
      throw new Error(`SecondaryStorage.increment expected a numeric counter for key "${key}"`);
    }
    return next;
  },

  async set(key, value, ttl) {
    const item: Record<string, unknown> = {
      ...storageKey(key),
      value,
    };

    if (ttl !== undefined) {
      item.ttl = Math.floor(Date.now() / 1000) + ttl;
    }

    await docClient.send(
      new PutCommand({
        TableName: getContentTableName(),
        Item: item,
      }),
    );
  },

  async delete(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: getContentTableName(),
        Key: storageKey(key),
      }),
    );
  },
};
