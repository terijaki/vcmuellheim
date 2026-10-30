import { describe, expect, it } from "vite-plus/test";
import { ContentTableIndexes, SamsTableIndexes } from "./table-indexes";

describe("DynamoDB index name constants", () => {
  it("content table exposes only GSI1", () => {
    expect(ContentTableIndexes.gsi1).toBe("GSI1-ByTypeAndDate");
    expect(Object.keys(ContentTableIndexes)).toEqual(["table", "gsi1"]);
  });

  it("SAMS table GSI keeps CDK physical name", () => {
    expect(SamsTableIndexes.gsi1).toBe("GSI1-BySamsType");
  });
});
