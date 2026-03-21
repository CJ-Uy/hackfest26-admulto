import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export default url
  ? defineConfig({
      dialect: "turso",
      schema: "./src/lib/schema.ts",
      out: "./drizzle",
      dbCredentials: { url, authToken },
    })
  : defineConfig({
      dialect: "sqlite",
      schema: "./src/lib/schema.ts",
      out: "./drizzle",
      dbCredentials: { url: "file:./local.db" },
    });
