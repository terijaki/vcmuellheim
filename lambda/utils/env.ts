import { z } from "zod";

export const requiredEnvString = z.string().trim().min(1, "must be set");

export const optionalEnvString = z.preprocess((value) => {
	if (typeof value === "string" && value.trim() === "") {
		return undefined;
	}
	return value;
}, z.string().trim().optional());

/**
 * Parse Lambda environment variables with a Zod schema.
 * Throws ZodError with schema-defined messages when config is invalid.
 */
export function parseLambdaEnv<TSchema extends z.ZodTypeAny>(schema: TSchema, env: Record<string, string | undefined> = process.env): z.infer<TSchema> {
	return schema.parse(env);
}
