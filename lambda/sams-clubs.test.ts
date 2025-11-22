import { beforeAll, describe, expect, it } from "vitest";
import { slugify } from "@/utils/slugify";

// Set environment variables before tests
beforeAll(() => {
	process.env.CLUBS_TABLE_NAME = "test-clubs-table";
});

describe("sams-clubs Lambda - Integration tests", () => {
	describe("slugify integration", () => {
		it("should slugify club names correctly for DynamoDB queries", () => {
			// These are the real transformations that happen in the Lambda
			expect(slugify("VC Müllheim")).toBe("vc-muellheim");
			expect(slugify("TV Lörrach")).toBe("tv-loerrach");
			expect(slugify("MTV Freiburg")).toBe("mtv-freiburg");
		});

		it("should handle special characters consistently", () => {
			expect(slugify("FC Bayern München")).toBe("fc-bayern-muenchen");
			expect(slugify("1. FC Köln")).toBe("1.-fc-koeln");
		});
	});

	describe("environment configuration", () => {
		it("should have CLUBS_TABLE_NAME configured", () => {
			expect(process.env.CLUBS_TABLE_NAME).toBe("test-clubs-table");
		});
	});
});
