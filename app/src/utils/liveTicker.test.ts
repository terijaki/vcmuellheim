import { describe, expect, it } from "vite-plus/test";
import type { LiveMatch } from "@/lambda/sams/types";
import {
  getLiveTickerScoreDisplay,
  toLiveTickerDisplayMatches,
  type LiveTickerDisplayMatch,
} from "./liveTicker";

const OUR_UUID = "team-ours";
const THEIR_UUID = "team-theirs";
const ourTeamUuids = new Set([OUR_UUID]);

const makeMatch = (overrides: Partial<LiveMatch> = {}): LiveMatch => ({
  matchUuid: "match-1",
  team1Uuid: OUR_UUID,
  team2Uuid: THEIR_UUID,
  team1Name: "VC Müllheim",
  team2Name: "Other Team",
  state: {
    started: true,
    finished: false,
    setPoints: { team1: 0, team2: 0 },
    matchSets: [],
  },
  ...overrides,
});

describe("toLiveTickerDisplayMatches", () => {
  it("filters out matches where neither team is ours", () => {
    const match = makeMatch({ team1Uuid: "other-1", team2Uuid: "other-2" });
    const result = toLiveTickerDisplayMatches({ liveMatches: [match], ourTeamUuids });
    expect(result).toHaveLength(0);
  });

  it("includes match where team1 is ours", () => {
    const match = makeMatch({ team1Uuid: OUR_UUID });
    const result = toLiveTickerDisplayMatches({ liveMatches: [match], ourTeamUuids });
    expect(result).toHaveLength(1);
  });

  it("includes match where team2 is ours", () => {
    const match = makeMatch({ team1Uuid: THEIR_UUID, team2Uuid: OUR_UUID });
    const result = toLiveTickerDisplayMatches({ liveMatches: [match], ourTeamUuids });
    expect(result).toHaveLength(1);
  });

  it("formats setPointsText correctly", () => {
    const match = makeMatch({
      state: { started: true, finished: false, setPoints: { team1: 2, team2: 1 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.setPointsText).toBe("2:1");
  });

  it("exposes individual set point counts", () => {
    const match = makeMatch({
      state: { started: true, finished: false, setPoints: { team1: 3, team2: 2 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.team1SetPoints).toBe(3);
    expect(result?.team2SetPoints).toBe(2);
  });

  it("sets isFinished from match state", () => {
    const match = makeMatch({
      state: { started: true, finished: true, setPoints: { team1: 3, team2: 1 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.isFinished).toBe(true);
  });

  it("weAreWinning is true when team1 is ours and we lead on sets", () => {
    const match = makeMatch({
      state: { started: true, finished: false, setPoints: { team1: 2, team2: 1 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.weAreWinning).toBe(true);
  });

  it("weAreWinning is false when team2 is ours and opponent leads on sets", () => {
    const match = makeMatch({
      team1Uuid: THEIR_UUID,
      team2Uuid: OUR_UUID,
      state: { started: true, finished: false, setPoints: { team1: 2, team2: 1 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.weAreWinning).toBe(false);
  });

  it("sorts set scores by setNumber ascending", () => {
    const match = makeMatch({
      state: {
        started: true,
        finished: false,
        setPoints: { team1: 2, team2: 1 },
        matchSets: [
          { setNumber: 3, setScore: { team1: 25, team2: 20 } },
          { setNumber: 1, setScore: { team1: 25, team2: 15 } },
          { setNumber: 2, setScore: { team1: 20, team2: 25 } },
        ],
      },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.setScores.map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it("sets activeSetNumber to the last set number when not finished", () => {
    const match = makeMatch({
      state: {
        started: true,
        finished: false,
        setPoints: { team1: 1, team2: 0 },
        matchSets: [
          { setNumber: 1, setScore: { team1: 25, team2: 15 } },
          { setNumber: 2, setScore: { team1: 12, team2: 8 } },
        ],
      },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.activeSetNumber).toBe(2);
  });

  it("sets activeSetNumber to null when match is finished", () => {
    const match = makeMatch({
      state: {
        started: true,
        finished: true,
        setPoints: { team1: 3, team2: 1 },
        matchSets: [{ setNumber: 4, setScore: { team1: 15, team2: 10 } }],
      },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.activeSetNumber).toBeNull();
  });

  it("sets activeSetNumber to null when matchSets is empty", () => {
    const match = makeMatch({
      state: { started: true, finished: false, setPoints: { team1: 0, team2: 0 }, matchSets: [] },
    });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.activeSetNumber).toBeNull();
  });

  it("uses team name directly from match", () => {
    const match = makeMatch({ team1Name: "VC Müllheim 1", team2Name: "Gegner 2" });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.team1Name).toBe("VC Müllheim 1");
    expect(result?.team2Name).toBe("Gegner 2");
  });

  it("passes through team UUIDs for logo proxy lookup", () => {
    const match = makeMatch({ team1Name: "VC Müllheim 1", team2Name: "Mighty Ducks 2" });
    const [result] = toLiveTickerDisplayMatches({
      liveMatches: [match],
      ourTeamUuids,
    });
    expect(result?.team1Uuid).toBe(OUR_UUID);
    expect(result?.team2Uuid).toBe(THEIR_UUID);
  });
});

describe("getLiveTickerScoreDisplay", () => {
  const baseDisplay = (
    overrides: Partial<LiveTickerDisplayMatch> = {},
  ): LiveTickerDisplayMatch => ({
    matchUuid: "match-1",
    team1Uuid: "team-a",
    team2Uuid: "team-b",
    team1Name: "Team A",
    team2Name: "Team B",
    setPointsText: "0:0",
    team1SetPoints: 0,
    team2SetPoints: 0,
    setScores: [{ setNumber: 1, team1Score: 11, team2Score: 11 }],
    activeSetNumber: 1,
    isFinished: false,
    weAreWinning: false,
    ...overrides,
  });

  it("shows points large and sets small while the match is ongoing", () => {
    expect(getLiveTickerScoreDisplay(baseDisplay())).toEqual({
      primaryText: "11:11",
      secondaryText: "0:0",
    });
  });

  it("shows only set scores when the match is finished", () => {
    expect(
      getLiveTickerScoreDisplay(
        baseDisplay({
          setPointsText: "3:1",
          team1SetPoints: 3,
          team2SetPoints: 1,
          activeSetNumber: null,
          isFinished: true,
          setScores: [
            { setNumber: 1, team1Score: 25, team2Score: 20 },
            { setNumber: 2, team1Score: 20, team2Score: 25 },
            { setNumber: 3, team1Score: 25, team2Score: 18 },
            { setNumber: 4, team1Score: 25, team2Score: 22 },
          ],
        }),
      ),
    ).toEqual({
      primaryText: "3:1",
      secondaryText: null,
    });
  });

  it("shows only set scores when there is no active set yet", () => {
    expect(
      getLiveTickerScoreDisplay(
        baseDisplay({
          setScores: [],
          activeSetNumber: null,
        }),
      ),
    ).toEqual({
      primaryText: "0:0",
      secondaryText: null,
    });
  });
});
