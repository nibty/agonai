import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { topics } from "../db/schema.js";
import { desc, sql, like } from "drizzle-orm";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

// Check AI topic specifically
const aiTopics = await db.select().from(topics).where(like(topics.text, "%AI will replace%"));
console.log("\nAI topics:");
for (const t of aiTopics) {
  const score = t.upvotes - t.downvotes;
  const weight = (score + 5) / (t.timesUsed + 1);
  console.log(`  [wt=${weight.toFixed(2)}] score=${score}, used=${t.timesUsed}: "${t.text}"`);
}

// Top 15 by weight
const result = await db
  .select({
    id: topics.id,
    text: topics.text,
    upvotes: topics.upvotes,
    downvotes: topics.downvotes,
    timesUsed: topics.timesUsed,
  })
  .from(topics)
  .orderBy(desc(sql`(${topics.upvotes} - ${topics.downvotes} + 5.0) / (${topics.timesUsed} + 1.0)`))
  .limit(15);

console.log("\nTop 15 topics by weight:");
for (const t of result) {
  const score = t.upvotes - t.downvotes;
  const weight = (score + 5) / (t.timesUsed + 1);
  console.log(
    `  [wt=${weight.toFixed(2)}] score=${score}, used=${t.timesUsed}: "${t.text.substring(0, 45)}"`
  );
}

await client.end();
