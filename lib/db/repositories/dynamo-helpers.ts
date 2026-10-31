import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import { decodeDynamoCursor, encodeDynamoCursor } from "@/lib/db/dynamo-cursor";
import { domainFieldsFromItem } from "@/lib/db/dynamo-item";
import { ContentTableIndexes } from "@/lib/db/table-indexes";
import { parseWithSchema } from "@/lib/sams/repository-utils";

export type QueryPage<T> = {
  items: T[];
  cursor?: string;
  lastEvaluatedKey?: Record<string, unknown>;
};

export async function getItem(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: { pk: string; sk: string },
): Promise<Record<string, unknown> | null> {
  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
    }),
  );
  return result.Item ?? null;
}

export async function putItem(
  client: DynamoDBDocumentClient,
  tableName: string,
  item: Record<string, unknown>,
): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );
}

export async function deleteItem(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: { pk: string; sk: string },
): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: tableName,
      Key: key,
    }),
  );
}

export async function queryGsi1(
  client: DynamoDBDocumentClient,
  tableName: string,
  input: {
    gsi1pk: string;
    scanIndexForward?: boolean;
    limit?: number;
    cursor?: string;
    beginsWithGsi1sk?: string;
    indexName?: string;
  },
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const expressionNames: Record<string, string> = { "#pk": "gsi1pk" };
  const expressionValues: Record<string, unknown> = { ":pk": input.gsi1pk };
  let keyCondition = "#pk = :pk";
  if (input.beginsWithGsi1sk !== undefined) {
    expressionNames["#sk"] = "gsi1sk";
    expressionValues[":prefix"] = input.beginsWithGsi1sk;
    keyCondition += " AND begins_with(#sk, :prefix)";
  }

  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: input.indexName ?? ContentTableIndexes.gsi1,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: input.scanIndexForward ?? true,
      Limit: input.limit,
      ExclusiveStartKey: input.cursor ? decodeDynamoCursor(input.cursor) : undefined,
    }),
  );

  return {
    items: (result.Items ?? []) as Record<string, unknown>[],
    cursor: result.LastEvaluatedKey ? encodeDynamoCursor(result.LastEvaluatedKey) : undefined,
  };
}

export async function queryTablePk(
  client: DynamoDBDocumentClient,
  tableName: string,
  input: {
    pk: string;
    scanIndexForward?: boolean;
    limit?: number;
    cursor?: string;
    beginsWithSk?: string;
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, unknown>;
  },
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const expressionNames: Record<string, string> = {
    "#pk": "pk",
    ...input.expressionAttributeNames,
  };
  const expressionValues: Record<string, unknown> = {
    ":pk": input.pk,
    ...input.expressionAttributeValues,
  };
  let keyCondition = "#pk = :pk";
  if (input.beginsWithSk !== undefined) {
    expressionNames["#sk"] = "sk";
    expressionValues[":prefix"] = input.beginsWithSk;
    keyCondition += " AND begins_with(#sk, :prefix)";
  }

  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyCondition,
      FilterExpression: input.filterExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: input.scanIndexForward ?? true,
      Limit: input.limit,
      ExclusiveStartKey: input.cursor ? decodeDynamoCursor(input.cursor) : undefined,
    }),
  );

  return {
    items: (result.Items ?? []) as Record<string, unknown>[],
    cursor: result.LastEvaluatedKey ? encodeDynamoCursor(result.LastEvaluatedKey) : undefined,
  };
}

export function parseDomain<T extends z.ZodType>(
  schema: T,
  item: Record<string, unknown>,
  message: string,
): z.output<T> {
  return parseWithSchema(schema, domainFieldsFromItem(item), message) as z.output<T>;
}

export async function patchItemFields(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: { pk: string; sk: string },
  setFields: Record<string, unknown>,
  removeFields: string[] = [],
): Promise<void> {
  const setKeys = Object.keys(setFields);
  if (setKeys.length === 0 && removeFields.length === 0) return;

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const setParts: string[] = [];
  for (const field of setKeys) {
    const nameKey = `#${field}`;
    const valueKey = `:${field}`;
    names[nameKey] = field;
    values[valueKey] = setFields[field];
    setParts.push(`${nameKey} = ${valueKey}`);
  }

  const removeParts = removeFields.map((field) => {
    const nameKey = `#rm_${field}`;
    names[nameKey] = field;
    return nameKey;
  });

  let updateExpression = "";
  if (setParts.length > 0) {
    updateExpression += `SET ${setParts.join(", ")}`;
  }
  if (removeParts.length > 0) {
    updateExpression += `${updateExpression ? " " : ""}REMOVE ${removeParts.join(", ")}`;
  }

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
    }),
  );
}
