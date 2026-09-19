import { describe, expect, it } from "vite-plus/test";
import { samsProjectionMatchSchema } from "@/lib/db/schemas";

describe("samsProjectionMatchSchema location address fields", () => {
  it("accepts optional street, postal, and city on location", () => {
    const parsed = samsProjectionMatchSchema.parse({
      uuid: "match-1",
      team1: { uuid: "t1", name: "Home" },
      team2: { uuid: "t2", name: "Away" },
      hasResult: false,
      location: {
        uuid: "loc-1",
        name: "Arena",
        street: "Hauptstraße 1",
        postal: "79379",
        city: "Müllheim",
      },
    });

    expect(parsed.location).toEqual({
      uuid: "loc-1",
      name: "Arena",
      street: "Hauptstraße 1",
      postal: "79379",
      city: "Müllheim",
    });
  });
});
