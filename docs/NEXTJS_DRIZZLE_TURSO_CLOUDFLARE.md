# Next.js + Drizzle ORM + Turso on Cloudflare Workers

Guide for deploying a Next.js app with Drizzle ORM and Turso (libSQL) to Cloudflare Workers via OpenNext.

## The Problem

`@libsql/client` doesn't work on Cloudflare Workers when deployed via OpenNext because:

1. **Next.js externalizes it** — `@libsql/client` is in Next.js's built-in `server-external-packages.jsonc`, so it's not bundled
2. **Workers can't load externals** — Cloudflare Workers don't have `node_modules` at runtime
3. **Bundling it blows up size** — using `transpilePackages` to force-bundle it pushes the worker over the 3MB free tier limit

## The Solution: `drizzle-orm/sqlite-proxy` + Turso HTTP API

Skip `@libsql/client` entirely. Use `drizzle-orm/sqlite-proxy` with a custom `fetch`-based callback that talks directly to Turso's Hrana v2 HTTP API.

### db.ts

```typescript
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

function toHttpUrl(url: string): string {
  return url
    .replace(/^libsql:\/\//, "https://")
    .replace(/^ws:\/\//, "http://")
    .replace(/^wss:\/\//, "https://");
}

function toHranaValue(param: unknown) {
  if (param === null || param === undefined) return { type: "null" as const };
  if (typeof param === "number" && Number.isInteger(param))
    return { type: "integer" as const, value: String(param) };
  if (typeof param === "number")
    return { type: "float" as const, value: param };
  if (typeof param === "string")
    return { type: "text" as const, value: param };
  if (typeof param === "bigint")
    return { type: "integer" as const, value: String(param) };
  return { type: "text" as const, value: String(param) };
}

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

// Lazy proxy to avoid crashing during edge build when env vars are absent
const globalForDb = globalThis as unknown as { db: DbClient | undefined };

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    if (!globalForDb.db) {
      globalForDb.db = createDbClient();
    }
    return Reflect.get(globalForDb.db, prop, receiver);
  },
});
```

### Why this works

- **Zero external dependencies** — only uses `fetch` (available in all runtimes)
- **Tiny bundle footprint** — no `@libsql/client` bloat
- **Full Drizzle support** — relational queries (`db.query.comments.findFirst`), selects, inserts, all work
- **Works everywhere** — Cloudflare Workers, Vercel Edge, Node.js, Deno

## Other Required Config

### open-next.config.ts

Prevent infinite build loop when `package.json` build command is `opennextjs-cloudflare build`:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

export default {
  ...config,
  buildCommand: "npx next build",
};
```

### package.json

```json
{
  "scripts": {
    "build": "opennextjs-cloudflare build",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

### next.config.ts

Add `export const dynamic = "force-dynamic"` to any page that queries the DB at the top level, or the build will try to prerender it and fail (no DB available at build time).

### Environment Variables

Set via `npx wrangler secret put <NAME>` (not in `wrangler.jsonc` — those get committed to git):

- `TURSO_DATABASE_URL` — e.g. `libsql://your-db.turso.io`
- `TURSO_AUTH_TOKEN` — from Turso dashboard

## Gotchas

1. **`@libsql/client` is auto-externalized by Next.js** — it's in `node_modules/next/dist/lib/server-external-packages.jsonc`. You can override with `transpilePackages: ["@libsql/client"]` in `next.config.ts`, but this adds ~250KB gzip to the bundle.

2. **Free Workers tier = 3MB gzip limit** — Next.js + OpenNext alone is ~2.9MB. There's almost no room for additional bundled dependencies. Paid plan ($5/mo) gives 10MB.

3. **`opennextjs-cloudflare build` calls `npm run build` internally** — if your build script IS `opennextjs-cloudflare build`, you get an infinite loop. Fix with `buildCommand: "npx next build"` in `open-next.config.ts`.

4. **DB queries in pages cause prerender failures** — the build has no DB access. Use `export const dynamic = "force-dynamic"` or wrap in try/catch with empty fallback.

5. **Wrangler deploy overrides Dashboard config** — any env vars set in the Cloudflare Dashboard will be wiped on deploy unless also in `wrangler.jsonc`. Use `wrangler secret put` for secrets — those persist.
