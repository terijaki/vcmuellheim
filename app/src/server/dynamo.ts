import type { BaseEntity } from "@/lib/db/types";

export type TimestampFields = Pick<BaseEntity, "createdAt" | "updatedAt">;

const IMMUTABLE_UPDATE_KEYS = new Set(["id", "createdAt"]);

export function withTimestamps<T extends Record<string, unknown>>(item: T): T & TimestampFields {
	const now = new Date().toISOString();
	return {
		...item,
		createdAt: now,
		updatedAt: now,
	};
}

export function buildUpdateExpression(updates: Record<string, unknown>): {
	updateExpression: string;
	expressionAttributeNames: Record<string, string>;
	expressionAttributeValues: Record<string, unknown>;
} {
	const expressionParts: string[] = ["#updatedAt = :updatedAt"];
	const expressionAttributeNames: Record<string, string> = {
		"#updatedAt": "updatedAt",
	};
	const expressionAttributeValues: Record<string, unknown> = {
		":updatedAt": new Date().toISOString(),
	};

	for (const [key, value] of Object.entries(updates)) {
		if (IMMUTABLE_UPDATE_KEYS.has(key) || value === undefined) {
			continue;
		}

		const attributeName = `#${key}`;
		const attributeValue = `:${key}`;

		expressionParts.push(`${attributeName} = ${attributeValue}`);
		expressionAttributeNames[attributeName] = key;
		expressionAttributeValues[attributeValue] = value;
	}

	return {
		updateExpression: `SET ${expressionParts.join(", ")}`,
		expressionAttributeNames,
		expressionAttributeValues,
	};
}
