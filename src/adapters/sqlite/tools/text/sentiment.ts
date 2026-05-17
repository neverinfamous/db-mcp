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
import type { SqliteAdapter } from "../../sqlite-adapter.js";

export function createTextSentimentTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_sentiment",
    description: "Perform basic sentiment analysis on text column using keyword matching.",
    group: "text",
    inputSchema: TextSentimentSchema,
    outputSchema: TextSentimentOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Sentiment"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = TextSentimentSchema.parse(params ?? {});
        
        const table = parsed.table;
        const column = parsed.column;
        
        // Use double quotes around table and column to prevent injection issues with reserved words
        const sql = `SELECT rowid, "${column}" as original FROM "${table}"${parsed.whereClause ? ` WHERE ${parsed.whereClause}` : ""} LIMIT ?`;
        
        const queryResult = await adapter.executeReadQuery(sql, [parsed.limit]);
        const rows = queryResult.rows ?? [];
        
        const results = rows.map((row) => {
          const original = row["original"];
          const rowid = row["rowid"];
          
          let originalText: string | null = null;
          if (typeof original === "string") {
            originalText = original;
          } else if (typeof original === "number") {
            originalText = String(original);
          }

          if (originalText === null || originalText.trim() === "") {
             return {
               rowid: Number(rowid),
               original: originalText,
               sentiment: "neutral",
               score: 0,
               confidence: "low",
               positiveCount: 0,
               negativeCount: 0
             };
          }
          const text = originalText.toLowerCase();
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

          let sentiment: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
          if (totalScore > 2) sentiment = "very_positive";
          else if (totalScore > 0) sentiment = "positive";
          else if (totalScore < -2) sentiment = "very_negative";
          else if (totalScore < 0) sentiment = "negative";
          else sentiment = "neutral";
          
          interface SentimentResult {
            rowid: number;
            original: string | null;
            sentiment: string;
            score: number;
            confidence: string;
            positiveCount: number;
            negativeCount: number;
            matchedPositive?: string[];
            matchedNegative?: string[];
          }
          
          const result: SentimentResult = {
             rowid: Number(rowid),
             original: originalText,
             sentiment,
             score: totalScore,
             confidence: positiveScore + negativeScore > 3 ? "high" : positiveScore + negativeScore > 1 ? "medium" : "low",
             positiveCount: positiveScore,
             negativeCount: negativeScore
          };
          if (parsed.returnWords) {
             result.matchedPositive = matchedPositive;
             result.matchedNegative = matchedNegative;
          }
          return result;
        });

        return {
          success: true,
          rowCount: results.length,
          results
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
