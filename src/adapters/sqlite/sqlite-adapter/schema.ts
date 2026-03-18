import type { SqliteAdapter } from "../sqlite-adapter.js";
import type { SchemaInfo, TableInfo, IndexInfo } from "../../../types/index.js";
import { DbMcpError, ErrorCategory } from "../../../utils/errors/index.js";
import type { ColumnInfo } from "../../../types/index.js";

export async function fallBackGetSchema(
  adapter: SqliteAdapter,
): Promise<SchemaInfo> {
  const tables = await adapter.listTables();
  const indexes = await adapter.getIndexes();
  return { tables, indexes };
}

export async function fallBackListTables(
  adapter: SqliteAdapter,
): Promise<TableInfo[]> {
  const result = await adapter.executeReadQuery(
    `SELECT name, type FROM sqlite_master
           WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
  );

  const tables: TableInfo[] = [];
  for (const row of result.rows ?? []) {
    const name = row["name"] as string;
    const type = row["type"] as "table" | "view";
    const tableInfo = await adapter.describeTable(name);
    tables.push({ ...tableInfo, type });
  }
  return tables;
}

export async function fallBackDescribeTable(
  adapter: SqliteAdapter,
  tableName: string,
): Promise<TableInfo> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new DbMcpError(
      "Invalid table name",
      "SQLITE_INVALID_TABLE",
      ErrorCategory.VALIDATION,
    );
  }
  const result = await adapter.executeReadQuery(
    `PRAGMA table_info("${tableName}")`,
  );
  const columns: ColumnInfo[] = (result.rows ?? []).map((row) => ({
    name: row["name"] as string,
    type: row["type"] as string,
    nullable: row["notnull"] === 0,
    primaryKey: row["pk"] === 1,
    defaultValue: row["dflt_value"],
  }));
  const countResult = await adapter.executeReadQuery(
    `SELECT COUNT(*) as count FROM "${tableName}"`,
  );
  const rowCount = (countResult.rows?.[0]?.["count"] as number) ?? 0;
  return {
    name: tableName,
    type: "table",
    columns,
    rowCount,
  };
}

export async function fallBackGetIndexes(
  adapter: SqliteAdapter,
  table?: string,
): Promise<IndexInfo[]> {
  let sql = `SELECT name, tbl_name, sql FROM sqlite_master
           WHERE type = 'index' AND sql IS NOT NULL`;
  if (table) {
    sql += ` AND tbl_name = '${table.replace(/'/g, "''")}'`;
  }
  const result = await adapter.executeReadQuery(sql);

  const indexes: IndexInfo[] = [];
  for (const row of result.rows ?? []) {
    const indexName = row["name"] as string;
    const tableName = row["tbl_name"] as string;
    const sqlDef = row["sql"] as string;

    let columns: string[];
    try {
      const indexInfo = await adapter.executeReadQuery(
        `PRAGMA index_info("${indexName}")`,
      );
      columns = (indexInfo.rows ?? []).map((col) => col["name"] as string);
    } catch {
      columns = [];
    }

    indexes.push({
      name: indexName,
      tableName,
      columns,
      unique: sqlDef?.toUpperCase().includes("UNIQUE") ?? false,
    });
  }

  return indexes;
}
