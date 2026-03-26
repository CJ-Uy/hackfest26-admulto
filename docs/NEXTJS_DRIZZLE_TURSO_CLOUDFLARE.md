# Next.js + Drizzle ORM + Cloudflare D1 on Cloudflare Workers

Guide for deploying a Next.js app with Drizzle ORM and Cloudflare D1 to Cloudflare Workers via OpenNext.

---

## Turso → D1 Migration Notes

If you were previously on Turso (`@libsql/client` or `sqlite-proxy` + Turso HTTP API), switch to D1 because:

- `@libsql/client` doesn't work on Cloudflare Workers (externalized by Next.js, not available at runtime)
- The `sqlite-proxy` + HTTP API workaround works but breaks Drizzle relational queries (`with:` clauses) due to manual row-to-object conversion
- D1 native binding is faster (no HTTP roundtrip) and correctly supported by `drizzle-orm/d1`

---

## The Solution: Native D1 Binding in Production, HTTP API Fallback in Dev

### Why two modes?

- **Production (Cloudflare Workers):** Use the native D1 binding via `getCloudflareContext()`. Direct, fast, reliable. Fixes relational queries.
- **Local dev (`next dev`):** `initOpenNextCloudflareForDev` creates a local empty D1 via miniflare — it has no tables. Use the D1 HTTP API instead to hit your real remote D1.

### db.ts

```typescript
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzleD1<typeof schema>>;

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
    result: Array<{ results: Record<string, unknown>[]; success: boolean }>;
    success: boolean;
    errors: { message: string }[];
  };

  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? "unknown error";
    throw new Error(`D1 query failed: ${msg}`);
  }

  if (method === "run") return { rows: [] };

  const result = data.result?.[0];
  if (!result?.results?.length) return { rows: [] };

  const cols = Object.keys(result.results[0]);
  const rows = result.results.map((row) => cols.map((col) => row[col]));

  if (method === "get") return { rows: rows[0] as unknown as unknown[][] };

  return { rows };
}

function createNativeClient(): DbClient | null {
  try {
    const ctx = getCloudflareContext();
    const d1 = (ctx.env as unknown as { DB: D1Database }).DB;
    if (d1) return drizzleD1(d1, { schema });
  } catch {
    // Context not available
  }
  return null;
}

function createHttpClient(): DbClient {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !databaseId || !token) {
    throw new Error(
      "D1 binding unavailable and CLOUDFLARE_ACCOUNT_ID/DATABASE_ID/TOKEN env vars not set",
    );
  }

  return drizzleProxy(
    async (sql, params, method) => d1Fetch(accountId, databaseId, token, sql, params, method),
    { schema },
  ) as unknown as DbClient;
}

const isDev = process.env.NODE_ENV === "development";
const globalForDb = globalThis as unknown as { db: DbClient | undefined };

/**
 * Production: native D1 binding (fast, correct relational queries).
 * Dev: D1 HTTP API hitting remote D1 (local miniflare D1 has no tables).
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
    return (globalForDb.db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

### Why this works

- **Production:** `getCloudflareContext()` is synchronous and always available (set by the Worker entrypoint before any request). `drizzle-orm/d1` handles all query types correctly including relational `with:` clauses.
- **Dev:** HTTP API hits the real remote D1. `NODE_ENV === "development"` skips the native binding entirely, avoiding the empty miniflare D1.
- **Lazy Proxy:** `globalForDb.db` is only initialized on first use, never at build time.

---

## Required Config

### wrangler.jsonc — D1 binding

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-db-name",
      "database_id": "your-db-id"
    }
  ]
}
```

The binding name `"DB"` must match what `db.ts` reads from `ctx.env.DB`.

### drizzle.config.ts — migrations via HTTP API

```typescript
export default {
  dialect: "sqlite",
  driver: "d1-http",   // HTTP API driver for drizzle-kit push/generate (runs locally)
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
};
```

`drizzle-kit push` runs on your local machine and correctly uses the HTTP API to apply schema changes to the remote D1.

### next.config.ts

```typescript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

export default {};
```

### .env (local dev only)

```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_D1_DATABASE_ID=...
CLOUDFLARE_D1_TOKEN=...   # a Cloudflare API token with D1 edit permissions
```

These are only needed locally for `next dev` (HTTP API fallback) and `drizzle-kit push`. In production, the native D1 binding handles everything — no env vars needed.

---

## Gotchas

1. **`initOpenNextCloudflareForDev` creates an empty local D1** — miniflare starts a fresh SQLite file with no tables. Don't rely on it for dev; use the HTTP API to hit your real D1 instead (handled by the `isDev` check above).

2. **`sqlite-proxy` breaks relational queries** — Drizzle's `db.query.table.findFirst({ with: { ... } })` returns `undefined` for the nested relation when using `sqlite-proxy` because the manual row-to-array conversion doesn't match what the relational query engine expects. Use `drizzle-orm/d1` in production.

3. **D1 HTTP API parameter limit** — 100 bound parameters per query. With 16 columns per row, batch inserts at max 6 rows per statement: `for (let i = 0; i < rows.length; i += 6) { await db.insert(table).values(rows.slice(i, i + 6)); }`. The native D1 binding has the same limit.

4. **`global_fetch_strictly_public` flag** — if set in `wrangler.jsonc`, outbound `fetch()` inside Workers can only reach public hosts. `api.cloudflare.com` is public so the HTTP API works, but this is one reason to prefer the native binding in production.

5. **Wrangler deploy wipes Dashboard env vars** — any vars set in the Cloudflare Dashboard are overwritten on deploy unless also in `wrangler.jsonc`. Use `wrangler secret put` for secrets — those persist across deploys.

6. **DB queries in pages cause prerender failures** — the build has no DB access. Add `export const dynamic = "force-dynamic"` to any page that queries the DB at the top level.
