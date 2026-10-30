/**
 * DocumentClient helper for ElectroDB-compatible single-table items.
 *
 * Uses {@link buildElectroDbServicePartitionKey}, {@link buildElectroDbEntitySortKey},
 * and entity key metadata for pk/sk/gsi* attributes. Zod validates item shape on read and write.
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import {
  buildElectroDbEntityMarkers,
  buildElectroDbEntitySortKey,
  buildElectroDbServicePartitionKey,
  type ElectroDbKeyCompositePart,
} from "@/lib/db/electrodb-keys";
import { parseWithSchema } from "@/lib/sams/repository-utils";

/** DynamoDB key field plus entity attributes that form it. */
export type ElectroDbCompositeKeyDefinition = {
  field: string;
  composite: readonly string[];
};

/** Primary or GSI key layout for one access pattern. */
export type ElectroDbIndexDefinition = {
  /** CDK physical GSI name, or `"table"` for the base table. */
  indexName: string;
  partitionKey: ElectroDbCompositeKeyDefinition;
  sortKey: ElectroDbCompositeKeyDefinition;
};

/** Key metadata registered per entity (news, member, SAMS club, …). */
export type ElectroDbEntityKeyDefinition = {
  entityName: string;
  indexes: readonly ElectroDbIndexDefinition[];
};

export type ElectroDbQueryFilter =
  | { type: "eq"; attribute: string; value: string | number | boolean }
  | { type: "contains"; attribute: string; value: string };

export type ElectroDbQueryInput = {
  indexName: string;
  /** Attribute values for the queried index partition composite. */
  partition: Record<string, string>;
  sortKeyBeginsWith?: string;
  filter?: ElectroDbQueryFilter;
  scanIndexForward?: boolean;
  limit?: number;
  /** JSON-encoded DynamoDB `LastEvaluatedKey` from a prior limited query. */
  cursor?: string;
};

export type ElectroDbDocumentClient<T> = {
  get: (primaryKey: Record<string, string>) => Promise<T | null>;
  put: (item: T) => Promise<T>;
  patch: (
    primaryKey: Record<string, string>,
    updates: Partial<{ [K in keyof T]: T[K] | null }>,
  ) => Promise<T>;
  delete: (primaryKey: Record<string, string>) => Promise<void>;
  query: (input: ElectroDbQueryInput) => Promise<{ items: T[]; cursor?: string | null }>;
};

const GSI_KEY_FIELD = /^gsi\d+(pk|sk)$/;

function findPrimaryIndex(definition: ElectroDbEntityKeyDefinition): ElectroDbIndexDefinition {
  const primary = definition.indexes.find((index) => index.indexName === "table");
  if (!primary) {
    throw new Error(`Entity "${definition.entityName}" is missing a table index definition`);
  }
  return primary;
}

function findIndexByName(
  definition: ElectroDbEntityKeyDefinition,
  indexName: string,
): ElectroDbIndexDefinition {
  const index = definition.indexes.find((candidate) => candidate.indexName === indexName);
  if (!index) {
    throw new Error(`Entity "${definition.entityName}" has no index "${indexName}"`);
  }
  return index;
}

function compositePartsFromItem(
  composite: readonly string[],
  item: Record<string, unknown>,
): ElectroDbKeyCompositePart[] | undefined {
  const parts: ElectroDbKeyCompositePart[] = [];
  for (const attribute of composite) {
    const raw = item[attribute];
    if (raw === null || raw === undefined) {
      return undefined;
    }
    parts.push({ attribute, value: String(raw) });
  }
  return parts;
}

function buildKeyFieldValue(
  entityName: string,
  keyDefinition: ElectroDbCompositeKeyDefinition,
  item: Record<string, unknown>,
): string | undefined {
  const parts = compositePartsFromItem(keyDefinition.composite, item);
  if (parts === undefined) {
    return undefined;
  }
  if (keyDefinition.field === "pk" || keyDefinition.field.endsWith("pk")) {
    return buildElectroDbServicePartitionKey(parts);
  }
  return buildElectroDbEntitySortKey(entityName, parts);
}

function buildIndexKeyPair(
  entityName: string,
  indexDefinition: ElectroDbIndexDefinition,
  item: Record<string, unknown>,
): { partition: string; sort: string } | undefined {
  const partition = buildKeyFieldValue(entityName, indexDefinition.partitionKey, item);
  const sort = buildKeyFieldValue(entityName, indexDefinition.sortKey, item);
  if (partition === undefined || sort === undefined) {
    return undefined;
  }
  return { partition, sort };
}

function buildAllKeyAttributes(
  entityName: string,
  indexes: readonly ElectroDbIndexDefinition[],
  item: Record<string, unknown>,
  requireAll: boolean,
): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const indexDefinition of indexes) {
    const pair = buildIndexKeyPair(entityName, indexDefinition, item);
    if (pair === undefined) {
      if (requireAll && indexDefinition.indexName === "table") {
        throw new Error(`Cannot build primary key for entity "${entityName}"`);
      }
      continue;
    }
    keys[indexDefinition.partitionKey.field] = pair.partition;
    keys[indexDefinition.sortKey.field] = pair.sort;
  }
  return keys;
}

