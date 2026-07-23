import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("./sams-match-loader.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sams-match-loader.server")>();
  return {
    ...actual,
    resolveSamsMatchesForSsr: vi.fn(),
    resolveSamsMatchesEffectiveInput: vi.fn(),
  };
});

import {
  resolveSamsMatchesEffectiveInput,
  resolveSamsMatchesForSsr,
} from "./sams-match-loader.server";
import { handleLoadSamsMatchesForSsr } from "./sams.server";

const mockResolveSamsMatchesForSsr = vi.mocked(resolveSamsMatchesForSsr);
const mockResolveSamsMatchesEffectiveInput = vi.mocked(resolveSamsMatchesEffectiveInput);

describe("handleLoadSamsMatchesForSsr", () => {
  beforeEach(() => {
    mockResolveSamsMatchesForSsr.mockReset();
    mockResolveSamsMatchesEffectiveInput.mockReset();
  });

  it("returns hookOptions from a successful cache peek", async () => {
    mockResolveSamsMatchesForSsr.mockResolvedValue({
      cached: { matches: [], timestamp: "2026-07-21T08:00:00.000Z" },
      effectiveInput: { range: "future", season: "season-synced" },
    });

    const result = await handleLoadSamsMatchesForSsr({ range: "future" });

    expect(result.hookOptions).toMatchObject({
      range: "future",
      season: "season-synced",
      initialData: { matches: [], timestamp: "2026-07-21T08:00:00.000Z" },
    });
    expect(mockResolveSamsMatchesEffectiveInput).not.toHaveBeenCalled();
  });

  it("falls back to effective input when cache peek throws", async () => {
    mockResolveSamsMatchesForSsr.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockResolveSamsMatchesEffectiveInput.mockResolvedValue({
      range: "past",
      limit: 10,
      season: "season-synced",
    });

    const result = await handleLoadSamsMatchesForSsr({ range: "past", limit: 10 });

    expect(mockResolveSamsMatchesEffectiveInput).toHaveBeenCalledWith({ range: "past", limit: 10 });
    expect(result.cached).toBeUndefined();
    expect(result.hookOptions).toMatchObject({
      range: "past",
      limit: 10,
      season: "season-synced",
    });
  });

  it("uses raw input when cache peek and effective input resolution both fail", async () => {
    mockResolveSamsMatchesForSsr.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockResolveSamsMatchesEffectiveInput.mockResolvedValue(null);

    const result = await handleLoadSamsMatchesForSsr({ team: "team-1" });

    expect(result.hookOptions).toMatchObject({ team: "team-1" });
    expect(result.cached).toBeUndefined();
  });
});
