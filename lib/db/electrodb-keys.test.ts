/**
 * ElectroDB key bytes (migration-only) and shared table index constants.
 */

import { describe, expect, it } from "vite-plus/test";
import { ContentTableIndexes, SamsTableIndexes } from "./table-indexes";
import { buildElectroDbEntitySortKey, buildElectroDbServicePartitionKey } from "./electrodb-keys";

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

  it("builds service partition keys for migration deletes", () => {
    expect(buildElectroDbServicePartitionKey([{ attribute: "id", value: "abc" }])).toBe(
      "$vcm#id_abc",
    );
  });
});

describe("DynamoDB index name constants", () => {
  it("content table exposes only GSI1", () => {
    expect(ContentTableIndexes.gsi1).toBe("GSI1-ByTypeAndDate");
    expect(Object.keys(ContentTableIndexes)).toEqual(["table", "gsi1"]);
  });

  it("SAMS table GSI keeps CDK physical name", () => {
    expect(SamsTableIndexes.gsi1).toBe("GSI1-BySamsType");
  });
});
