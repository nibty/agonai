/**
 * Backfill script to add connection tokens to existing bots.
 * Run this after the migration that adds the connection_token column.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { isNull, eq } from "drizzle-orm";
import postgres from "postgres";
import { randomBytes } from "crypto";
import { bots } from "../db/schema.js";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

function generateConnectionToken(): string {
  return randomBytes(32).toString("hex");
}

async function backfillTokens(): Promise<void> {
  console.log("Backfilling connection tokens for existing bots...");

  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client);

  try {
    // Find bots without connection tokens
    const botsToUpdate = await db
      .select({ id: bots.id, name: bots.name })
      .from(bots)
      .where(isNull(bots.connectionToken));

    console.log(`Found ${botsToUpdate.length} bots without connection tokens`);

    for (const bot of botsToUpdate) {
      const token = generateConnectionToken();
      await db.update(bots).set({ connectionToken: token }).where(eq(bots.id, bot.id));

      console.log(`  Updated bot "${bot.name}" (${bot.id})`);
    }

    console.log("Backfill completed!");
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void backfillTokens();
