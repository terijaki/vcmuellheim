import { describe, expect, it } from "vite-plus/test";
import { buildMapsSearchUrl } from "./build-maps-search-url";

describe("buildMapsSearchUrl", () => {
  it("includes street, postal, and city in the Google maps query", () => {
    const url = buildMapsSearchUrl(
      {
        name: "Arena Example",
        street: "Musterstraße 12",
        postal: "79379",
        city: "Müllheim",
      },
      "google",
    );

    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    const query = decodeURIComponent(url.split("query=")[1] ?? "");
    expect(query).toBe("Arena Example, Musterstraße 12, 79379 Müllheim");
  });

  it("includes street, postal, and city in the Apple maps query", () => {
    const url = buildMapsSearchUrl(
      {
        name: "Arena Example",
        street: "Musterstraße 12",
        postal: "79379",
        city: "Müllheim",
      },
      "apple",
    );

    expect(url.startsWith("https://maps.apple.com/?q=")).toBe(true);
    const query = decodeURIComponent(url.split("q=")[1] ?? "");
    expect(query).toBe("Arena Example, Musterstraße 12, 79379 Müllheim");
  });
});
