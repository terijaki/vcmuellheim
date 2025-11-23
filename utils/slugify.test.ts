import { describe, expect, it } from "bun:test";
import { slugify } from "./slugify";

describe("slugify", () => {
	describe("basic transformations", () => {
		it("should lowercase, replace spaces, and trim whitespace", () => {
			expect(slugify("HELLO WORLD")).toBe("hello-world");
			expect(slugify("  hello world  ")).toBe("hello-world");
			expect(slugify("-hello-world-")).toBe("hello-world");
			expect(slugify("FC  Basel   United")).toBe("fc-basel-united");
		});
	});

	describe("charactersOnly mode", () => {
		it("should remove all non-alphanumeric characters", () => {
			expect(slugify("hello-world-123")).toBe("hello-world-123");
			expect(slugify("hello-world-123!", true)).toBe("helloworld123");
			expect(slugify("hello@world.com", true)).toBe("helloworldcom");
			expect(slugify("hello_world", true)).toBe("helloworld");
		});
	});

	describe("real-world club names", () => {
		it("should handle typical volleyball club names", () => {
			expect(slugify("VC Müllheim")).toBe("vc-muellheim");
			expect(slugify("U18 Team A")).toBe("u18-team-a");
			expect(slugify("Äpfel 2025 United  Straßbourg")).toBe("aepfel-2025-united-strassbourg");
			expect(slugify("TuS Überwasser Münster")).toBe("tus-ueberwasser-muenster");
			expect(slugify("SV Grün-Weiß Öhringen")).toBe("sv-gruen-weiss-oehringen");
		});
	});

	describe("edge cases", () => {
		it("should handle empty or whitespace-only strings", () => {
			expect(slugify("")).toBe("");
			expect(slugify("   ")).toBe("");
			expect(slugify("---")).toBe("");
			expect(slugify("   !@?   ", true)).toBe("");
		});
	});
});
