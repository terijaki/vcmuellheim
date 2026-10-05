import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { SeedContext } from "./common";

const { writePostsMock, createBeholdFeedRepositoryMock } = vi.hoisted(() => {
  const writePostsMock = vi.fn();
  const createBeholdFeedRepositoryMock = vi.fn(() => ({
    writePosts: writePostsMock,
  }));
  return { writePostsMock, createBeholdFeedRepositoryMock };
});

vi.mock("@/lib/social/behold-feed", () => ({
  createBeholdFeedRepository: createBeholdFeedRepositoryMock,
}));

import { seedInstagramData } from "./instagram";

describe("seedInstagramData", () => {
  beforeEach(() => {
    writePostsMock.mockReset();
    writePostsMock.mockResolvedValue(undefined);
    createBeholdFeedRepositoryMock.mockClear();
  });

  it("writes two recent Behold posts to the social feed", async () => {
    const docClient = {} as SeedContext["docClient"];
    const ctx = {
      socialTableName: "vcm-social-dev-test",
      docClient,
    } as SeedContext;

    await seedInstagramData(ctx);

    expect(createBeholdFeedRepositoryMock).toHaveBeenCalledWith(docClient, "vcm-social-dev-test");
    expect(writePostsMock).toHaveBeenCalledTimes(1);

    const [posts, ttlSeconds] = writePostsMock.mock.calls[0] as [
      Array<{ id: string; mediaType: string; timestamp: string }>,
      number,
    ];
    expect(posts).toHaveLength(2);
    expect(posts.every((post) => post.mediaType === "IMAGE")).toBe(true);
    expect(ttlSeconds).toBe(90 * 24 * 60 * 60);

    const newest = Date.parse(posts[0].timestamp);
    const oldest = Date.parse(posts[1].timestamp);
    expect(newest).toBeGreaterThan(oldest);
    expect(Date.now() - newest).toBeLessThan(14 * 24 * 60 * 60 * 1000);
  });

  it("requires socialTableName", async () => {
    await expect(
      seedInstagramData({ socialTableName: "", docClient: {} } as SeedContext),
    ).rejects.toThrow(/socialTableName/);
  });
});
