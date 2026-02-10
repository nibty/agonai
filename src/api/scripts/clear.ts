import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function clear(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Dropping all tables and migration history...");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Drop all tables (CASCADE handles foreign key dependencies)
    await db.execute(sql`DROP TABLE IF EXISTS
      votes,
      bets,
      round_results,
      debate_messages,
      debates,
      topic_votes,
      topics,
      bots,
      auth_challenges,
      users
      CASCADE`);

    // Drop drizzle migration tracking table (in drizzle schema)
    await db.execute(sql`DROP TABLE IF EXISTS drizzle."__drizzle_migrations" CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

    console.log("All tables dropped successfully!");
    console.log("Run 'bun run db:migrate' to apply fresh migrations.");
  } catch (error) {
    console.error("Clear failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void clear();
