import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import type { WSMessage } from "../types/index.js";
import { SubmitVoteSchema } from "../types/index.js";
import { debateOrchestrator } from "../services/debateOrchestrator.js";
import {
  redis,
  redisSub,
  redisPub,
  KEYS,
  INSTANCE_ID,
  isRedisAvailable,
} from "../services/redis.js";
import { createChildLogger } from "../services/logger.js";

const logger = createChildLogger({ service: "debate-ws" });

interface Client {
  ws: WebSocket;
  debateId: number | null;
  userId: string | null;
}

/**
 * WebSocket Server for Debate Streaming
 *
 * Handles real-time updates for debates:
 * - Spectators joining/leaving debates
 * - Broadcasting bot messages
 * - Vote submission
 * - Spectator count updates
 *
 * With Redis enabled, supports horizontal scaling:
 * - Broadcasts are distributed across all instances via pub/sub
 * - Spectator counts are aggregated across instances
 */
export class DebateWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Client> = new Map();
  private debateSpectators: Map<number, Set<WebSocket>> = new Map();
  private subscribedDebates: Set<number> = new Set();

  constructor() {
    // Use noServer mode - upgrades handled externally
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });

    // Register Redis message handler for this instance
    // Note: The base handler is in redis.ts, but we need to forward to this instance's handleRedisMessage
    redisSub.on("message", (channel, message) => {
      this.handleRedisMessage(channel, message);
    });

    logger.info({ instance: INSTANCE_ID }, "Server initialized");
  }

  /**
   * Handle messages from Redis pub/sub
   */
  private handleRedisMessage(channel: string, message: string): void {
    // Check if this is a debate broadcast channel
    const match = channel.match(/^channel:debate:(\d+)$/);
    if (!match || !match[1]) return;

    const debateId = parseInt(match[1], 10);
    const spectators = this.debateSpectators.get(debateId);
    if (!spectators || spectators.size === 0) return;

    try {
      // Forward the message to all local spectators
      for (const ws of spectators) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Error forwarding Redis message");
    }
  }

  /**
   * Subscribe to Redis channel for a debate
   */
  private async subscribeToDebate(debateId: number): Promise<void> {
    if (!isRedisAvailable() || this.subscribedDebates.has(debateId)) return;

    const channel = KEYS.CHANNEL_DEBATE_BROADCAST(debateId);
    await redisSub.subscribe(channel);
    this.subscribedDebates.add(debateId);
    logger.debug({ debateId }, "Subscribed to debate channel");
  }

  /**
   * Unsubscribe from Redis channel for a debate
   */
  private async unsubscribeFromDebate(debateId: number): Promise<void> {
    if (!isRedisAvailable() || !this.subscribedDebates.has(debateId)) return;

    // Only unsubscribe if no local spectators remain
    const spectators = this.debateSpectators.get(debateId);
    if (spectators && spectators.size > 0) return;

    const channel = KEYS.CHANNEL_DEBATE_BROADCAST(debateId);
    await redisSub.unsubscribe(channel);
    this.subscribedDebates.delete(debateId);
    logger.debug({ debateId }, "Unsubscribed from debate channel");
  }

  /**
   * Handle an HTTP upgrade request for this WebSocket server
   */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  private handleConnection(ws: WebSocket): void {
    const client: Client = {
      ws,
      debateId: null,
      userId: null,
    };

    this.clients.set(ws, client);

    ws.on("message", (data: Buffer) => {
      this.handleMessage(client, data.toString("utf-8"));
    });

    ws.on("close", () => {
      void this.handleDisconnect(client);
    });

    ws.on("error", (error) => {
      logger.error({ err: error }, "WebSocket error");
      void this.handleDisconnect(client);
    });
  }

  private handleMessage(client: Client, data: string): void {
    try {
      const message = JSON.parse(data) as {
        type: string;
        payload?: unknown;
      };

      switch (message.type) {
        case "join_debate":
          void this.handleJoinDebate(
            client,
            message.payload as { debateId: number | string; userId?: string }
          );
          break;

        case "leave_debate":
          void this.handleLeaveDebate(client);
          break;

        case "submit_vote":
          void this.handleSubmitVote(client, message.payload);
          break;

        case "ping":
          client.ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          logger.warn({ type: message.type }, "Unknown message type");
      }
    } catch (error) {
      logger.error({ err: error }, "Error handling message");
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "INVALID_MESSAGE", message: "Invalid message format" },
        })
      );
    }
  }

  private async handleJoinDebate(
    client: Client,
    payload: { debateId: number | string; userId?: string }
  ): Promise<void> {
    const debateId =
      typeof payload.debateId === "number" ? payload.debateId : parseInt(payload.debateId, 10);
    const { userId } = payload;

    if (isNaN(debateId)) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "INVALID_DEBATE_ID", message: "Invalid debate ID" },
        })
      );
      return;
    }

    // Leave current debate if any
    if (client.debateId) {
      await this.handleLeaveDebate(client);
    }

    // Join new debate
    client.debateId = debateId;
    client.userId = userId ?? null;

    // Add to local spectators
    let spectators = this.debateSpectators.get(debateId);
    if (!spectators) {
      spectators = new Set();
      this.debateSpectators.set(debateId, spectators);
    }
    spectators.add(client.ws);

    // Subscribe to Redis channel for this debate
    await this.subscribeToDebate(debateId);

    // Update spectator count (in Redis if available)
    await this.updateSpectatorCount(debateId);

    // Send full debate state (including bots, topic, preset, and messages)
    const fullState = debateOrchestrator.getFullDebateState(debateId);
    if (fullState) {
      // Send debate_started event so client gets all the info
      client.ws.send(
        JSON.stringify({
          type: "debate_started",
          debateId,
          payload: {
            debate: fullState.debate,
            proBot: fullState.proBot,
            conBot: fullState.conBot,
            topic: fullState.topic,
            preset: fullState.preset,
          },
        })
      );

      // Send all existing messages
      for (const message of fullState.messages) {
        client.ws.send(
          JSON.stringify({
            type: "bot_message",
            debateId,
            payload: {
              roundIndex: message.roundIndex,
              position: message.position,
              botId: message.botId,
              content: message.content,
              isComplete: true,
            },
          })
        );
      }
    }

    logger.debug({ debateId, spectators: spectators.size, userId }, "Client joined debate");
  }

  private async handleLeaveDebate(client: Client): Promise<void> {
    if (!client.debateId) return;

    const debateId = client.debateId;
    const spectators = this.debateSpectators.get(debateId);

    if (spectators) {
      spectators.delete(client.ws);

      if (spectators.size === 0) {
        this.debateSpectators.delete(debateId);
        await this.unsubscribeFromDebate(debateId);
      }

      // Update spectator count
      await this.updateSpectatorCount(debateId);

      logger.debug({ debateId, spectators: spectators.size }, "Client left debate");
    }

    client.debateId = null;
    client.userId = null;
  }

  /**
   * Update spectator count in Redis and notify orchestrator
   */
  private async updateSpectatorCount(debateId: number): Promise<void> {
    const localCount = this.debateSpectators.get(debateId)?.size ?? 0;

    if (isRedisAvailable()) {
      // Store local count in Redis with instance key
      const key = `${KEYS.DEBATE_SPECTATOR_COUNT(debateId)}:${INSTANCE_ID}`;
      if (localCount > 0) {
        await redis.set(key, localCount.toString(), "EX", 60); // TTL 60 seconds
      } else {
        await redis.del(key);
      }

      // Get total count across all instances
      const pattern = `${KEYS.DEBATE_SPECTATOR_COUNT(debateId)}:*`;
      const keys = await redis.keys(pattern);
      let totalCount = 0;
      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        totalCount = values.reduce((sum, val) => sum + (parseInt(val ?? "0", 10) || 0), 0);
      }

      debateOrchestrator.updateSpectatorCount(debateId, totalCount);
    } else {
      debateOrchestrator.updateSpectatorCount(debateId, localCount);
    }
  }

  private async handleSubmitVote(client: Client, payload: unknown): Promise<void> {
    if (!client.debateId || !client.userId) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "NOT_AUTHENTICATED", message: "Must be authenticated to vote" },
        })
      );
      return;
    }

    const result = SubmitVoteSchema.safeParse(payload);
    if (!result.success) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "INVALID_VOTE", message: result.error.message },
        })
      );
      return;
    }

    const { debateId, roundIndex, choice } = result.data;

    if (debateId !== client.debateId) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "WRONG_DEBATE", message: "Vote is for a different debate" },
        })
      );
      return;
    }

    const voteResult = await debateOrchestrator.submitVote(
      debateId,
      roundIndex,
      client.userId,
      choice
    );

    if (voteResult.success) {
      client.ws.send(
        JSON.stringify({
          type: "vote_accepted",
          payload: { roundIndex, choice },
        })
      );
    } else {
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: {
            code: "VOTE_FAILED",
            message: voteResult.error || "Vote could not be submitted",
          },
        })
      );
    }
  }

  private async handleDisconnect(client: Client): Promise<void> {
    await this.handleLeaveDebate(client);
    this.clients.delete(client.ws);
  }

  /**
   * Broadcast a message to all spectators of a debate (across all instances)
   */
  broadcast(debateId: number, message: WSMessage): void {
    const data = JSON.stringify(message);

    if (isRedisAvailable()) {
      // Publish to Redis for cross-instance delivery
      const channel = KEYS.CHANNEL_DEBATE_BROADCAST(debateId);
      void redisPub.publish(channel, data);
    } else {
      // Single instance - broadcast directly
      const spectators = this.debateSpectators.get(debateId);
      if (!spectators) return;

      for (const ws of spectators) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      }
    }
  }

  /**
   * Get number of local spectators for a debate
   */
  getSpectatorCount(debateId: number): number {
    return this.debateSpectators.get(debateId)?.size ?? 0;
  }

  /**
   * Get total connected clients on this instance
   */
  getTotalClients(): number {
    return this.clients.size;
  }
}
