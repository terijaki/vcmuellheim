/**
 * Processes nullable optional field updates for DynamoDB partial writes.
 *
 * Conventions:
 *   null      → field should be REMOVED (UpdateItem REMOVE)
 *   undefined → field should be left untouched
 *   value     → field should be SET (UpdateItem SET)
 *
 * Returns:
 *   setFields  — attributes to include in SET
 *   removeKeys — attribute names to REMOVE
 */
export function resolveNullableUpdates<K extends string>(
  fields: Record<K, string | number | boolean | null | undefined>,
): {
  setFields: Record<string, string | number | boolean>;
  removeKeys: K[];
} {
  const setFields: Record<string, string | number | boolean> = {};
  const removeKeys: K[] = [];

  for (const [key, value] of Object.entries<string | number | boolean | null | undefined>(fields)) {
    if (value === null) {
      removeKeys.push(key as K);
    } else if (value !== undefined) {
      setFields[key] = value;
    }
  }

  return { setFields, removeKeys };
}
