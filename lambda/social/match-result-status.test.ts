import { describe, expect, it } from "vite-plus/test";
import {
  EMOJI_POOLS,
  LOSS_TEMPLATES,
  WIN_TEMPLATES,
  buildMatchResultStatus,
  type MatchForStatus,
  type StringPicker,
} from "./match-result-status";

const CLUB_A = "club-a";
const CLUB_B = "club-b";
const OTHER = "other";
const CONFIGURED = new Set([CLUB_A, CLUB_B]);

function fixedPicker(index: number): StringPicker {
  return (items) => {
    if (items.length === 0) throw new Error("empty");
    return items[index % items.length]!;
  };
}

function constantPicker(value: string): StringPicker {
  return () => value;
}

function baseMatch(overrides?: Partial<MatchForStatus>): MatchForStatus {
  return {
    team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: CLUB_A },
    team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: OTHER },
    result: {
      winner: "t1",
      setPoints: "3:0",
      sets: [
        { number: 1, ballPoints: "25:20" },
        { number: 2, ballPoints: "25:18" },
        { number: 3, ballPoints: "25:16" },
      ],
    },
    ...overrides,
  };
}

describe("buildMatchResultStatus", () => {
  it("interpolates each win template correctly", () => {
    for (let i = 0; i < WIN_TEMPLATES.length; i++) {
      const status = buildMatchResultStatus(baseMatch(), CONFIGURED, {
        pickTemplate: fixedPicker(i),
        pickEmoji: constantPicker("🔥"),
      });
      const expectedBody = WIN_TEMPLATES[i]!.replaceAll("{our}", "VC Müllheim 1")
        .replaceAll("{opp}", "TV Foo")
        .replaceAll("{score}", "3:0");
      expect(status).toContain(expectedBody);
      expect(status?.startsWith("🔥 ")).toBe(true);
    }
  });

  it("interpolates each loss template correctly", () => {
    const lossMatch = baseMatch({
      result: {
        winner: "t2",
        setPoints: "0:3",
        sets: [
          { number: 1, ballPoints: "20:25" },
          { number: 2, ballPoints: "18:25" },
          { number: 3, ballPoints: "16:25" },
        ],
      },
    });

    for (let i = 0; i < LOSS_TEMPLATES.length; i++) {
      const status = buildMatchResultStatus(lossMatch, CONFIGURED, {
        pickTemplate: fixedPicker(i),
        pickEmoji: constantPicker("🌧️"),
      });
      const expectedBody = LOSS_TEMPLATES[i]!.replaceAll("{our}", "VC Müllheim 1")
        .replaceAll("{opp}", "TV Foo")
        .replaceAll("{score}", "0:3");
      expect(status).toContain(expectedBody);
    }
  });

  it("picks emoji only from the oriented score pool", () => {
    const cases: Array<{ setPoints: string; poolKey: string }> = [
      { setPoints: "3:0", poolKey: "3:0" },
      { setPoints: "3:1", poolKey: "3:1" },
      { setPoints: "3:2", poolKey: "3:2" },
      { setPoints: "2:3", poolKey: "2:3" },
      { setPoints: "1:3", poolKey: "1:3" },
      { setPoints: "0:3", poolKey: "0:3" },
    ];

    for (const { setPoints, poolKey } of cases) {
      const seen = new Set<string>();
      const pool = EMOJI_POOLS[poolKey]!;
      for (let i = 0; i < pool.length; i++) {
        const [our, opp] = setPoints.split(":").map(Number) as [number, number];
        const status = buildMatchResultStatus(
          baseMatch({
            result: {
              winner: our > opp ? "t1" : "t2",
              setPoints,
            },
          }),
          CONFIGURED,
          {
            pickTemplate: fixedPicker(0),
            pickEmoji: fixedPicker(i),
          },
        );
        const emoji = status?.split(" ")[0] ?? "";
        expect(pool).toContain(emoji);
        seen.add(emoji);
      }
      expect(seen.size).toBe(pool.length);
    }
  });

  it("flips score and set ball points when our team is team2", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        team1: { uuid: "t2", name: "TV Foo", sportsclubUuid: OTHER },
        team2: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: CLUB_A },
        result: {
          winner: "t1",
          setPoints: "1:3",
          sets: [
            { number: 1, ballPoints: "20:25" },
            { number: 2, ballPoints: "18:25" },
            { number: 3, ballPoints: "16:25" },
          ],
        },
      }),
      CONFIGURED,
      { pickTemplate: fixedPicker(0), pickEmoji: constantPicker("🏆") },
    );

    expect(status).toBe("🏆 VC Müllheim 1 gewinnt 3:1 gegen TV Foo\n\nSätze: 25:20, 25:18, 25:16");
  });

  it("frames both-configured matches from the winner", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: CLUB_A },
        team2: { uuid: "t2", name: "Markgräfler Volleys 1", sportsclubUuid: CLUB_B },
        result: {
          winner: "t2",
          setPoints: "1:3",
        },
      }),
      CONFIGURED,
      { pickTemplate: fixedPicker(0), pickEmoji: constantPicker("🏆") },
    );

    expect(status).toContain("Markgräfler Volleys 1 gewinnt 3:1 gegen VC Müllheim 1");
  });

  it("uses neutral fallback without emoji when outcome is unknown", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        result: {
          setPoints: undefined,
          winner: undefined,
          sets: [{ number: 1, ballPoints: "25:20" }],
        },
      }),
      CONFIGURED,
    );

    expect(status).toBe("VC Müllheim 1 – TV Foo\n\nSätze: 25:20");
    expect(status?.startsWith("VC Müllheim")).toBe(true);
  });

  it("omits sets line when ball points are absent", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        result: {
          winner: "t1",
          setPoints: "3:1",
          sets: [{ number: 1 }, { number: 2 }],
        },
      }),
      CONFIGURED,
      { pickTemplate: fixedPicker(0), pickEmoji: constantPicker("🏆") },
    );

    expect(status).toBe("🏆 VC Müllheim 1 gewinnt 3:1 gegen TV Foo");
    expect(status).not.toContain("Sätze:");
  });

  it("uses winner when setPoints are missing", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        result: {
          winner: "t2",
          setPoints: undefined,
        },
      }),
      CONFIGURED,
      { pickTemplate: fixedPicker(2), pickEmoji: constantPicker("😔") },
    );

    expect(status).toBe("😔 VC Müllheim 1 verliert gegen TV Foo");
  });

  it("returns null when no configured club is involved", () => {
    const status = buildMatchResultStatus(
      baseMatch({
        team1: { uuid: "t1", name: "A", sportsclubUuid: OTHER },
        team2: { uuid: "t2", name: "B", sportsclubUuid: "x" },
      }),
      CONFIGURED,
    );
    expect(status).toBeNull();
  });
});
