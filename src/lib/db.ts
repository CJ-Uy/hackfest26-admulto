import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * Executes a SQL statement against the Cloudflare D1 HTTP API.
 * https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database
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

  // D1 returns objects; convert to row arrays preserving column order
  const cols = Object.keys(result.results[0]);
  const rows = result.results.map((row) => cols.map((col) => row[col]));

  if (method === "get") {
    return { rows: rows[0] as unknown as unknown[][] };
  }

  return { rows };
}

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

function createDbClient(): DbClient {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !databaseId || !token) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_D1_TOKEN must be set in .env",
    );
  }

  return drizzle(
    async (sql, params, method) => {
      return d1Fetch(accountId, databaseId, token, sql, params, method);
    },
    { schema },
  );
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
