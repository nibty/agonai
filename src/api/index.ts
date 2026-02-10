import express from "express";
import cors from "cors";
import { createServer } from "http";
import { router } from "./api/routes.js";
import { DebateWebSocketServer } from "./ws/debateServer.js";
import { initBotConnectionServer } from "./ws/botConnectionServer.js";
import { matchmaking } from "./services/matchmaking.js";
import { debateOrchestrator } from "./services/debateOrchestrator.js";
import { topicRepository, botRepository } from "./repositories/index.js";
import { closeDatabase } from "./db/index.js";

const PORT = parseInt(process.env["PORT"] ?? "3001");

// Initialize Express
const app = express();

// CORS configuration - allow any localhost port in development
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Allow any localhost origin
      if (origin.startsWith("http://localhost:")) return callback(null, true);
      // Block other origins
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

// API routes
app.use("/api", router);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket servers
const wsServer = new DebateWebSocketServer();
const botWsServer = initBotConnectionServer();

// Centralized WebSocket upgrade handling
server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";

  if (url === "/ws") {
    wsServer.handleUpgrade(request, socket, head);
  } else if (url.match(/^\/bot\/connect\/[a-f0-9]{64}$/)) {
    botWsServer.handleUpgrade(request, socket, head);
  } else {
    // Unknown WebSocket path - destroy the socket
    socket.destroy();
  }
});

// Matchmaking loop - runs every 5 seconds
let matchmakingInterval: ReturnType<typeof setInterval>;

function startMatchmaking(): void {
  matchmakingInterval = setInterval(async () => {
    try {
      const stats = matchmaking.getStats();
      if (stats.queueSize > 0) {
        console.log(`[Matchmaking] Queue check: ${stats.queueSize} entries`);
      }

      const matches = await matchmaking.runMatchmaking(async (entry1, entry2) => {
      console.log(`[Matchmaking] Creating debate between bot ${entry1.botId} and ${entry2.botId}`);

      // Get bots from repository
      const bot1 = await botRepository.findById(entry1.botId);
      const bot2 = await botRepository.findById(entry2.botId);

      if (!bot1 || !bot2) {
        // Clean up stale queue entries for deleted bots
        if (!bot1) {
          console.warn(`[Matchmaking] Bot ${entry1.botId} not found, removing from queue`);
          matchmaking.removeFromQueue(entry1.botId);
        }
        if (!bot2) {
          console.warn(`[Matchmaking] Bot ${entry2.botId} not found, removing from queue`);
          matchmaking.removeFromQueue(entry2.botId);
        }
        throw new Error("Bot not found during matchmaking (stale entries cleaned)");
      }

      // Get random topic
      const topic = await topicRepository.getRandomTopic();
      if (!topic) {
        console.error("[Matchmaking] No topics available!");
        throw new Error("No topics available");
      }

      await topicRepository.markUsed(topic.id);

      // Randomly assign positions
      const [proBot, conBot] = Math.random() > 0.5 ? [bot1, bot2] : [bot2, bot1];

      // Create debate with the matched preset
      const stake = Math.min(entry1.stake, entry2.stake);
      const presetId = entry1.presetId; // Both entries have same preset (matched by preset)
      const debate = await debateOrchestrator.createDebate(proBot, conBot, topic, stake, presetId);

      // Start debate in background
      debateOrchestrator.startDebate(debate, proBot, conBot, topic, (debateId, message) =>
        wsServer.broadcast(debateId, message)
      );

      console.log(`Match created: ${proBot.name} vs ${conBot.name} on "${topic.text}"`);

      return debate;
    });

    if (matches.length > 0) {
      console.log(`Matchmaking: created ${matches.length} matches`);
    }
    } catch (error) {
      console.error("[Matchmaking] Error in matchmaking loop:", error);
    }
  }, 5000);
}

// Cleanup on shutdown
async function shutdown(): Promise<void> {
  console.log("\nShutting down...");
  clearInterval(matchmakingInterval);
  server.close();
  await closeDatabase();
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
║  Bot WS:    ws://localhost:${PORT}/bot/connect/:token        ║
║  Network:   X1 (https://rpc.mainnet.x1.xyz/)              ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Start matchmaking
  startMatchmaking();
  console.log("Matchmaking service started");
  console.log("Database connected (PostgreSQL via Drizzle)");
});
