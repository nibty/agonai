import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!);

// Find and delete duplicates that aren't used in debates, keeping the one with lowest id
const result = await client`
  DELETE FROM topics
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM topics
    GROUP BY text
  )
  AND id NOT IN (
    SELECT DISTINCT topic_id FROM debates
  )
  RETURNING id, text
`;

console.log("Deleted duplicates:", result.length);
for (const r of result) {
  console.log("  -", (r.text as string).substring(0, 50));
}

await client.end();
