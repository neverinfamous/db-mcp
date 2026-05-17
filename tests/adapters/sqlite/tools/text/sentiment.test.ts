/**
 * Text Sentiment Analysis Tool Tests
 *
 * Tests for sqlite_text_sentiment — pure JS keyword-based sentiment analysis.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

type SentimentResult = {
  success: boolean;
  rowCount?: number;
  results?: Array<{
    rowid: number;
    original: string | null;
    sentiment: string;
    score: number;
    positiveCount: number;
    negativeCount: number;
    confidence: string;
    matchedPositive?: string[];
    matchedNegative?: string[];
  }>;
  error?: string;
  code?: string;
};

describe("Text Sentiment Tool", () => {
  let adapter: TestAdapter;
  let sentimentTool: (params: unknown) => Promise<unknown>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    await adapter.executeWriteQuery(`
      CREATE TABLE test_data (
        id INTEGER PRIMARY KEY,
        text TEXT
      );
    `);
    
    await adapter.executeWriteQuery(`
      INSERT INTO test_data (id, text) VALUES
        (1, 'This is amazing, wonderful, fantastic, and absolutely brilliant!'),
        (2, 'This product is good and helpful.'),
        (3, 'The weather is clear today with some clouds.'),
        (4, 'This is a terrible experience.'),
        (5, 'This is terrible, awful, horrible, and completely useless!'),
        (6, 'The product is great but the service was terrible.'),
        (7, 'This is good.'),
        (8, 'This is good and great.'),
        (9, 'This product is amazing and wonderful!'),
        (10, 'Great service but slow delivery'),
        (11, 'excellent'),
        (12, ''),
        (13, '   '),
        (14, 'Wow! This is amazing!!! Truly wonderful.'),
        (15, 'AMAZING WONDERFUL FANTASTIC');
    `);

    const tools = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };
    const tool = tools.find((t) => t.name === "sqlite_text_sentiment");

    if (!tool) throw new Error("sqlite_text_sentiment tool not found");
    sentimentTool = (params) => tool.handler(params, context as never);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sentiment classification", () => {
    it("should classify very positive text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 1"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("very_positive");
      expect(row.score).toBeGreaterThan(2);
      expect(row.positiveCount).toBeGreaterThan(0);
      expect(row.negativeCount).toBe(0);
    });

    it("should classify positive text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 2"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("positive");
      expect(row.score).toBeGreaterThan(0);
      expect(row.score).toBeLessThanOrEqual(2);
    });

    it("should classify neutral text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 3"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("neutral");
      expect(row.score).toBe(0);
    });

    it("should classify negative text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 4"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("negative");
      expect(row.score).toBeLessThan(0);
    });

    it("should classify very negative text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 5"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("very_negative");
      expect(row.score).toBeLessThan(-2);
    });

    it("should classify mixed sentiment as balanced", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 6"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("neutral");
      expect(row.positiveCount).toBeGreaterThan(0);
      expect(row.negativeCount).toBeGreaterThan(0);
    });
  });

  describe("confidence levels", () => {
    it("should return low confidence for few matches", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 7"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.results![0].confidence).toBe("low");
    });

    it("should return medium confidence for moderate matches", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 8"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.results![0].confidence).toBe("medium");
    });

    it("should return high confidence for many matches", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 1"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.results![0].confidence).toBe("high");
    });
  });

  describe("returnWords option", () => {
    it("should not include matched words by default", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 9"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.matchedPositive).toBeUndefined();
      expect(row.matchedNegative).toBeUndefined();
    });

    it("should include matched words when returnWords is true", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 9",
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.matchedPositive).toBeDefined();
      expect(row.matchedPositive).toContain("amazing");
      expect(row.matchedPositive).toContain("wonderful");
      expect(row.matchedNegative).toEqual([]);
    });

    it("should include both positive and negative matched words", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 10",
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.matchedPositive).toContain("great");
      expect(row.matchedNegative).toContain("slow");
    });
  });

  describe("edge cases", () => {
    it("should handle single word text", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 11"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("positive");
      expect(row.score).toBe(1);
    });

    it("should handle empty text without failing", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 12"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("neutral");
      expect(row.score).toBe(0);
    });

    it("should handle whitespace-only text without failing", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 13"
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("neutral");
      expect(row.score).toBe(0);
    });

    it("should handle text with punctuation", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 14",
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.matchedPositive).toContain("amazing");
      expect(row.matchedPositive).toContain("wonderful");
    });

    it("should be case-insensitive", async () => {
      const result = (await sentimentTool({
        table: "test_data",
        column: "text",
        whereClause: "id = 15",
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      const row = result.results![0];
      expect(row.sentiment).toBe("very_positive");
      expect(row.matchedPositive).toContain("amazing");
    });
  });
});
