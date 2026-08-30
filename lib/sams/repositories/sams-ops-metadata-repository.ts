import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { samsOpsMetadataSchema, type SamsOpsMetadataInput } from "@/lib/db/schemas";
import { SK_METADATA, samsOpsPk } from "@/lib/sams/key-constants";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_OPS_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

function parseOps(value: unknown, message: string): SamsOpsMetadataInput {
  return parseWithSchema(samsOpsMetadataSchema, value, message);
}

export type SamsOpsMetadataUpsertInput = Omit<SamsOpsMetadataInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

export class SamsOpsMetadataRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private resolveTableName(): string {
    return this.tableName ?? getSamsTableName();
  }

  async upsert(input: SamsOpsMetadataUpsertInput): Promise<SamsOpsMetadataInput> {
    const item = parseOps(
      {
        ...input,
        type: "ops",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_OPS_TTL_DAYS),
      },
      "Failed to parse SAMS ops metadata upsert input",
    );
    await this.documentClient.send(
      new PutCommand({
        TableName: this.resolveTableName(),
        Item: {
          ...item,
          pk: samsOpsPk(item.scope),
          sk: SK_METADATA,
        },
      }),
    );
    return item;
  }
}

export function createSamsOpsMetadataRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsOpsMetadataRepository {
  return new SamsOpsMetadataRepository(client, tableName);
}

export const samsOpsMetadataRepository = new SamsOpsMetadataRepository();