function buildPrimaryKey(
  definition: ElectroDbEntityKeyDefinition,
  primaryKeyValues: Record<string, string>,
): { pk: string; sk: string } {
  const primary = findPrimaryIndex(definition);
  const item: Record<string, unknown> = { ...primaryKeyValues };
  const pair = buildIndexKeyPair(definition.entityName, primary, item);
  if (pair === undefined) {
    throw new Error(`Incomplete primary key for entity "${definition.entityName}"`);
  }
  return { pk: pair.partition, sk: pair.sort };
}

function stripElectroDbItem(item: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(item)) {
    if (
      field === "pk" ||
      field === "sk" ||
      GSI_KEY_FIELD.test(field) ||
      field === "__edb_e__" ||
      field === "__edb_v__"
    ) {
      continue;
    }
    stripped[field] = value;
  }
  return stripped;
}

function parseStoredItem<T>(schema: z.ZodType<T>, item: Record<string, unknown>): T {
  return parseWithSchema(schema, stripElectroDbItem(item), "Failed to parse DynamoDB item");
}

function decodeQueryCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) {
    return undefined;
  }
  return JSON.parse(cursor) as Record<string, unknown>;
}

function encodeQueryCursor(lastEvaluatedKey: Record<string, unknown> | undefined): string | null {
  if (!lastEvaluatedKey) {
    return null;
  }
  return JSON.stringify(lastEvaluatedKey);
}

function applyPatchToItem(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      delete merged[field];
    } else {
      merged[field] = value;
    }
  }
  return merged;
}

function indexTouchesAttribute(
  indexDefinition: ElectroDbIndexDefinition,
  attribute: string,
): boolean {
  return (
    indexDefinition.partitionKey.composite.includes(attribute) ||
    indexDefinition.sortKey.composite.includes(attribute)
  );
}

