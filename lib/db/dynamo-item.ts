const KEY_FIELDS = new Set(["pk", "sk", "gsi1pk", "gsi1sk"]);

/** Strip DynamoDB key attributes before domain schema parsing. */
export function domainFieldsFromItem(item: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (KEY_FIELDS.has(key)) continue;
    if (key.startsWith("gsi") && (key.endsWith("pk") || key.endsWith("sk"))) continue;
    result[key] = value;
  }
  return result;
}
