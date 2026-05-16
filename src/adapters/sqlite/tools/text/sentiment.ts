/**
 * Text Sentiment Analysis Tool
 *
 * Basic keyword-based sentiment analysis using word matching.
 * Pure JS implementation — no database queries needed.
 * Ported from postgres-mcp pg_text_sentiment for cross-server parity.
 */

import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import { TextSentimentOutputSchema } from "../../output-schemas/index.js";
import { TextSentimentSchema } from "./helpers.js";

const POSITIVE_WORDS = [
  "good",
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "fantastic",
  "love",
  "happy",
  "positive",
  "best",
  "beautiful",
  "awesome",
  "perfect",
  "nice",
  "helpful",
  "thank",
  "thanks",
  "pleased",
  "satisfied",
  "recommend",
  "enjoy",
  "impressive",
  "brilliant",
] as const;

const NEGATIVE_WORDS = [
  "bad",
  "terrible",
  "awful",
  "horrible",
  "worst",
  "hate",
  "angry",
  "disappointed",
  "poor",
  "wrong",
  "problem",
  "issue",
  "fail",
  "failed",
  "broken",
  "useless",
  "waste",
  "frustrating",
  "annoyed",
  "unhappy",
  "negative",
  "complaint",
  "slow",
] as const;

/**
 * Create the text sentiment analysis tool.
 * No adapter dependency — this is a pure JS text analysis tool.
 */
export function createTextSentimentTool(): ToolDefinition {
  return {
    name: "sqlite_text_sentiment",
    description:
      "Perform basic sentiment analysis on text using keyword matching.",
    group: "text",
    inputSchema: TextSentimentSchema,
    outputSchema: TextSentimentOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Sentiment"),
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const parsed = TextSentimentSchema.parse(params ?? {});
        if (!parsed.text || parsed.text.trim().length === 0) {
          throw new ValidationError("Text must not be empty");
        }
        const text = parsed.text.toLowerCase();

        const words = text.split(/\s+/);
        const matchedPositive = words
          .map((w) => w.replace(/[^a-z]/g, ""))
          .filter((w): w is string =>
            (POSITIVE_WORDS as readonly string[]).includes(w),
          );
        const matchedNegative = words
          .map((w) => w.replace(/[^a-z]/g, ""))
          .filter((w): w is string =>
            (NEGATIVE_WORDS as readonly string[]).includes(w),
          );

        const positiveScore = matchedPositive.length;
        const negativeScore = matchedNegative.length;
        const totalScore = positiveScore - negativeScore;

        let sentiment: string;
        if (totalScore > 2) sentiment = "very_positive";
        else if (totalScore > 0) sentiment = "positive";
        else if (totalScore < -2) sentiment = "very_negative";
        else if (totalScore < 0) sentiment = "negative";
        else sentiment = "neutral";

        const result: {
          success: true;
          sentiment: string;
          score: number;
          positiveCount: number;
          negativeCount: number;
          confidence: string;
          matchedPositive?: string[];
          matchedNegative?: string[];
        } = {
          success: true,
          sentiment,
          score: totalScore,
          positiveCount: positiveScore,
          negativeCount: negativeScore,
          confidence:
            positiveScore + negativeScore > 3
              ? "high"
              : positiveScore + negativeScore > 1
                ? "medium"
                : "low",
        };

        if (parsed.returnWords) {
          result.matchedPositive = matchedPositive;
          result.matchedNegative = matchedNegative;
        }

        return Promise.resolve(result);
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}
