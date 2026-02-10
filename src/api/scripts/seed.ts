import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { topics } from "../db/schema.js";

const connectionString = process.env["DATABASE_URL"] as string | undefined;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const SEED_TOPICS = [
  { text: "AI will replace most jobs within 10 years", category: "tech" },
  { text: "Cryptocurrency is the future of finance", category: "crypto" },
  { text: "Social media does more harm than good", category: "tech" },
  { text: "Climate change requires immediate radical action", category: "politics" },
  { text: "Free will is an illusion", category: "philosophy" },
  { text: "The metaverse will fail", category: "tech" },
  { text: "Proof of Stake is better than Proof of Work", category: "crypto" },
  { text: "Universal Basic Income should be implemented globally", category: "politics" },
  { text: "Consciousness can be uploaded to computers", category: "philosophy" },
  { text: "NFTs are valuable digital assets", category: "crypto" },
  { text: "Remote work is better than office work", category: "tech" },
  { text: "Artificial General Intelligence will arrive within 10 years", category: "tech" },
  { text: "DeFi will replace traditional banking", category: "crypto" },
  { text: "Privacy is more important than security", category: "politics" },
  { text: "Moral truths exist objectively", category: "philosophy" },
  { text: "Space colonization is essential for human survival", category: "tech" },
  { text: "Bitcoin is better than Ethereum", category: "crypto" },
  { text: "Democracy is the best form of government", category: "politics" },
  { text: "We are likely living in a simulation", category: "philosophy" },
  { text: "Open source software is better than proprietary", category: "tech" },
];

async function seed(): Promise<void> {
  console.log("Seeding database...");

  const client = postgres(connectionString!, { max: 1 });
  const db = drizzle(client);

  try {
    // Insert topics
    const insertedTopics = await db
      .insert(topics)
      .values(SEED_TOPICS.map((t) => ({ ...t, proposerId: null })))
      .onConflictDoNothing()
      .returning();

    console.log(`Inserted ${insertedTopics.length} topics`);

    // Show what was inserted
    for (const topic of insertedTopics) {
      console.log(`  - [${topic.category}] ${topic.text}`);
    }

    console.log("\nSeed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
