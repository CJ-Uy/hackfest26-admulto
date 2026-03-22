import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * Converts a libsql:// URL to an https:// URL for the Turso HTTP API.
 */
function toHttpUrl(url: string): string {
  return url
    .replace(/^libsql:\/\//, "https://")
    .replace(/^ws:\/\//, "http://")
    .replace(/^wss:\/\//, "https://");
}

/**
 * Converts a JS value to a Hrana protocol value.
 */
function toHranaValue(param: unknown) {
  if (param === null || param === undefined) return { type: "null" as const };
  if (typeof param === "number" && Number.isInteger(param))
    return { type: "integer" as const, value: String(param) };
  if (typeof param === "number")
    return { type: "float" as const, value: param };
  if (typeof param === "string") return { type: "text" as const, value: param };
  if (typeof param === "bigint")
    return { type: "integer" as const, value: String(param) };
  return { type: "text" as const, value: String(param) };
}

/**
 * Extracts a plain JS value from a Hrana protocol value.
 */
function fromHranaValue(val: { type: string; value?: unknown }): unknown {
  switch (val.type) {
    case "null":
      return null;
    case "integer":
      return Number(val.value);
    case "float":
      return val.value;
    case "text":
      return val.value;
    case "blob":
      return val.value;
    default:
      return val.value ?? null;
  }
}

/**
 * Executes a SQL statement against Turso's HTTP API (Hrana v2 pipeline).
 */
async function tursoFetch(
  httpUrl: string,
  authToken: string | undefined,
  sql: string,
  params: unknown[],
  method: "run" | "all" | "values" | "get",
): Promise<{ rows: unknown[][] }> {
  const response = await fetch(`${httpUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: params.map(toHranaValue),
            named_args: [],
            want_rows: method !== "run",
          },
        },
        { type: "close" },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turso HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    results: {
      type: string;
      response?: {
        type: string;
        result?: {
          cols: { name: string }[];
          rows: { type: string; value?: unknown }[][];
        };
      };
      error?: { message: string };
    }[];
  };

  const result = data.results[0];
  if (result.type === "error") {
    throw new Error(`Turso SQL error: ${result.error?.message}`);
  }

  const stmtResult = result.response?.result;
  if (!stmtResult) return { rows: [] };

  // drizzle-orm/sqlite-proxy expects rows as positional arrays
  const rows = stmtResult.rows.map((row) => row.map(fromHranaValue));

  if (method === "get") {
    // drizzle-orm/sqlite-proxy expects a single flat row for "get", not wrapped in an array
    return { rows: (rows[0] ?? []) as unknown as unknown[][] };
  }

  return { rows };
}

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

function createDbClient(): DbClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Set it in .env for local dev or as a Cloudflare secret for production.",
    );
  }

  const httpUrl = toHttpUrl(url);

  return drizzle(
    async (sql, params, method) => {
      return tursoFetch(httpUrl, authToken, sql, params, method);
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
