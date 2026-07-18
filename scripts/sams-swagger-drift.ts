/**
 * Canonical JSON comparison and semantic drift summaries for SAMS swagger checks.
 * Used by scripts/check-sams-swagger-drift.ts and the sams-health-check workflow.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonDriftChange =
  | { kind: "added"; path: string; after: JsonValue }
  | { kind: "removed"; path: string; before: JsonValue }
  | { kind: "changed"; path: string; before: JsonValue; after: JsonValue };

export type SwaggerSnapshotCompareResult = {
  hasDrift: boolean;
  changes: JsonDriftChange[];
};

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value) {
      items.push(asJsonValue(item));
    }
    return items;
  }
  if (isPlainObject(value)) {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = asJsonValue(child);
    }
    return result;
  }
  throw new Error(`Unsupported JSON value type: ${typeof value}`);
}

/** Deep equality that ignores object key insertion order. */
export function jsonEqualIgnoringKeyOrder(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i++) {
      if (!jsonEqualIgnoringKeyOrder(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    const rightKeySet = new Set(rightKeys);
    for (const key of leftKeys) {
      if (!rightKeySet.has(key)) {
        return false;
      }
      if (!jsonEqualIgnoringKeyOrder(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function collectJsonDrift(
  left: JsonValue,
  right: JsonValue,
  path: string,
  out: JsonDriftChange[],
): void {
  if (jsonEqualIgnoringKeyOrder(left, right)) {
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i++) {
      const childPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= left.length) {
        out.push({ kind: "added", path: childPath, after: right[i]! });
        continue;
      }
      if (i >= right.length) {
        out.push({ kind: "removed", path: childPath, before: left[i]! });
        continue;
      }
      collectJsonDrift(left[i]!, right[i]!, childPath, out);
    }
    return;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const childPath = path ? `${path}.${key}` : key;
      const hasLeft = Object.hasOwn(left, key);
      const hasRight = Object.hasOwn(right, key);
      if (!hasLeft) {
        out.push({ kind: "added", path: childPath, after: right[key]! });
        continue;
      }
      if (!hasRight) {
        out.push({ kind: "removed", path: childPath, before: left[key]! });
        continue;
      }
      collectJsonDrift(left[key]!, right[key]!, childPath, out);
    }
    return;
  }

  out.push({
    kind: "changed",
    path: path || "(root)",
    before: left,
    after: right,
  });
}

/** Compare two OpenAPI JSON document strings; key order alone does not count as drift. */
export function compareSwaggerSnapshots(
  committedJson: string,
  regeneratedJson: string,
): SwaggerSnapshotCompareResult {
  const committed = asJsonValue(JSON.parse(committedJson));
  const regenerated = asJsonValue(JSON.parse(regeneratedJson));
  const changes: JsonDriftChange[] = [];
  collectJsonDrift(committed, regenerated, "", changes);
  return {
    hasDrift: changes.length > 0,
    changes,
  };
}

function formatJsonSnippet(value: JsonValue): string {
  if (typeof value === "string") {
    return `\`${value}\``;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return `\`${String(value)}\``;
  }
  const serialized = JSON.stringify(value);
  if (serialized.length <= 80) {
    return `\`${serialized}\``;
  }
  return `\`${serialized.slice(0, 77)}...\``;
}

/** Markdown list of semantic changes for CI summaries and GitHub issue bodies. */
export function formatDriftSummaryMarkdown(changes: JsonDriftChange[], maxItems = 40): string {
  if (changes.length === 0) {
    return "_No semantic changes._";
  }

  const shown = changes.slice(0, maxItems);
  const lines = shown.map((change) => {
    switch (change.kind) {
      case "added":
        return `- **added** \`${change.path}\`: ${formatJsonSnippet(change.after)}`;
      case "removed":
        return `- **removed** \`${change.path}\`: ${formatJsonSnippet(change.before)}`;
      case "changed":
        return `- **changed** \`${change.path}\`: ${formatJsonSnippet(change.before)} → ${formatJsonSnippet(change.after)}`;
    }
  });

  if (changes.length > maxItems) {
    lines.push(`- _…and ${changes.length - maxItems} more_`);
  }

  return lines.join("\n");
}

const SOURCE_JSON_PATH = "codegen/sams/generated/source.json";

/** GitHub issue section for swagger drift notifications. */
export function buildSwaggerDriftSection(options: {
  runUrl: string;
  summaryMarkdown?: string;
}): string {
  const { runUrl, summaryMarkdown } = options;
  const changeBlock =
    summaryMarkdown && summaryMarkdown.trim().length > 0
      ? `\n### What changed\n\n${summaryMarkdown}\n`
      : "";

  return `## ⚠️ Swagger Drift Detected

The upstream spec at \`https://www.volleyball-baden.de/api/v2/swagger.json\` has changed since the last committed snapshot in \`${SOURCE_JSON_PATH}\`.

Run \`bun run sams:codegen\` locally, review \`${SOURCE_JSON_PATH}\` plus the generated client files for downstream impact, then commit the updated files once verified.
${changeBlock}
[View workflow run](${runUrl})`;
}
