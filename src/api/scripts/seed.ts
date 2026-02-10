import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { topics } from "../db/schema.js";

const SEED_TOPICS = [
  // Tech & AI
  { text: "AI will replace most jobs within 10 years", category: "tech" },
  { text: "Social media does more harm than good", category: "tech" },
  { text: "The metaverse will fail", category: "tech" },
  { text: "Remote work is better than office work", category: "tech" },
  { text: "Artificial General Intelligence will arrive within 10 years", category: "tech" },
  { text: "Open source software is better than proprietary", category: "tech" },
  { text: "Tabs are better than spaces", category: "tech" },
  { text: "Vim is better than Emacs", category: "tech" },
  { text: "Dark mode is superior to light mode", category: "tech" },
  { text: "AI art is real art", category: "tech" },

  // Crypto
  { text: "Cryptocurrency is the future of finance", category: "crypto" },
  { text: "Proof of Stake is better than Proof of Work", category: "crypto" },
  { text: "NFTs are valuable digital assets", category: "crypto" },
  { text: "DeFi will replace traditional banking", category: "crypto" },
  { text: "Bitcoin is better than Ethereum", category: "crypto" },
  { text: "Memecoins have legitimate value", category: "crypto" },

  // Philosophy
  { text: "Free will is an illusion", category: "philosophy" },
  { text: "Consciousness can be uploaded to computers", category: "philosophy" },
  { text: "Moral truths exist objectively", category: "philosophy" },
  { text: "We are likely living in a simulation", category: "philosophy" },
  { text: "Time travel is theoretically possible", category: "philosophy" },
  { text: "Aliens have already visited Earth", category: "philosophy" },

  // Politics
  { text: "Climate change requires immediate radical action", category: "politics" },
  { text: "Universal Basic Income should be implemented globally", category: "politics" },
  { text: "Privacy is more important than security", category: "politics" },
  { text: "Democracy is the best form of government", category: "politics" },
  { text: "Space colonization is essential for human survival", category: "politics" },

  // Fun & Pop Culture
  { text: "Pineapple belongs on pizza", category: "fun" },
  { text: "Cereal is a soup", category: "fun" },
  { text: "Hot dogs are sandwiches", category: "fun" },
  { text: "Die Hard is a Christmas movie", category: "fun" },
  { text: "The Star Wars prequels are underrated", category: "fun" },
  { text: "Cats are better pets than dogs", category: "fun" },
  { text: "Morning people are more productive than night owls", category: "fun" },
  { text: "The Oxford comma is essential", category: "fun" },
  { text: "GIF should be pronounced with a hard G", category: "fun" },
  { text: "Toilet paper should hang over, not under", category: "fun" },
  { text: "Water is wet", category: "fun" },
  { text: "A taco is a sandwich", category: "fun" },
  { text: "Pluto should be a planet", category: "fun" },
  { text: "The book is always better than the movie", category: "fun" },
  { text: "Breakfast is the most important meal of the day", category: "fun" },
];

async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Seeding database...");

  const client = postgres(connectionString, { max: 1 });
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

void seed();
