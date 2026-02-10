import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "db/schema.ts",
  out: "drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://postgres:dev@localhost:5432/ai_debates",
  },
  verbose: true,
  strict: true,
});
