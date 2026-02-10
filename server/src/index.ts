import express from "express";
import cors from "cors";
import { createServer } from "http";
import { router } from "./api/routes.js";
import { DebateWebSocketServer } from "./ws/debateServer.js";
import { matchmaking } from "./services/matchmaking.js";
import { debateOrchestrator } from "./services/debateOrchestrator.js";
import * as store from "./services/store.js";

const PORT = parseInt(process.env["PORT"] ?? "3001");
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";

// Initialize Express
const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// API routes
app.use("/api", router);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wsServer = new DebateWebSocketServer(server);

// Matchmaking loop - runs every 5 seconds
let matchmakingInterval: ReturnType<typeof setInterval>;

function startMatchmaking(): void {
  matchmakingInterval = setInterval(() => {
    const matches = matchmaking.runMatchmaking((entry1, entry2) => {
      // Get bots
      const bot1 = store.getBotById(entry1.botId);
      const bot2 = store.getBotById(entry2.botId);

      if (!bot1 || !bot2) {
        throw new Error("Bot not found during matchmaking");
      }

      // Get random topic
      const topic = store.getRandomTopic();
      if (!topic) {
        throw new Error("No topics available");
      }

      store.markTopicUsed(topic.id);

      // Randomly assign positions
      const [proBot, conBot] =
        Math.random() > 0.5 ? [bot1, bot2] : [bot2, bot1];

      // Create debate
      const stake = Math.min(entry1.stake, entry2.stake);
      const debate = debateOrchestrator.createDebate(
        proBot,
        conBot,
        topic,
        stake
      );

      // Start debate in background
      debateOrchestrator.startDebate(
        debate,
        proBot,
        conBot,
        topic,
        (debateId, message) => wsServer.broadcast(debateId, message)
      );

      console.log(
        `Match created: ${proBot.name} vs ${conBot.name} on "${topic.text}"`
      );

      return debate;
    });

    if (matches.length > 0) {
      console.log(`Matchmaking: created ${matches.length} matches`);
    }
  }, 5000);
}

// Cleanup on shutdown
function shutdown(): void {
  console.log("\nShutting down...");
  clearInterval(matchmakingInterval);
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          AI DEBATES ARENA - Server                        ║
╠═══════════════════════════════════════════════════════════╣
║  API:       http://localhost:${PORT}/api                     ║
║  WebSocket: ws://localhost:${PORT}/ws                        ║
║  Network:   X1 (https://rpc.mainnet.x1.xyz/)              ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Seed initial data
  store.seedData();

  // Start matchmaking
  startMatchmaking();
  console.log("Matchmaking service started");
});
