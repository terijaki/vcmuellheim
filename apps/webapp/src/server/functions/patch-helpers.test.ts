import { describe, expect, it } from "bun:test";
import { resolveNullableUpdates } from "./patch-helpers";

describe("resolveNullableUpdates", () => {
  it("puts a string value into setFields", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ league: "Landesliga" });
    expect(setFields).toEqual({ league: "Landesliga" });
    expect(removeKeys).toHaveLength(0);
  });

  it("puts a null value into removeKeys, not setFields", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ league: null });
    expect(setFields).toEqual({});
    expect(removeKeys).toEqual(["league"]);
  });

  it("omits an undefined value from both setFields and removeKeys", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ league: undefined });
    expect(setFields).toEqual({});
    expect(removeKeys).toHaveLength(0);
  });

  it("handles multiple fields with mixed update intents", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({
      description: "New description", // set
      league: null, // remove
      ageGroup: undefined, // keep untouched
    });
    expect(setFields).toEqual({ description: "New description" });
    expect(removeKeys).toEqual(["league"]);
  });

  it("handles a number value (e.g. ttl)", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ ttl: 1751234567 });
    expect(setFields).toEqual({ ttl: 1751234567 });
    expect(removeKeys).toHaveLength(0);
  });

  it("removes a number field when null (e.g. clearing ttl)", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ ttl: null });
    expect(setFields).toEqual({});
    expect(removeKeys).toEqual(["ttl"]);
  });

  it("handles a boolean value", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({ active: true });
    expect(setFields).toEqual({ active: true });
    expect(removeKeys).toHaveLength(0);
  });

  it("handles all fields being null (clear all optional attributes)", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({
      description: null,
      location: null,
      variant: null,
    });
    expect(setFields).toEqual({});
    expect(removeKeys).toEqual(["description", "location", "variant"]);
  });

  it("handles all fields having values (no removals)", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({
      email: "user@example.com",
      phone: "+49123456789",
      roleTitle: "Co-Trainer",
    });
    expect(setFields).toEqual({
      email: "user@example.com",
      phone: "+49123456789",
      roleTitle: "Co-Trainer",
    });
    expect(removeKeys).toHaveLength(0);
  });

  it("returns empty objects when given no fields", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({});
    expect(setFields).toEqual({});
    expect(removeKeys).toHaveLength(0);
  });

  it("does not include null or undefined values in setFields", () => {
    const { setFields } = resolveNullableUpdates({
      name: "Alice",
      email: null,
      phone: undefined,
    });
    expect(Object.keys(setFields)).toEqual(["name"]);
  });

  it("does not include any key in both setFields and removeKeys", () => {
    const { setFields, removeKeys } = resolveNullableUpdates({
      a: "keep",
      b: null,
      c: undefined,
    });
    const setKeys = Object.keys(setFields);
    for (const key of removeKeys) {
      expect(setKeys).not.toContain(key);
    }
  });
});
