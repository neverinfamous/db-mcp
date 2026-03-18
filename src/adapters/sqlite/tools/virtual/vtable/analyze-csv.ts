import * as path from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { isModuleAvailable, isCsvModuleAvailable } from "../analysis.js";
import { AnalyzeCsvSchemaSchema } from "../helpers.js";
import { AnalyzeCsvSchemaOutputSchema } from "../../../output-schemas/index.js";

export function createAnalyzeCsvSchemaTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_analyze_csv_schema",
    description:
      "Analyze a CSV file structure and infer column types. Uses a temporary virtual table.",
    group: "admin",
    inputSchema: AnalyzeCsvSchemaSchema,
    outputSchema: AnalyzeCsvSchemaOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Analyze CSV Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = AnalyzeCsvSchemaSchema.parse(params);
      } catch (error) {
        return {
          ...formatHandlerError(error),
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      }

      if (!path.isAbsolute(input.filePath)) {
        return {
          success: false,
          error: `Relative path not supported. Please use an absolute path. Example: ${path.resolve(input.filePath)}`,
          code: "VALIDATION_ERROR",
          category: "validation",
          hasHeader: false,
          rowCount: 0,
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
          hasHeader: false,
          rowCount: 0,
          columns: [],
          wasmLimitation: isWasm,
        };
      }

      const tempName = `_csv_analyze_${Date.now()}`;

      try {
        const options = [`filename='${input.filePath.replace(/'/g, "''")}'`];
        if (input.delimiter !== ",") {
          options.push(`delimiter='${input.delimiter}'`);
        }

        await adapter.executeWriteQuery(
          `CREATE VIRTUAL TABLE "${tempName}" USING csv(${options.join(", ")})`,
        );

        const colResult = await adapter.executeReadQuery(
          `PRAGMA table_info("${tempName}")`,
        );
        const columnNames = (colResult.rows ?? []).map((row) => {
          const name = row["name"];
          const cid = row["cid"];
          if (typeof name === "string") return name;
          return `col${typeof cid === "number" ? cid : 0}`;
        });

        const sampleResult = await adapter.executeReadQuery(
          `SELECT * FROM "${tempName}" LIMIT ${input.sampleRows}`,
        );

        const columns = columnNames.map((name) => {
          let nullCount = 0;
          let intCount = 0;
          let floatCount = 0;
          const samples: string[] = [];

          for (const row of sampleResult.rows ?? []) {
            const val = row[name];
            const strVal =
              typeof val === "string" ? val : JSON.stringify(val ?? "");

            if (val === null || strVal === "") {
              nullCount++;
            } else {
              if (samples.length < 3) samples.push(strVal);
              if (/^-?\d+$/.test(strVal)) intCount++;
              else if (/^-?\d+\.\d+$/.test(strVal)) floatCount++;
            }
          }

          const total = (sampleResult.rows?.length ?? 0) - nullCount;
          let inferredType = "TEXT";
          if (total > 0) {
            if (intCount === total) inferredType = "INTEGER";
            else if (floatCount === total || intCount + floatCount === total)
              inferredType = "REAL";
          }

          return { name, inferredType, nullCount, sampleValues: samples };
        });

        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM "${tempName}"`,
        );
        const rowCount =
          typeof countResult.rows?.[0]?.["cnt"] === "number"
            ? countResult.rows[0]["cnt"]
            : 0;

        return {
          success: true,
          hasHeader: true,
          rowCount,
          columns,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      } finally {
        await adapter
          .executeWriteQuery(`DROP TABLE IF EXISTS "${tempName}"`)
          .catch(() => {
            /* ignore */
          });
      }
    },
  };
}
