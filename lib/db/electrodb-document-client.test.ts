import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { ContentTableIndexes } from "@/lib/db/electrodb-entities";
import {
  buildElectroDbEntitySortKey,
  buildElectroDbServicePartitionKey,
} from "@/lib/db/electrodb-keys";
import {
  createElectroDbDocumentClient,
  type ElectroDbEntityKeyDefinition,
} from "./electrodb-document-client";

const ddbMock = mockClient(DynamoDBDocumentClient);

const fixtureSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]),
  tag: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type FixtureItem = z.infer<typeof fixtureSchema>;

const fixtureKeys: ElectroDbEntityKeyDefinition = {
  entityName: "news",
  indexes: [
    {
      indexName: ContentTableIndexes.table,
      partitionKey: { field: "pk", composite: ["id"] },
      sortKey: { field: "sk", composite: [] },
    },
    {
      indexName: ContentTableIndexes.gsi1,
      partitionKey: { field: "gsi1pk", composite: ["type"] },
      sortKey: { field: "gsi1sk", composite: ["updatedAt"] },
    },
    {
      indexName: ContentTableIndexes.gsi2,
      partitionKey: { field: "gsi2pk", composite: ["status"] },
      sortKey: { field: "gsi2sk", composite: ["createdAt"] },
    },
    {
      indexName: ContentTableIndexes.gsi3,
      partitionKey: { field: "gsi3pk", composite: ["slug"] },
      sortKey: { field: "gsi3sk", composite: [] },
    },
  ],
};

function createClient() {
  return createElectroDbDocumentClient({
    documentClient: ddbMock as never,
    tableName: "test-content-table",
    schema: fixtureSchema,
    keys: fixtureKeys,
  });
}

function sampleItem(overrides: Partial<FixtureItem> = {}): FixtureItem {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    type: "article",
    title: "Hello",
    slug: "hello",
    status: "published",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-20T12:30:00.000Z",
    ...overrides,
  };
}

function primaryKeyFor(item: FixtureItem) {
  return {
    pk: buildElectroDbServicePartitionKey([{ attribute: "id", value: item.id }]),
    sk: buildElectroDbEntitySortKey("news", []),
  };
}

