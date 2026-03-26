import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

// Use the D1 driver type as the canonical DbClient type
type DbClient = ReturnType<typeof drizzleD1<typeof schema>>;

/**
 * Executes a SQL statement against the Cloudflare D1 HTTP API.
 * Used as fallback for local dev when native D1 binding isn't available.
 */
async function d1Fetch(
  accountId: string,
  databaseId: string,
  token: string,
  sql: string,
  params: unknown[],
  method: "run" | "all" | "values" | "get",
): Promise<{ rows: unknown[][] }> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    result: Array<{
      results: Record<string, unknown>[];
      success: boolean;
    }>;
    success: boolean;
    errors: { message: string }[];
  };

  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? "unknown error";
    throw new Error(`D1 query failed: ${msg}`);
  }

  if (method === "run") {
    return { rows: [] };
  }

  const result = data.result?.[0];
  if (!result?.results?.length) {
    return { rows: [] };
  }

  const cols = Object.keys(result.results[0]);
  const rows = result.results.map((row) => cols.map((col) => row[col]));

  if (method === "get") {
    return { rows: rows[0] as unknown as unknown[][] };
  }

  return { rows };
}

function createNativeClient(): DbClient | null {
  try {
    const ctx = getCloudflareContext();
    const d1 = (ctx.env as unknown as { DB: D1Database }).DB;
    if (d1) {
      return drizzleD1(d1, { schema });
    }
  } catch {
    // Context not available (e.g. dev mode race condition)
  }
  return null;
}

function createHttpClient(): DbClient {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !databaseId || !token) {
    throw new Error(
      "D1 binding unavailable and CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_D1_TOKEN env vars not set",
    );
  }

  return drizzleProxy(
    async (sql, params, method) => {
      return d1Fetch(accountId, databaseId, token, sql, params, method);
    },
    { schema },
  ) as unknown as DbClient;
}

const globalForDb = globalThis as unknown as {
  db: DbClient | undefined;
  isNative: boolean;
};

const isDev = process.env.NODE_ENV === "development";

/**
 * Lazily-initialized DB client.
 * Production: native D1 binding via getCloudflareContext().
 * Development: D1 HTTP API (hits remote D1, since local miniflare D1 has no tables).
 */
export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    if (!globalForDb.db) {
      if (isDev) {
        globalForDb.db = createHttpClient();
      } else {
        const native = createNativeClient();
        globalForDb.db = native ?? createHttpClient();
      }
    }
    return (globalForDb.db as unknown as Record<string | symbol, unknown>)[
      prop
    ];
  },
});
