import * as path from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { idempotent } from "../../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { isModuleAvailable, isCsvModuleAvailable } from "../analysis.js";
import { CreateCsvTableSchema } from "../helpers.js";
import { CreateCsvTableOutputSchema } from "../../../output-schemas/index.js";

export function createCsvTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_csv_table",
    description:
      "Create a virtual table from a CSV file. Requires the csv extension.",
    group: "admin",
    inputSchema: CreateCsvTableSchema,
    outputSchema: CreateCsvTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create CSV Table"),
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

        const { available: csvAvailable } = await isCsvModuleAvailable(adapter);
        if (!csvAvailable) {
          const isWasm = !(await isModuleAvailable(adapter, "rtree"));
          return {
            success: false,
            error: isWasm
              ? "CSV extension not available in WASM mode. Use native SQLite with the csv extension."
              : "CSV extension not available. Load the csv/xsv extension using --csv flag or set CSV_EXTENSION_PATH.",
            code: "VALIDATION_ERROR",
            category: "validation",
            message: "",
            sql: "",
            columns: [],
            wasmLimitation: isWasm,
          };
        }

        const options: string[] = [
          `filename='${input.filePath.replace(/'/g, "''")}'`,
        ];
        if (!input.header) {
          options.push("header=false");
        }
        if (input.delimiter !== ",") {
          options.push(`delimiter='${input.delimiter}'`);
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
