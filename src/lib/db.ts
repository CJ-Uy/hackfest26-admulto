import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleWeb } from "drizzle-orm/libsql/web";
import * as schema from "./schema";

/**
 * Creates a Drizzle ORM database client connected to Turso via libSQL.
 *
 * Uses TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.
 * Falls back to a local file-based SQLite for development when no URL is set.
 * In production (Cloudflare Workers), uses the web/HTTP client.
 */
type DbClient = ReturnType<typeof drizzleWeb<typeof schema>>;

function createDbClient(): DbClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    // Local dev fallback — file-based SQLite
    return drizzleLibsql({
      connection: "file:./local.db",
      schema,
    }) as unknown as DbClient;
  }

  return drizzleWeb({
    connection: { url, authToken },
    schema,
  }) as unknown as DbClient;
}

const globalForDb = globalThis as unknown as {
  db: DbClient | undefined;
};

/** Lazily-initialized DB client — avoids crashing during edge build when env vars are absent. */
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    if (!globalForDb.db) {
      globalForDb.db = createDbClient();
    }
    return Reflect.get(globalForDb.db, prop, receiver);
  },
});