describe("createElectroDbDocumentClient", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("puts a Zod-parsed item with index keys and ElectroDB markers", async () => {
    ddbMock.on(PutCommand).resolves({});
    const client = createClient();
    const item = sampleItem();

    await client.put(item);

    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.TableName).toBe("test-content-table");
    expect(put?.Item).toMatchObject({
      id: item.id,
      title: item.title,
      __edb_e__: "news",
      __edb_v__: "1",
      pk: primaryKeyFor(item).pk,
      sk: primaryKeyFor(item).sk,
      gsi1pk: buildElectroDbServicePartitionKey([{ attribute: "type", value: item.type }]),
      gsi1sk: buildElectroDbEntitySortKey("news", [
        { attribute: "updatedAt", value: item.updatedAt },
      ]),
      gsi3pk: buildElectroDbServicePartitionKey([{ attribute: "slug", value: item.slug ?? "" }]),
    });
  });

  it("patches a field that rewrites its GSI attributes", async () => {
    const item = sampleItem();
    const key = primaryKeyFor(item);
    ddbMock.on(GetCommand).resolves({
      Item: {
        ...item,
        ...key,
        gsi1pk: buildElectroDbServicePartitionKey([{ attribute: "type", value: item.type }]),
        gsi1sk: buildElectroDbEntitySortKey("news", [
          { attribute: "updatedAt", value: item.updatedAt },
        ]),
        gsi2pk: buildElectroDbServicePartitionKey([{ attribute: "status", value: item.status }]),
        gsi2sk: buildElectroDbEntitySortKey("news", [
          { attribute: "createdAt", value: item.createdAt },
        ]),
        gsi3pk: buildElectroDbServicePartitionKey([{ attribute: "slug", value: item.slug ?? "" }]),
        gsi3sk: buildElectroDbEntitySortKey("news", []),
        __edb_e__: "news",
        __edb_v__: "1",
      },
    });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        ...item,
        slug: "new-slug",
        ...key,
        gsi3pk: buildElectroDbServicePartitionKey([{ attribute: "slug", value: "new-slug" }]),
        gsi3sk: buildElectroDbEntitySortKey("news", []),
      },
    });

    const client = createClient();
    await client.patch({ id: item.id }, { slug: "new-slug" });

    const update = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(Object.values(update?.ExpressionAttributeNames ?? {})).toContain("gsi3pk");
    expect(update?.ExpressionAttributeValues).toMatchObject({
      ":v0": "new-slug",
    });
  });

  it("removes null fields and their GSI attributes on patch", async () => {
    const item = sampleItem();
    const key = primaryKeyFor(item);
    ddbMock.on(GetCommand).resolves({
      Item: {
        ...item,
        ...key,
        gsi3pk: buildElectroDbServicePartitionKey([{ attribute: "slug", value: item.slug ?? "" }]),
        gsi3sk: buildElectroDbEntitySortKey("news", []),
        __edb_e__: "news",
        __edb_v__: "1",
      },
    });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        ...item,
        slug: undefined,
        ...key,
      },
    });

    const client = createClient();
    await client.patch({ id: item.id }, { slug: null });

    const update = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    const removedFields = Object.values(update?.ExpressionAttributeNames ?? {});
    expect(removedFields).toContain("slug");
    expect(removedFields).toContain("gsi3pk");
    expect(removedFields).toContain("gsi3sk");
  });

  it("queries with begins_with on the sort key", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const client = createClient();
    const sortPrefix = buildElectroDbEntitySortKey("news", []);

    await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
      sortKeyBeginsWith: sortPrefix,
      scanIndexForward: false,
    });

    const query = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(query).toMatchObject({
      IndexName: ContentTableIndexes.gsi1,
      ScanIndexForward: false,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skPrefix)",
    });
    expect(query?.ExpressionAttributeValues?.[":skPrefix"]).toBe(sortPrefix);
  });

  it("applies an equality filter expression", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const client = createClient();

    await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
      filter: { type: "eq", attribute: "status", value: "published" },
    });

    const query = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(query?.FilterExpression).toBe("#f0 = :f0");
    expect(query?.ExpressionAttributeNames?.["#f0"]).toBe("status");
    expect(query?.ExpressionAttributeValues?.[":f0"]).toBe("published");
  });

  it("applies a contains filter expression", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const client = createClient();

    await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
      filter: { type: "contains", attribute: "title", value: "Hello" },
    });

    const query = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(query?.FilterExpression).toBe("contains(#f0, :f0)");
  });

  it("reads every query page when no limit is set", async () => {
    const item = sampleItem();
    const lek = { pk: "next", sk: "$news_1" };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [
          {
            ...item,
            ...primaryKeyFor(item),
            __edb_e__: "news",
            __edb_v__: "1",
          },
        ],
        LastEvaluatedKey: lek,
      })
      .resolvesOnce({ Items: [] });

    const client = createClient();
    const result = await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
    });

    expect(result.items).toHaveLength(1);
    expect(result.cursor).toBeUndefined();
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
    expect(ddbMock.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual(lek);
  });

  it("returns and accepts a JSON cursor for limited queries", async () => {
    const lek = {
      gsi1pk: "$vcm#type_article",
      gsi1sk: "$news_1#updatedat_2024-01-01t00:00:00.000z",
      pk: "$vcm#id_x",
      sk: "$news_1",
    };
    ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: lek });

    const client = createClient();
    const first = await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
      limit: 5,
    });

    expect(first.cursor).toBe(JSON.stringify(lek));

    ddbMock.resetHistory();
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await client.query({
      indexName: ContentTableIndexes.gsi1,
      partition: { type: "article" },
      limit: 5,
      cursor: first.cursor ?? undefined,
    });

    expect(ddbMock.commandCalls(QueryCommand)[0]?.args[0].input.ExclusiveStartKey).toEqual(lek);
  });

  it("fails when Zod parse fails on read", async () => {
    const key = primaryKeyFor(sampleItem());
    ddbMock.on(GetCommand).resolves({
      Item: {
        ...key,
        id: "11111111-1111-1111-1111-111111111111",
        type: "article",
        title: "Hello",
        status: "not-a-valid-status",
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-20T12:30:00.000Z",
      },
    });

    const client = createClient();
    await expect(client.get({ id: sampleItem().id })).rejects.toThrow(
      /Failed to parse DynamoDB item/,
    );
  });

  it("deletes by primary key", async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const item = sampleItem();
    const client = createClient();

    await client.delete({ id: item.id });

    expect(ddbMock.commandCalls(DeleteCommand)[0]?.args[0].input.Key).toEqual(primaryKeyFor(item));
  });
});
