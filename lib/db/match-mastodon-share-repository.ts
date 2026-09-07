/**
 * Durable Mastodon share ledger for match UUIDs (social table).
 */

import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSocialTableName } from "@/lib/db/env";
import {
  MATCH_MASTODON_SHARE_SK,
  matchMastodonShareItemSchema,
  matchMastodonSharePk,
  type MatchMastodonShareItem,
} from "@/lib/db/schemas";
import { SAMS_PROJECTION_TTL_DAYS, unixTtlSecondsFromNow } from "@/lib/sams/repository-utils";

function isConditionalCheckFailed(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }
  return error.name === "ConditionalCheckFailedException";
}

export class MatchMastodonShareRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private resolveTableName(): string {
    return this.tableName ?? getSocialTableName();
  }

  /**
   * First writer wins. Returns true when this call created the pending claim.
   * Returns false when a claim already exists (does not overwrite).
   */
  async claim(matchUuid: string, nowMs = Date.now()): Promise<boolean> {
    const createdAt = new Date(nowMs).toISOString();
    const item: MatchMastodonShareItem = {
      pk: matchMastodonSharePk(matchUuid),
      sk: MATCH_MASTODON_SHARE_SK,
      status: "pending",
      createdAt,
      ttl: unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
    };

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.resolveTableName(),
          Item: matchMastodonShareItemSchema.parse(item),
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return false;
      }
      throw error;
    }
  }

  async get(matchUuid: string): Promise<MatchMastodonShareItem | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.resolveTableName(),
        Key: { pk: matchMastodonSharePk(matchUuid), sk: MATCH_MASTODON_SHARE_SK },
      }),
    );
    if (!result.Item) return null;
    const parsed = matchMastodonShareItemSchema.safeParse(result.Item);
    return parsed.success ? parsed.data : null;
  }

  async markPosted(matchUuid: string, mastodonStatusId: string, nowMs = Date.now()): Promise<void> {
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.resolveTableName(),
        Key: { pk: matchMastodonSharePk(matchUuid), sk: MATCH_MASTODON_SHARE_SK },
        UpdateExpression: "SET #status = :posted, postedAt = :postedAt, mastodonStatusId = :id",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":posted": "posted",
          ":postedAt": new Date(nowMs).toISOString(),
          ":id": mastodonStatusId,
        },
      }),
    );
  }
}
