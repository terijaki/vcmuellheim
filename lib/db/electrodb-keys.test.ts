/**
 * Lock ElectroDB key bytes: build items with ElectroDB, then assert the key
 * builder reproduces the same `pk`, `sk`, and `gsi*` attributes.
 */

import { describe, expect, it } from "vite-plus/test";
import { ContentTableIndexes } from "./electrodb-entities";
import {
  MemberEntity,
  NewsEntity,
  PublicSnapshotEntity,
  VolunteerSignupEntity,
} from "./electrodb-entities";
import { buildElectroDbEntitySortKey, buildElectroDbServicePartitionKey } from "./electrodb-keys";
import {
  AppTermineMatchEntity,
  SamsClubEntity,
  SamsScheduleEntity,
  SamsTableIndexes,
} from "./sams-electrodb-entities";

const ORACLE_TABLE = "electrodb-key-oracle-table";

const GSI_KEY_FIELD = /^gsi\d+(pk|sk)$/;

function extractElectroDbKeyFields(item: Record<string, string>): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [field, value] of Object.entries(item)) {
    if (field === "pk" || field === "sk" || GSI_KEY_FIELD.test(field)) {
      keys[field] = value;
    }
  }
  return keys;
}

function oracleKeyFields<T extends Record<string, unknown>>(
  entity: {
    create: (data: T) => {
      params: (options: { table: string }) => { Item: Record<string, string> };
    };
  },
  data: T,
): Record<string, string> {
  const item = entity.create(data).params({ table: ORACLE_TABLE }).Item;
  return extractElectroDbKeyFields(item);
}

function expectKeysMatchBuilder(
  oracle: Record<string, string>,
  builder: Record<string, string>,
): void {
  expect(builder).toEqual(oracle);
}

describe("ElectroDB key builder primitives", () => {
  it("uses the entity facet alone when the sort-key composite is empty", () => {
    expect(buildElectroDbEntitySortKey("news", [])).toBe("$news_1");
  });

  it("chains multi-part sort-key segments after the entity facet", () => {
    expect(
      buildElectroDbEntitySortKey("volunteerSignup", [
        { attribute: "shiftId", value: "shift-1" },
        { attribute: "id", value: "signup-id" },
      ]),
    ).toBe("$volunteersignup_1#shiftid_shift-1#id_signup-id");
  });
});

