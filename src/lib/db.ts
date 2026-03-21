import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Creates a Drizzle ORM database client connected to Turso via libSQL.
 *
 * Uses TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.
 * Falls back to a local file-based SQLite for development when no URL is set.
 */
function createDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    // Local dev fallback — file-based SQLite
    return drizzle({
      connection: "file:./local.db",
      schema,
    });
  }

  return drizzle({
    connection: { url, authToken },
    schema,
  });
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
