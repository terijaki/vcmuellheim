/**
 * Processes nullable optional field updates for ElectroDB patch operations.
 *
 * Conventions:
 *   null      → field should be REMOVED from DynamoDB  (ElectroDB .remove())
 *   undefined → field should be left untouched          (omit from .set / .remove)
 *   value     → field should be SET to the given value  (ElectroDB .set())
 *
 * Returns:
 *   setFields  — object to spread into `.set({ ...setFields })`
 *   removeKeys — array to pass to `.remove(removeKeys)`
 */
export function resolveNullableUpdates(fields: Record<string, string | number | boolean | null | undefined>): {
	setFields: Record<string, string | number | boolean>;
	removeKeys: string[];
} {
	const setFields: Record<string, string | number | boolean> = {};
	const removeKeys: string[] = [];

	for (const [key, value] of Object.entries(fields)) {
		if (value === null) {
			removeKeys.push(key);
		} else if (value !== undefined) {
			setFields[key] = value;
		}
	}

	return { setFields, removeKeys };
}
