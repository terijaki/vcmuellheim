/** Encode DynamoDB LastEvaluatedKey as an opaque pagination cursor. */
export function encodeDynamoCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64");
}

/** Decode a pagination cursor back to ExclusiveStartKey. */
export function decodeDynamoCursor(cursor: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid pagination cursor");
  }
  return parsed as Record<string, unknown>;
}
