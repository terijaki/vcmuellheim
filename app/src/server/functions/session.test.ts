import { describe, expect, it } from "vite-plus/test";
import { mapSessionUser } from "./session-utils";

describe("mapSessionUser", () => {
  it("maps id, email, name, and role from a complete user object", () => {
    const result = mapSessionUser({
      id: "u1",
      email: "test@example.com",
      name: "Alice",
      authRole: "Admin",
    });
    expect(result).toEqual({
      id: "u1",
      email: "test@example.com",
      name: "Alice",
      authRole: "Admin",
    });
  });

  it("sets name to undefined when null", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com", name: null });
    expect(result.name).toBeUndefined();
  });

  it("sets name to undefined when absent", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com" });
    expect(result.name).toBeUndefined();
  });

  it("sets authRole to undefined for non-string authRole value", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com", authRole: 42 });
    expect(result.authRole).toBeUndefined();
  });

  it("sets authRole to undefined when absent", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com" });
    expect(result.authRole).toBeUndefined();
  });

  it("preserves authRole as a string", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com", authRole: "Moderator" });
    expect(result.authRole).toBe("Moderator");
  });

  it("ignores unknown extra fields", () => {
    const result = mapSessionUser({ id: "u1", email: "test@example.com", someThing: true });
    expect(result).not.toHaveProperty("someThing");
  });
});
