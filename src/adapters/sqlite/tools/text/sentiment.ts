import { buildWhereClause } from "../../../../utils/where-clause.js";
import { validateColumnExists } from "./helpers.js";
/**
 * Text Sentiment Analysis Tool
 *
 * Basic keyword-based sentiment analysis using word matching.
 * Ported from postgres-mcp pg_text_sentiment for cross-server parity.
 */

import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import {
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { TextSentimentOutputSchema } from "../../schemas/text.js";
import { TextSentimentSchema } from "../../schemas/text.js";
import type { SqliteAdapter } from "../../sqlite-adapter.js";

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
 */
export function createTextSentimentTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_text_sentiment",
    description:
      "Perform basic sentiment analysis on text column using keyword matching.",
    group: "text",
    inputSchema: TextSentimentSchema,
    outputSchema: TextSentimentOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Sentiment"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = TextSentimentSchema.parse(params ?? {});

        interface AnalyzeTextReturn {
          sentiment: string;
          score: number;
          confidence: string;
          positiveCount: number;
          negativeCount: number;
          matchedPositive?: string[] | undefined;
          matchedNegative?: string[] | undefined;
        }

        // Define analysis function
        const analyzeText = (
          original: string | null | undefined,
        ): AnalyzeTextReturn => {
          if (!original || original.trim() === "") {
            return {
              sentiment: "neutral",
              score: 0,
              confidence: "low",
              positiveCount: 0,
              negativeCount: 0,
            };
          }

          const textStr = original.toLowerCase();
          const words = textStr.split(/\s+/);
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

          let sentiment:
            | "very_positive"
            | "positive"
            | "neutral"
            | "negative"
            | "very_negative";
          if (totalScore > 2) sentiment = "very_positive";
          else if (totalScore > 0) sentiment = "positive";
          else if (totalScore < -2) sentiment = "very_negative";
          else if (totalScore < 0) sentiment = "negative";
          else sentiment = "neutral";

          return {
            sentiment,
            score: totalScore,
            confidence:
              positiveScore + negativeScore > 3
                ? "high"
                : positiveScore + negativeScore > 1
                  ? "medium"
                  : "low",
            positiveCount: positiveScore,
            negativeCount: negativeScore,
            matchedPositive: parsed.returnWords ? matchedPositive : undefined,
            matchedNegative: parsed.returnWords ? matchedNegative : undefined,
          };
        };

        if (parsed.text !== undefined) {
          // Standalone text mode
          const res = analyzeText(parsed.text);
          return {
            success: true,
            ...res,
          };
        }

        if (!parsed.table || !parsed.column) {
          throw new ValidationError(
            "Must provide either 'text' or both 'table' and 'column'",
          );
        }

        // Table mode
        const table = sanitizeIdentifier(parsed.table);
        const column = sanitizeIdentifier(parsed.column);
        await validateColumnExists(adapter, parsed.table, parsed.column);

        const queryParams: unknown[] = [];
      let sql = `SELECT rowid as id, ${column} as value FROM ${table}`;
        if (parsed.conditions) {
          const { sql: whereSql, params: whereParams } = buildWhereClause(parsed.conditions);
          if (whereSql !== "") {
            sql += ` WHERE ${whereSql}`;
            queryParams.push(...whereParams);
          }
        }
        sql += ` LIMIT ${parsed.limit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);

        const rows = (result.rows ?? []).map((row) => {
          const rawOriginal = row["value"];
          const original =
            typeof rawOriginal === "string"
              ? rawOriginal
              : rawOriginal === null || rawOriginal === undefined
                ? ""
                : JSON.stringify(rawOriginal);

          const res = analyzeText(original);

          interface SentimentResult {
            rowid?: number | undefined;
            sentiment: string;
            score: number;
            confidence: string;
            positiveCount: number;
            negativeCount: number;
            matchedPositive?: string[] | undefined;
            matchedNegative?: string[] | undefined;
          }

          const resObj: SentimentResult = {
            rowid: row["id"] as number | undefined,
            ...res,
          };

          return resObj;
        });

        return {
          success: true,
          rowCount: rows.length,
          results: rows,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}
