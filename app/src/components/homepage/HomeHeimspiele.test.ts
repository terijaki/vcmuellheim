import { describe, expect, it } from "vite-plus/test";
import { shouldShowNoHeimspiele } from "./HomeHeimspiele";

describe("shouldShowNoHeimspiele", () => {
  it("stays hidden while data is still loading", () => {
    expect(shouldShowNoHeimspiele({ isLoading: true, matchCount: 0, eventCount: 0 })).toBe(false);
  });

  it("shows the empty copy only after both answers are empty", () => {
    expect(shouldShowNoHeimspiele({ isLoading: false, matchCount: 0, eventCount: 0 })).toBe(true);
    expect(shouldShowNoHeimspiele({ isLoading: false, matchCount: 1, eventCount: 0 })).toBe(false);
  });
});
