import { describe, expect, it } from "vite-plus/test";
import { formatSamsMatchLocationLine } from "./format-sams-match-location";

describe("formatSamsMatchLocationLine", () => {
  it("returns empty string when location is undefined", () => {
    expect(formatSamsMatchLocationLine(undefined)).toBe("");
  });

  it("formats name only when no address parts", () => {
    expect(formatSamsMatchLocationLine({ name: "Sporthalle Nord" })).toBe("Sporthalle Nord");
  });

  it("formats full address aligned with MapsLink composition", () => {
    expect(
      formatSamsMatchLocationLine({
        name: "Arena Example",
        street: "Musterstraße 12",
        postal: "79379",
        city: "Müllheim",
      }),
    ).toBe("Arena Example, Musterstraße 12, 79379 Müllheim");
  });

  it("trims whitespace and omits empty fields", () => {
    expect(
      formatSamsMatchLocationLine({
        name: "  Halle  ",
        street: "",
        postal: "79379",
        city: "  Müllheim ",
      }),
    ).toBe("Halle, 79379 Müllheim");
  });
});
