declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: Uint8Array | Buffer);
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): QueryExecResult[];
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>;
}
