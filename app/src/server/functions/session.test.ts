import { describe, expect, it } from "vite-plus/test";
import { mapSessionUser } from "./session-utils";

describe("mapSessionUser", () => {
	it("maps id, email, name, and role from a complete user object", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com", name: "Alice", role: "Admin" });
		expect(result).toEqual({ id: "u1", email: "test@example.com", name: "Alice", role: "Admin" });
	});

	it("sets name to undefined when null", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com", name: null });
		expect(result.name).toBeUndefined();
	});

	it("sets name to undefined when absent", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com" });
		expect(result.name).toBeUndefined();
	});

	it("sets role to undefined for non-string role value", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com", role: 42 });
		expect(result.role).toBeUndefined();
	});

	it("sets role to undefined when absent", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com" });
		expect(result.role).toBeUndefined();
	});

	it("preserves role as a string", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com", role: "Moderator" });
		expect(result.role).toBe("Moderator");
	});

	it("ignores unknown extra fields", () => {
		const result = mapSessionUser({ id: "u1", email: "test@example.com", someThing: true });
		expect(result).not.toHaveProperty("someThing");
	});
});
