import { describe, it, expect } from "vitest";
import { resolveAliases } from "../../../src/adapters/sqlite/types.js";

describe("types - resolveAliases", () => {
  it("should return the original input if it is not an object or is null", () => {
    expect(resolveAliases(null)).toBe(null);
    expect(resolveAliases("string")).toBe("string");
    expect(resolveAliases(123)).toBe(123);
    expect(resolveAliases(undefined)).toBe(undefined);
  });

  it("should convert snake_case aliases to camelCase", () => {
    const input = {
      my_property_name: "value",
      another_one: 123
    };
    const result = resolveAliases(input) as Record<string, unknown>;
    expect(result["myPropertyName"]).toBe("value");
    expect(result["anotherOne"]).toBe(123);
    expect(result["my_property_name"]).toBe("value"); // original remains
  });

  it("should respect explicit aliasMap", () => {
    const input = {
      legacy_name: "value"
    };
    const aliasMap = {
      legacy_name: "newName"
    };
    const result = resolveAliases(input, aliasMap) as Record<string, unknown>;
    expect(result["newName"]).toBe("value");
  });

  it("should not override existing canonical values with aliases", () => {
    const input = {
      my_prop: "alias_value",
      myProp: "canonical_value",
      legacy: "legacy_value",
      canonical: "actual_value"
    };
    const aliasMap = {
      legacy: "canonical"
    };
    const result = resolveAliases(input, aliasMap) as Record<string, unknown>;
    expect(result["myProp"]).toBe("canonical_value");
    expect(result["canonical"]).toBe("actual_value");
  });

  it("should override existing canonical values if they are empty strings", () => {
    const input = {
      legacy: "legacy_value",
      canonical: ""
    };
    const aliasMap = {
      legacy: "canonical"
    };
    const result = resolveAliases(input, aliasMap) as Record<string, unknown>;
    expect(result["canonical"]).toBe("legacy_value");
  });
});
