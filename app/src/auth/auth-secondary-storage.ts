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
 */

import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SecondaryStorage } from "better-auth";
import { docClient } from "@/lib/db/client";
import { getContentTableName } from "@/lib/db/env";

const SK = "auth-storage";

function buildPk(key: string): string {
  return `auth-storage#${key}`;
}

export const dynamoDBSecondaryStorage: SecondaryStorage = {
  async get(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: getContentTableName(),
        Key: { pk: buildPk(key), sk: SK },
      }),
    );

    if (!result.Item) return null;
    return result.Item.value as string;
  },

  async set(key, value, ttl) {
    const item: Record<string, unknown> = {
      pk: buildPk(key),
      sk: SK,
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
        Key: { pk: buildPk(key), sk: SK },
      }),
    );
  },
};
