import { ZodError, type ZodType } from "zod";

function throwServerParseError(error: unknown, message: string): never {
	if (error instanceof ZodError) {
		throw new Error(message, { cause: error });
	}

	throw error;
}

export function parseServerData<T>(schema: ZodType<T>, value: unknown, message: string): T {
	try {
		return schema.parse(value);
	} catch (error) {
		return throwServerParseError(error, message);
	}
}

export function parseServerArray<T>(schema: ZodType<T>, values: unknown[], message: string): T[] {
	try {
		return values.map((value) => schema.parse(value));
	} catch (error) {
		return throwServerParseError(error, message);
	}
}
