import { describe, it, expect } from "vitest";
import {
  VectorStoreSchema,
  VectorBatchStoreSchema,
  VectorCountSchema,
  VectorDeleteSchema,
} from "../../../../src/adapters/sqlite/schemas/vector.js";

describe("Vector Schemas Coercion", () => {
  it("should coerce number arrays", () => {
    // stringified JSON array
    const result = VectorStoreSchema.parse({
      table: "t",
      idColumn: "id",
      vectorColumn: "v",
      id: "1",
      vector: "[1, 2, 3]",
    });
    expect(result.vector).toEqual([1, 2, 3]);

    // Already array
    const result2 = VectorStoreSchema.parse({
      table: "t",
      idColumn: "id",
      vectorColumn: "v",
      id: "1",
      vector: [1, 2, 3],
    });
    expect(result2.vector).toEqual([1, 2, 3]);

    // Invalid JSON defaults back to original value (which throws ZodError in parse, so let's use safeParse)
    const badParse = VectorStoreSchema.safeParse({
      table: "t",
      idColumn: "id",
      vectorColumn: "v",
      id: "1",
      vector: "invalid-json",
    });
    expect(badParse.success).toBe(false);
  });

  it("should coerce plain arrays", () => {
    // Stringified array
    const result = VectorBatchStoreSchema.parse({
      table: "t",
      idColumn: "id",
      vectorColumn: "v",
      items: '[{"id": 1, "vector": [1,2]}]',
    });
    expect(result.items).toEqual([{ id: 1, vector: [1, 2] }]);

    // Invalid JSON for array coercion
    const badParse = VectorBatchStoreSchema.safeParse({
      table: "t",
      idColumn: "id",
      vectorColumn: "v",
      items: "invalid-json",
    });
    expect(badParse.success).toBe(false);
    
    // Array coercion for ids
    const deleteResult = VectorDeleteSchema.parse({
      table: "t",
      idColumn: "id",
      ids: '["a", "b"]'
    });
    expect(deleteResult.ids).toEqual(["a", "b"]);
  });

  it("should coerce numbers", () => {
    // Stringified number
    const result = VectorCountSchema.parse({
      table: "t",
      dimensions: "100",
    });
    expect(result.dimensions).toBe(100);

    // Empty string
    const result2 = VectorCountSchema.parse({
      table: "t",
      dimensions: " ",
    });
    expect(result2.dimensions).toBeUndefined();

    // Invalid number string
    const badParse = VectorCountSchema.safeParse({
      table: "t",
      dimensions: "not-a-number",
    });
    expect(badParse.success).toBe(false);
  });
});
