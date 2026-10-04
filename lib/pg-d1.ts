// Cloudflare D1과 같은 모양(prepare/bind/first/all/run/batch)으로 Postgres를 쓰게 해 주는 얇은 래퍼.
// 서버 코드는 env.DB만 바라보므로, 이 래퍼 하나로 D1 → Supabase Postgres 이전이 끝난다.
// postgres.js 클라이언트는 밖에서 만들어 넘긴다(Deno: npm:postgres, 테스트: node postgres).

type Rows = any[] & {count?: number};
export type PgClient = {
  unsafe: (query: string, params?: any[]) => Promise<Rows>;
  begin: <T>(fn: (tx: PgClient) => Promise<T>) => Promise<T>;
};
type Result = {results: any[]; success: true; meta: {changes: number}};

/** SQLite식 SQL을 Postgres로: `?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING` */
export function translate(query: string) {
  let ignore = false, n = 0;
  let sql = query.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, () => { ignore = true; return 'INSERT INTO'; });
  sql = sql.replace(/'(?:[^']|'')*'|\?/g, m => (m === '?' ? '$' + ++n : m));
  if (ignore) sql = /\bRETURNING\b/i.test(sql) ? sql.replace(/\bRETURNING\b/i, 'ON CONFLICT DO NOTHING RETURNING') : sql.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  return sql;
}

const clean = (v: any) => (v === undefined ? null : v);

class Statement {
  db: PgD1; query: string; params: any[];
  constructor(db: PgD1, query: string, params: any[] = []) { this.db = db; this.query = query; this.params = params; }
  bind(...params: any[]) { return new Statement(this.db, this.query, params.map(clean)); }
  async exec(client: PgClient): Promise<Result> {
    const rows = await client.unsafe(translate(this.query), this.params);
    return {results: [...rows], success: true, meta: {changes: rows.count ?? rows.length}};
  }
  async first<T = any>(column?: string): Promise<T | null> {
    const row = (await this.exec(this.db.client)).results[0];
    if (row === undefined) return null;
    return (column ? row[column] : row) as T;
  }
  async all<T = any>(): Promise<{results: T[]; success: true; meta: {changes: number}}> { return this.exec(this.db.client) as any; }
  async run(): Promise<Result> { return this.exec(this.db.client); }
  async raw(): Promise<any[][]> { return (await this.exec(this.db.client)).results.map(r => Object.values(r)); }
}

export class PgD1 {
  client: PgClient;
  constructor(client: PgClient) { this.client = client; }
  prepare(query: string) { return new Statement(this, query); }
  /** D1 batch는 하나의 트랜잭션이다. */
  async batch(statements: Statement[]) { return this.client.begin(async tx => { const out: Result[] = []; for (const s of statements) out.push(await s.exec(tx)); return out; }); }
  async exec(query: string) { await this.client.unsafe(query); return {count: 1, duration: 0}; }
}

/** int8(bigint) 컬럼과 count(*)를 JS number로 받는다(D1과 같은 동작). */
export const pgTypes = {bigint: {to: 20, from: [20], serialize: (x: any) => String(x), parse: (x: string) => Number(x)}};