describe("ElectroDB key builder ↔ ElectroDB oracle", () => {
  it("news article keys (id, type+updatedAt, status+createdAt, slug)", () => {
    const fixture = {
      id: "11111111-1111-1111-1111-111111111111",
      title: "Title",
      slug: "My-Slug",
      content: "Body",
      status: "published" as const,
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-20T12:30:00.000Z",
    };
    const oracle = oracleKeyFields(NewsEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([{ attribute: "id", value: fixture.id }]),
      sk: buildElectroDbEntitySortKey("news", []),
      gsi1pk: buildElectroDbServicePartitionKey([{ attribute: "type", value: "article" }]),
      gsi1sk: buildElectroDbEntitySortKey("news", [
        { attribute: "updatedAt", value: fixture.updatedAt },
      ]),
      gsi2pk: buildElectroDbServicePartitionKey([{ attribute: "status", value: fixture.status }]),
      gsi2sk: buildElectroDbEntitySortKey("news", [
        { attribute: "createdAt", value: fixture.createdAt },
      ]),
      gsi3pk: buildElectroDbServicePartitionKey([{ attribute: "slug", value: fixture.slug }]),
      gsi3sk: buildElectroDbEntitySortKey("news", []),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("member keys with private and proxy email (untrimmed private email in GSI5)", () => {
    const fixture = {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Member Name",
      privateEmail: "  untrimmed@test.com  ",
      proxyEmail: "proxy@test.com",
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-20T12:30:00.000Z",
    };
    const oracle = oracleKeyFields(MemberEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([{ attribute: "id", value: fixture.id }]),
      sk: buildElectroDbEntitySortKey("member", []),
      gsi1pk: buildElectroDbServicePartitionKey([{ attribute: "type", value: "member" }]),
      gsi1sk: buildElectroDbEntitySortKey("member", [
        { attribute: "updatedAt", value: fixture.updatedAt },
      ]),
      gsi4pk: buildElectroDbServicePartitionKey([
        { attribute: "proxyEmail", value: fixture.proxyEmail },
      ]),
      gsi4sk: buildElectroDbEntitySortKey("member", []),
      gsi5pk: buildElectroDbServicePartitionKey([
        { attribute: "privateEmail", value: fixture.privateEmail },
      ]),
      gsi5sk: buildElectroDbEntitySortKey("member", []),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("volunteer signup keys (event id GSI, shift id and id sort key)", () => {
    const fixture = {
      id: "33333333-3333-3333-3333-333333333333",
      eventId: "evt-1",
      shiftId: "shift-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      dateOfBirth: "2000-01-01",
      preferredRoleIds: ["role-1"],
      status: "pending" as const,
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-20T12:30:00.000Z",
    };
    const oracle = oracleKeyFields(VolunteerSignupEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([{ attribute: "id", value: fixture.id }]),
      sk: buildElectroDbEntitySortKey("volunteerSignup", []),
      gsi6pk: buildElectroDbServicePartitionKey([{ attribute: "eventId", value: fixture.eventId }]),
      gsi6sk: buildElectroDbEntitySortKey("volunteerSignup", [
        { attribute: "shiftId", value: fixture.shiftId },
        { attribute: "id", value: fixture.id },
      ]),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("public snapshot keys (section as table partition key)", () => {
    const fixture = {
      section: "news" as const,
      payload: { items: [] },
      updatedAt: "2024-01-20T12:30:00.000Z",
    };
    const oracle = oracleKeyFields(PublicSnapshotEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([{ attribute: "section", value: fixture.section }]),
      sk: buildElectroDbEntitySortKey("publicsnapshot", []),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("SAMS club keys (sportsclub uuid, type plus name slug GSI)", () => {
    const fixture = {
      sportsclubUuid: "44444444-4444-4444-4444-444444444444",
      name: "Example Club",
      nameSlug: "my-club",
      updatedAt: "2024-01-20T12:30:00.000Z",
      ttl: 1_700_000_000,
    };
    const oracle = oracleKeyFields(SamsClubEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([
        { attribute: "sportsclubUuid", value: fixture.sportsclubUuid },
      ]),
      sk: buildElectroDbEntitySortKey("samsclub", []),
      gsi1pk: buildElectroDbServicePartitionKey([{ attribute: "type", value: "club" }]),
      gsi1sk: buildElectroDbEntitySortKey("samsclub", [
        { attribute: "nameSlug", value: fixture.nameSlug },
      ]),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("SAMS schedule keys (sportsclub uuid plus season uuid sort key)", () => {
    const fixture = {
      sportsclubUuid: "44444444-4444-4444-4444-444444444444",
      seasonUuid: "55555555-5555-5555-5555-555555555555",
      matches: [],
      snapshotVersion: "v1",
      updatedAt: "2024-01-20T12:30:00.000Z",
      ttl: 1_700_000_000,
    };
    const oracle = oracleKeyFields(SamsScheduleEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([
        { attribute: "sportsclubUuid", value: fixture.sportsclubUuid },
      ]),
      sk: buildElectroDbEntitySortKey("samsschedule", [
        { attribute: "seasonUuid", value: fixture.seasonUuid },
      ]),
    };

    expectKeysMatchBuilder(oracle, built);
  });

  it("app-termine row keys (dataset id plus match sort key)", () => {
    const fixture = {
      datasetId: "current",
      matchSortKey: "2024-03-01#match-uuid",
      matchUuid: "66666666-6666-6666-6666-666666666666",
      team1: { name: "Home" },
      team2: { name: "Away" },
      hasResult: false,
      isHomeGame: true,
      ownedTeamUuids: [],
      updatedAt: "2024-01-20T12:30:00.000Z",
      ttl: 1_700_000_000,
    };
    const oracle = oracleKeyFields(AppTermineMatchEntity, fixture);

    const built = {
      pk: buildElectroDbServicePartitionKey([{ attribute: "datasetId", value: fixture.datasetId }]),
      sk: buildElectroDbEntitySortKey("apptermine", [
        { attribute: "matchSortKey", value: fixture.matchSortKey },
      ]),
    };

    expectKeysMatchBuilder(oracle, built);
  });
});

describe("ElectroDB index name constants", () => {
  it("content table GSIs keep CDK physical names", () => {
    expect(ContentTableIndexes.gsi1).toBe("GSI1-ByTypeAndDate");
    expect(ContentTableIndexes.gsi2).toBe("GSI2-ByStatus");
    expect(ContentTableIndexes.gsi3).toBe("GSI3-BySlug");
    expect(ContentTableIndexes.gsi4).toBe("GSI4-ByIdentifier");
    expect(ContentTableIndexes.gsi5).toBe("GSI5-ByPrivateEmail");
    expect(ContentTableIndexes.gsi6).toBe("GSI6-ByEventId");
  });

  it("SAMS table GSI keeps CDK physical name", () => {
    expect(SamsTableIndexes.gsi1).toBe("GSI1-BySamsType");
  });
});
