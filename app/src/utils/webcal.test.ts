import { describe, expect, it } from "vite-plus/test";
import { createWebcalLink } from "./webcal";

describe("createWebcalLink", () => {
  it("produces a webcal link with a leading slash path", () => {
    expect(createWebcalLink("/ics/calendar.ics")).toBe("webcal://vcmuellheim.de/ics/calendar.ics");
  });

  it("adds a leading slash when path has none", () => {
    expect(createWebcalLink("ics/calendar.ics")).toBe("webcal://vcmuellheim.de/ics/calendar.ics");
  });

  it("handles root path", () => {
    expect(createWebcalLink("/")).toBe("webcal://vcmuellheim.de/");
  });
});
