/**
 * SQLite Text Processing Tools â€” Barrel Index
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createRegexExtractTool,
  createRegexMatchTool,
  createTextSplitTool,
} from "./regex.js";
import {
  createTextConcatTool,
  createTextReplaceTool,
  createTextTrimTool,
  createTextCaseTool,
  createTextSubstringTool,
} from "./formatting.js";
import {
  createFuzzyMatchTool,
  createPhoneticMatchTool,
  createAdvancedSearchTool,
} from "./search.js";
import { createTextNormalizeTool, createTextValidateTool } from "./validate.js";

/**
 * Get all text processing tools
 */
export function getTextTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createRegexExtractTool(adapter),
    createRegexMatchTool(adapter),
    createTextSplitTool(adapter),
    createTextConcatTool(adapter),
    createTextReplaceTool(adapter),
    createTextTrimTool(adapter),
    createTextCaseTool(adapter),
    createTextSubstringTool(adapter),
    createFuzzyMatchTool(adapter),
    createPhoneticMatchTool(adapter),
    createTextNormalizeTool(adapter),
    createTextValidateTool(adapter),
    createAdvancedSearchTool(adapter),
  ];
}
