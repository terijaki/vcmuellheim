import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { zodValidationDetails, zodValidationMessage } from "./admin-api-errors";

describe("admin API validation errors", () => {
  it("formats zod issues with paths", () => {
    const result = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    if (result.success) throw new Error("expected failure");
    expect(zodValidationMessage(result.error)).toContain("title:");
    expect(zodValidationDetails(result.error)[0]).toMatchObject({ path: "title" });
  });
});
