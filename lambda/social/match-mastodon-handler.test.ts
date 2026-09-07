import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../utils/sentry", () => ({
  Sentry: {
    wrapHandler: vi.fn((fn) => fn),
    captureException: vi.fn(),
  },
}));

const claimMock = vi.fn();
const getMock = vi.fn();
const shareMatchMock = vi.fn();

vi.mock("@/lib/db/match-mastodon-share-repository", () => ({
  MatchMastodonShareRepository: class {
    claim = claimMock;
    get = getMock;
    markPosted = vi.fn();
  },
}));

vi.mock("./mastodon-share", () => ({
  shareMatchToMastodon: (...args: unknown[]) => shareMatchMock(...args),
}));

process.env.SOCIAL_TABLE_NAME = "test-social-table";
process.env.MASTODON_ACCESS_TOKEN = "test-token";
process.env.CDK_ENVIRONMENT = "prod";

const matchPayload = {
  match: {
    uuid: "match-1",
    hasResult: true,
    team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: "club-a" },
    team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
    result: { winner: "t1", setPoints: "3:0" },
  },
  configuredSportsclubUuids: ["club-a"],
};

describe("processMatchMastodonShareMessage", () => {
  beforeEach(() => {
    claimMock.mockReset();
    getMock.mockReset();
    shareMatchMock.mockReset();
    shareMatchMock.mockResolvedValue({ id: "status-1" });
  });

  it("skips posting outside prod without calling share", async () => {
    const { processMatchMastodonShareMessage } = await import("./match-mastodon-handler");

    await processMatchMastodonShareMessage(JSON.stringify(matchPayload), {
      environment: "dev",
      shareMatch: shareMatchMock,
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(shareMatchMock).not.toHaveBeenCalled();
  });

  it("claims and posts in prod when pending", async () => {
    getMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: "pending" });
    claimMock.mockResolvedValue(true);

    const { processMatchMastodonShareMessage } = await import("./match-mastodon-handler");

    await processMatchMastodonShareMessage(JSON.stringify(matchPayload), {
      environment: "prod",
      socialTableName: "test-social-table",
    });

    expect(claimMock).toHaveBeenCalledWith("match-1");
    expect(shareMatchMock).toHaveBeenCalledOnce();
    expect(shareMatchMock.mock.calls[0]?.[0].match.uuid).toBe("match-1");
  });

  it("skips post when already posted", async () => {
    getMock.mockResolvedValue({ status: "posted" });

    const { processMatchMastodonShareMessage } = await import("./match-mastodon-handler");

    await processMatchMastodonShareMessage(JSON.stringify(matchPayload), {
      environment: "prod",
      socialTableName: "test-social-table",
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(shareMatchMock).not.toHaveBeenCalled();
  });
});
