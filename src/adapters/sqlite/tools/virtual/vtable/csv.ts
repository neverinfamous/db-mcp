import * as path from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { adminFs } from "../../../../../utils/annotations.js";
import { sanitizeIdentifier, validateSameDirPath } from "../../../../../utils/index.js";
import {
  formatHandlerError,
  ExtensionNotAvailableError,
} from "../../../../../utils/errors/index.js";
import { isModuleAvailable, isCsvModuleAvailable } from "../analysis.js";
import { CreateCsvTableSchema } from "../../../schemas/virtual.js";
import { CreateCsvTableOutputSchema } from "../../../schemas/virtual.js";

export function createCsvTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_csv_table",
    description:
      "Create a virtual table from a CSV file. Requires the csv extension.",
    group: "admin",
    inputSchema: CreateCsvTableSchema,
    outputSchema: CreateCsvTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: adminFs("Create CSV Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateCsvTableSchema.parse(params);

        sanitizeIdentifier(input.tableName);

        if (!path.isAbsolute(input.filePath)) {
          return {
            success: false,
            error: `Relative path not supported. Please use an absolute path. Example: ${path.resolve(input.filePath)}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            message: "",
            sql: "",
            columns: [],
          };
        }

        // Security: validate filePath is within the same directory as the primary DB
        const pathCheck = validateSameDirPath(
          input.filePath,
          adapter.getConfiguredPath(),
        );
        if (!pathCheck.valid) {
          return {
            success: false,
            error: pathCheck.error,
            code: "SECURITY_ERROR",
            category: "security",
            message: "",
            sql: "",
            columns: [],
          };
        }

        const { available: csvAvailable } = await isCsvModuleAvailable(adapter);
        if (!csvAvailable) {
          const isWasm = !(await isModuleAvailable(adapter, "rtree"));
          throw new ExtensionNotAvailableError("csv", {
            suggestion: isWasm
              ? "CSV extension not available in WASM mode. Use native SQLite with the csv extension."
              : "CSV extension not available. Load the csv/xsv extension using --csv flag or set CSV_EXTENSION_PATH.",
            details: { wasmLimitation: isWasm },
          });
        }

        const options: string[] = [
          `filename='${input.filePath.replace(/'/g, "''")}'`,
        ];
        if (!input.header) {
          options.push("header=false");
        }
        if (input.delimiter !== ",") {
          options.push(`delimiter='${input.delimiter.replace(/'/g, "''")}'`);
        }
        if (input.columns && input.columns.length > 0) {
          options.push(`columns=${String(input.columns.length)}`);
        }

        const sql = `CREATE VIRTUAL TABLE "${input.tableName}" USING csv(${options.join(", ")})`;
        await adapter.executeWriteQuery(sql);

        const colResult = await adapter.executeReadQuery(
          `PRAGMA table_info("${input.tableName}")`,
        );
        const columns = (colResult.rows ?? []).map((row) =>
          typeof row["name"] === "string" ? row["name"] : "",
        );

        return {
          success: true,
          message: `Created CSV virtual table '${input.tableName}'`,
          sql,
          columns,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
          sql: "",
          columns: [],
        };
      }
    },
  };
}
