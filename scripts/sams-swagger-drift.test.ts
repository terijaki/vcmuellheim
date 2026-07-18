import { describe, expect, it } from "vite-plus/test";
import {
  buildSwaggerDriftSection,
  compareSwaggerSnapshots,
  formatDriftSummaryMarkdown,
  formatGithubOutputFile,
  formatGithubStepSummary,
  jsonEqualIgnoringKeyOrder,
} from "./sams-swagger-drift";

describe("jsonEqualIgnoringKeyOrder", () => {
  it("treats objects with the same keys and values as equal regardless of key order", () => {
    expect(
      jsonEqualIgnoringKeyOrder(
        { delayPossible: true, indefinitelyRescheduled: false },
        { indefinitelyRescheduled: false, delayPossible: true },
      ),
    ).toBe(true);
  });

  it("reports inequality when a value differs", () => {
    expect(
      jsonEqualIgnoringKeyOrder(
        { delayPossible: true, indefinitelyRescheduled: false },
        { delayPossible: false, indefinitelyRescheduled: false },
      ),
    ).toBe(false);
  });
});

describe("compareSwaggerSnapshots", () => {
  it("reports no drift when only object key order differs", () => {
    const committed = JSON.stringify({
      components: {
        schemas: {
          MatchStatus: {
            properties: {
              indefinitelyRescheduled: { type: "boolean" },
              delayPossible: { type: "boolean" },
            },
          },
        },
      },
    });
    const regenerated = JSON.stringify({
      components: {
        schemas: {
          MatchStatus: {
            properties: {
              delayPossible: { type: "boolean" },
              indefinitelyRescheduled: { type: "boolean" },
            },
          },
        },
      },
    });

    const result = compareSwaggerSnapshots(committed, regenerated);

    expect(result.hasDrift).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it("reports drift with concrete paths when a property value changes", () => {
    const committed = JSON.stringify({
      components: {
        schemas: {
          MatchStatus: {
            properties: {
              delayPossible: { type: "boolean" },
            },
          },
        },
      },
    });
    const regenerated = JSON.stringify({
      components: {
        schemas: {
          MatchStatus: {
            properties: {
              delayPossible: { type: "string" },
            },
          },
        },
      },
    });

    const result = compareSwaggerSnapshots(committed, regenerated);

    expect(result.hasDrift).toBe(true);
    expect(result.changes).toEqual([
      {
        kind: "changed",
        path: "components.schemas.MatchStatus.properties.delayPossible.type",
        before: "boolean",
        after: "string",
      },
    ]);
  });

  it("reports added and removed properties as drift", () => {
    const committed = JSON.stringify({
      properties: {
        delayPossible: { type: "boolean" },
      },
    });
    const regenerated = JSON.stringify({
      properties: {
        indefinitelyRescheduled: { type: "boolean" },
      },
    });

    const result = compareSwaggerSnapshots(committed, regenerated);

    expect(result.hasDrift).toBe(true);
    expect(result.changes).toEqual([
      {
        kind: "removed",
        path: "properties.delayPossible",
        before: { type: "boolean" },
      },
      {
        kind: "added",
        path: "properties.indefinitelyRescheduled",
        after: { type: "boolean" },
      },
    ]);
  });
});

describe("formatDriftSummaryMarkdown", () => {
  it("lists each changed path for the notify issue body", () => {
    const markdown = formatDriftSummaryMarkdown([
      {
        kind: "changed",
        path: "components.schemas.MatchStatus.properties.delayPossible.type",
        before: "boolean",
        after: "string",
      },
      {
        kind: "added",
        path: "components.schemas.NewDto",
        after: { type: "object" },
      },
    ]);

    expect(markdown).toContain("delayPossible.type");
    expect(markdown).toContain("`boolean` → `string`");
    expect(markdown).toContain("NewDto");
    expect(markdown).toContain("added");
  });
});

describe("buildSwaggerDriftSection", () => {
  it("points reviewers at source.json and embeds the semantic change summary", () => {
    const section = buildSwaggerDriftSection({
      runUrl: "https://github.com/example/run/1",
      summaryMarkdown: "- **changed** `foo.type`: `boolean` → `string`",
    });

    expect(section).toContain("codegen/sams/generated/source.json");
    expect(section).not.toContain("input.json");
    expect(section).toContain("### What changed");
    expect(section).toContain("`foo.type`");
    expect(section).toContain("https://github.com/example/run/1");
    expect(section).toContain("View workflow run");
  });
});

describe("GitHub Actions output helpers", () => {
  it("formats step summary and job outputs for Actions to pick up", () => {
    const summary = formatGithubStepSummary({
      hasDrift: true,
      changeCount: 1,
      summaryMarkdown: "- **changed** `foo.type`: `boolean` → `string`",
    });
    expect(summary).toContain("Swagger drift detected");
    expect(summary).toContain("### What changed");
    expect(summary).toContain("foo.type");

    const noDrift = formatGithubStepSummary({
      hasDrift: false,
      changeCount: 0,
      summaryMarkdown: "",
    });
    expect(noDrift).toContain("semantically unchanged");

    const outputs = formatGithubOutputFile({
      hasDrift: true,
      summaryMarkdown: "- **changed** `foo`",
    });
    expect(outputs).toContain("has_drift=true");
    expect(outputs).toContain("drift_summary_markdown<<SWAGGER_DRIFT_EOF");
    expect(outputs).toContain("- **changed** `foo`");
  });
});

describe("check-sams-swagger-drift CLI", () => {
  it("reports no drift for key-order-only differences and drift for real changes", async () => {
    const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");

    const dir = mkdtempSync(join(tmpdir(), "sams-swagger-drift-"));
    try {
      const committed = join(dir, "committed.json");
      const regeneratedSame = join(dir, "regenerated-same.json");
      const regeneratedChanged = join(dir, "regenerated-changed.json");
      const githubOutput = join(dir, "github-output");
      const githubStepSummary = join(dir, "github-step-summary");

      writeFileSync(
        committed,
        JSON.stringify({
          properties: {
            indefinitelyRescheduled: { type: "boolean" },
            delayPossible: { type: "boolean" },
          },
        }),
      );
      writeFileSync(
        regeneratedSame,
        JSON.stringify({
          properties: {
            delayPossible: { type: "boolean" },
            indefinitelyRescheduled: { type: "boolean" },
          },
        }),
      );
      writeFileSync(
        regeneratedChanged,
        JSON.stringify({
          properties: {
            delayPossible: { type: "string" },
            indefinitelyRescheduled: { type: "boolean" },
          },
        }),
      );

      const sameOutput = execFileSync(
        "bun",
        ["scripts/check-sams-swagger-drift.ts", committed, regeneratedSame],
        { encoding: "utf8", cwd: process.cwd() },
      );
      const sameResult = JSON.parse(sameOutput) as { hasDrift: boolean; changeCount: number };
      expect(sameResult.hasDrift).toBe(false);
      expect(sameResult.changeCount).toBe(0);

      writeFileSync(githubOutput, "");
      writeFileSync(githubStepSummary, "");
      const changedOutput = execFileSync(
        "bun",
        ["scripts/check-sams-swagger-drift.ts", committed, regeneratedChanged],
        {
          encoding: "utf8",
          cwd: process.cwd(),
          env: {
            ...process.env,
            GITHUB_OUTPUT: githubOutput,
            GITHUB_STEP_SUMMARY: githubStepSummary,
          },
        },
      );
      const changedResult = JSON.parse(changedOutput) as {
        hasDrift: boolean;
        changeCount: number;
        summaryMarkdown: string;
      };
      expect(changedResult.hasDrift).toBe(true);
      expect(changedResult.changeCount).toBeGreaterThan(0);
      expect(changedResult.summaryMarkdown).toContain("delayPossible");

      expect(readFileSync(githubOutput, "utf8")).toContain("has_drift=true");
      expect(readFileSync(githubStepSummary, "utf8")).toContain("What changed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
