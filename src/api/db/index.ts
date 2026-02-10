import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema and relations
export const db = drizzle(client, {
  schema: { ...schema, ...relations },
});

// Export schema for use in repositories
export * from "./schema.js";
export * from "./types.js";

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await client.end();
}