function buildUpdateExpression(
  definition: ElectroDbEntityKeyDefinition,
  existing: Record<string, unknown>,
  merged: Record<string, unknown>,
  updates: Record<string, unknown>,
): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const setClauses: string[] = [];
  const removeFields: string[] = [];

  let nameCounter = 0;
  let valueCounter = 0;

  const nameFor = (field: string): string => {
    const placeholder = `#n${nameCounter}`;
    nameCounter += 1;
    names[placeholder] = field;
    return placeholder;
  };

  const valueFor = (value: unknown): string => {
    const placeholder = `:v${valueCounter}`;
    valueCounter += 1;
    values[placeholder] = value;
    return placeholder;
  };

  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    const name = nameFor(field);
    if (value === null) {
      removeFields.push(name);
      continue;
    }
    setClauses.push(`${name} = ${valueFor(value)}`);
  }

  for (const indexDefinition of definition.indexes) {
    const before = buildIndexKeyPair(definition.entityName, indexDefinition, existing);
    const after = buildIndexKeyPair(definition.entityName, indexDefinition, merged);

    const touched = Object.keys(updates).some(
      (field) => updates[field] !== undefined && indexTouchesAttribute(indexDefinition, field),
    );
    if (!touched && before?.partition === after?.partition && before?.sort === after?.sort) {
      continue;
    }

    const pkName = nameFor(indexDefinition.partitionKey.field);
    const skName = nameFor(indexDefinition.sortKey.field);

    if (after === undefined) {
      if (before !== undefined) {
        removeFields.push(pkName, skName);
      }
      continue;
    }

    if (before?.partition !== after.partition) {
      setClauses.push(`${pkName} = ${valueFor(after.partition)}`);
    }
    if (before?.sort !== after.sort) {
      setClauses.push(`${skName} = ${valueFor(after.sort)}`);
    }
  }

  const expressionParts: string[] = [];
  if (setClauses.length > 0) {
    expressionParts.push(`SET ${setClauses.join(", ")}`);
  }
  if (removeFields.length > 0) {
    expressionParts.push(`REMOVE ${removeFields.join(", ")}`);
  }

  if (expressionParts.length === 0) {
    throw new Error("Patch did not include any changes");
  }

  return {
    UpdateExpression: expressionParts.join(" "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

function buildQueryCommandInput<TTable extends string>(
  tableName: TTable,
  indexDefinition: ElectroDbIndexDefinition,
  input: ElectroDbQueryInput,
  exclusiveStartKey: Record<string, unknown> | undefined,
): ConstructorParameters<typeof QueryCommand>[0] {
  const partitionParts = compositePartsFromItem(
    indexDefinition.partitionKey.composite,
    input.partition,
  );
  if (partitionParts === undefined) {
    throw new Error("Query partition composite is incomplete");
  }
  const partitionValue = buildElectroDbServicePartitionKey(partitionParts);

  const names: Record<string, string> = {
    "#pk": indexDefinition.partitionKey.field,
  };
  const values: Record<string, unknown> = {
    ":pk": partitionValue,
  };

  let keyCondition = "#pk = :pk";
  if (input.sortKeyBeginsWith !== undefined) {
    names["#sk"] = indexDefinition.sortKey.field;
    values[":skPrefix"] = input.sortKeyBeginsWith;
    keyCondition += " AND begins_with(#sk, :skPrefix)";
  }

  let filterExpression: string | undefined;
  if (input.filter) {
    const filterName = "#f0";
    names[filterName] = input.filter.attribute;
    if (input.filter.type === "eq") {
      values[":f0"] = input.filter.value;
      filterExpression = `${filterName} = :f0`;
    } else {
      values[":f0"] = input.filter.value;
      filterExpression = `contains(${filterName}, :f0)`;
    }
  }

  return {
    TableName: tableName,
    IndexName: indexDefinition.indexName === "table" ? undefined : indexDefinition.indexName,
    KeyConditionExpression: keyCondition,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ScanIndexForward: input.scanIndexForward ?? true,
    Limit: input.limit,
    ExclusiveStartKey: exclusiveStartKey,
  };
}

function toAttributeRecord<TItem extends object>(
  item: TItem,
  entityName: string,
): Record<string, unknown> {
  if (typeof item !== "object" || item === null) {
    throw new Error(`Entity "${entityName}" item must be an object`);
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    record[key] = value;
  }
  return record;
}

export function createElectroDbDocumentClient<T extends object>(options: {
  documentClient: DynamoDBDocumentClient;
  tableName: string;
  schema: z.ZodType<T>;
  keys: ElectroDbEntityKeyDefinition;
}): ElectroDbDocumentClient<T> {
  const { documentClient, tableName, schema, keys } = options;

  const parseQueryItems = (items: Record<string, unknown>[] | undefined): T[] => {
    const parsed: T[] = [];
    if (!items) {
      return parsed;
    }
    for (const item of items) {
      parsed.push(parseStoredItem(schema, item));
    }
    return parsed;
  };

  return {
    async get(primaryKey) {
      const key = buildPrimaryKey(keys, primaryKey);
      const result = await documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        }),
      );
      if (!result.Item) {
        return null;
      }
      return parseStoredItem(schema, result.Item);
    },

    async put(item) {
      const parsed = schema.parse(item);
      const record = toAttributeRecord(parsed, keys.entityName);
      const keyAttributes = buildAllKeyAttributes(keys.entityName, keys.indexes, record, true);
      const markers = buildElectroDbEntityMarkers(keys.entityName);
      await documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ...record,
            ...keyAttributes,
            ...markers,
          },
        }),
      );
      return parsed;
    },

    async patch(primaryKey, updates) {
      const key = buildPrimaryKey(keys, primaryKey);
      const existingResult = await documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        }),
      );
      if (!existingResult.Item) {
        throw new Error(`Item not found for entity "${keys.entityName}"`);
      }

      const existing = existingResult.Item;
      const updateRecord: Record<string, unknown> = {};
      for (const key of Object.keys(updates) as (keyof T & string)[]) {
        const value = updates[key];
        if (value !== undefined) {
          updateRecord[key] = value;
        }
      }
      const merged = applyPatchToItem(existing, updateRecord);
      const updateParams = buildUpdateExpression(keys, existing, merged, updateRecord);

      const result = await documentClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          ReturnValues: "ALL_NEW",
          ...updateParams,
        }),
      );
      if (!result.Attributes) {
        throw new Error(`Patch returned no attributes for entity "${keys.entityName}"`);
      }
      return parseStoredItem(schema, result.Attributes);
    },

    async delete(primaryKey) {
      const key = buildPrimaryKey(keys, primaryKey);
      await documentClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: key,
        }),
      );
    },

    async query(input) {
      const indexDefinition = findIndexByName(keys, input.indexName);
      const exclusiveStartKey = decodeQueryCursor(input.cursor);
      const collected: T[] = [];

      if (input.limit !== undefined) {
        const result = await documentClient.send(
          new QueryCommand(
            buildQueryCommandInput(tableName, indexDefinition, input, exclusiveStartKey),
          ),
        );
        return {
          items: parseQueryItems(result.Items as Record<string, unknown>[] | undefined),
          cursor: encodeQueryCursor(result.LastEvaluatedKey),
        };
      }

      let continuationKey = exclusiveStartKey;
      do {
        const pageInput: ElectroDbQueryInput = { ...input, limit: undefined, cursor: undefined };
        const result = await documentClient.send(
          new QueryCommand(
            buildQueryCommandInput(tableName, indexDefinition, pageInput, continuationKey),
          ),
        );
        collected.push(...parseQueryItems(result.Items as Record<string, unknown>[] | undefined));
        continuationKey = result.LastEvaluatedKey;
      } while (continuationKey);

      return { items: collected };
    },
  };
}
