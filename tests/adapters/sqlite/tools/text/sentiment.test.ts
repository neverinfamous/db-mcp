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
  sentiment: string;
  score: number;
  positiveCount: number;
  negativeCount: number;
  confidence: string;
  matchedPositive?: string[];
  matchedNegative?: string[];
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
        text: 'This is amazing, wonderful, fantastic, and absolutely brilliant!'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("very_positive");
      expect(result.score).toBeGreaterThan(2);
      expect(result.positiveCount).toBeGreaterThan(0);
      expect(result.negativeCount).toBe(0);
    });

    it("should classify positive text", async () => {
      const result = (await sentimentTool({
        text: 'This product is good and helpful.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("positive");
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(2);
    });

    it("should classify neutral text", async () => {
      const result = (await sentimentTool({
        text: 'The weather is clear today with some clouds.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("neutral");
      expect(result.score).toBe(0);
    });

    it("should classify negative text", async () => {
      const result = (await sentimentTool({
        text: 'This is a terrible experience.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("negative");
      expect(result.score).toBeLessThan(0);
    });

    it("should classify very negative text", async () => {
      const result = (await sentimentTool({
        text: 'This is terrible, awful, horrible, and completely useless!'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("very_negative");
      expect(result.score).toBeLessThan(-2);
    });

    it("should classify mixed sentiment as balanced", async () => {
      const result = (await sentimentTool({
        text: 'The product is great but the service was terrible.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("neutral");
      expect(result.positiveCount).toBeGreaterThan(0);
      expect(result.negativeCount).toBeGreaterThan(0);
    });
  });

  describe("confidence levels", () => {
    it("should return low confidence for few matches", async () => {
      const result = (await sentimentTool({
        text: 'This is good.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.confidence).toBe("low");
    });

    it("should return medium confidence for moderate matches", async () => {
      const result = (await sentimentTool({
        text: 'This is good and great.'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.confidence).toBe("medium");
    });

    it("should return high confidence for many matches", async () => {
      const result = (await sentimentTool({
        text: 'This is amazing, wonderful, fantastic, and absolutely brilliant!'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.confidence).toBe("high");
    });
  });

  describe("returnWords option", () => {
    it("should not include matched words by default", async () => {
      const result = (await sentimentTool({
        text: 'This product is amazing and wonderful!'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.matchedPositive).toBeUndefined();
      expect(result.matchedNegative).toBeUndefined();
    });

    it("should include matched words when returnWords is true", async () => {
      const result = (await sentimentTool({
        text: 'This product is amazing and wonderful!',
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.matchedPositive).toBeDefined();
      expect(result.matchedPositive).toContain("amazing");
      expect(result.matchedPositive).toContain("wonderful");
      expect(result.matchedNegative).toEqual([]);
    });

    it("should include both positive and negative matched words", async () => {
      const result = (await sentimentTool({
        text: 'Great service but slow delivery',
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.matchedPositive).toContain("great");
      expect(result.matchedNegative).toContain("slow");
    });
  });

  describe("edge cases", () => {
    it("should handle single word text", async () => {
      const result = (await sentimentTool({
        text: 'excellent'
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("positive");
      expect(result.score).toBe(1);
    });

    it("should handle empty text without failing", async () => {
      const result = (await sentimentTool({
        text: ''
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("neutral");
      expect(result.score).toBe(0);
    });

    it("should handle whitespace-only text without failing", async () => {
      const result = (await sentimentTool({
        text: '   '
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("neutral");
      expect(result.score).toBe(0);
    });

    it("should handle text with punctuation", async () => {
      const result = (await sentimentTool({
        text: 'Wow! This is amazing!!! Truly wonderful.',
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.matchedPositive).toContain("amazing");
      expect(result.matchedPositive).toContain("wonderful");
    });

    it("should be case-insensitive", async () => {
      const result = (await sentimentTool({
        text: 'AMAZING WONDERFUL FANTASTIC',
        returnWords: true,
      })) as SentimentResult;

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe("very_positive");
      expect(result.matchedPositive).toContain("amazing");
    });
  });
});

