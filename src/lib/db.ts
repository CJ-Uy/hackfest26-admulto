import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Creates a Drizzle ORM database client connected to Turso via libSQL.
 *
 * Uses TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.
 * The @libsql/client package resolves to the web/HTTP client automatically
 * in Cloudflare Workers via the "workerd" export condition.
 */
type DbClient = ReturnType<typeof drizzle<typeof schema>>;

function createDbClient(): DbClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Set it in .env for local dev or as a Cloudflare secret for production.",
    );
  }

  const client = createClient({ url, authToken });
  return drizzle(client, { schema }) as unknown as DbClient;
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
