import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { databasePoolOptions } from "./config";
import pg from "pg";
import { sql, type SQL } from "drizzle-orm";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import dotenv from "dotenv";
import * as schema from "./schema";
export { sql };
export { isLocalHostname } from "./config";
export * as schema from "./schema";
export interface Database {
  query<T = Record<string, unknown>>(q: SQL): Promise<T[]>;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function rootPath() {
  let p = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(p, "pnpm-workspace.yaml"))) return p;
    const next = dirname(p);
    if (next === p) break;
    p = next;
  }
  throw new Error("Run MessMate from inside its workspace.");
}
export function loadEnv() {
  dotenv.config({ path: resolve(rootPath(), ".env") });
}
function adapter(
  execute: (q: SQL) => Promise<{ rows: unknown[] }>,
  transaction: <T>(fn: (db: Database) => Promise<T>) => Promise<T>,
  close: () => Promise<void>,
): Database {
  return {
    query: async <T>(q: SQL) => (await execute(q)).rows as T[],
    transaction,
    close,
  };
}
export async function connect(url: string): Promise<Database> {
  if (url.startsWith("pglite://") || url === "memory://") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Production requires PostgreSQL.");
    const [{ PGlite }, { drizzle: pgliteDrizzle }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);
    const dir =
      url === "memory://" ? undefined : resolve(rootPath(), url.slice(9));
    if (dir) mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await client.waitReady;
    const db = pgliteDrizzle(client, { schema });
    return adapter(
      (q) => db.execute(q),
      (fn) =>
        db.transaction((tx) =>
          fn(
            adapter(
              (q) => tx.execute(q),
              async () => {
                throw new Error("Nested transaction unsupported");
              },
              async () => {},
            ),
          ),
        ),
      () => client.close(),
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url))
    throw new Error("DATABASE_URL must be PostgreSQL or pglite://");
  const pool = new pg.Pool(databasePoolOptions(url));
  pool.on("error", () => {
    console.error(JSON.stringify({ event: "database_pool_error" }));
  });
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  const db = pgDrizzle(pool, { schema });
  return adapter(
    (q) => db.execute(q),
    (fn) =>
      db.transaction((tx) =>
        fn(
          adapter(
            (q) => tx.execute(q),
            async () => {
              throw new Error("Nested transaction unsupported");
            },
            async () => {},
          ),
        ),
      ),
    () => pool.end(),
  );
}
export async function migrate(db: Database) {
  await db.query(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  for (const name of readdirSync(
    resolve(rootPath(), "packages/database/migrations"),
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await db.transaction(async (tx) => {
      await tx.query(sql`LOCK TABLE schema_migrations IN EXCLUSIVE MODE`);
      if (
        (
          await tx.query(
            sql`SELECT name FROM schema_migrations WHERE name=${name}`,
          )
        ).length
      )
        return;
      const body = readFileSync(
        resolve(rootPath(), "packages/database/migrations", name),
        "utf8",
      );
      for (const statement of body
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.query(sql.raw(statement));
      await tx.query(sql`INSERT INTO schema_migrations(name) VALUES(${name})`);
    });
  }
}
