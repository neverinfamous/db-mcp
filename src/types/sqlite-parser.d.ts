declare module "sqlite-parser" {
  export interface SQLiteNode {
    type: string;
    variant?: string;
    name?: string | SQLiteNode;
    [key: string]: unknown;
  }
  
  export interface SQLiteStatementList {
    type: "statement";
    variant: "list";
    statement: SQLiteNode[];
  }

  export default function parser(sql: string): SQLiteStatementList;
}
