import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WSMessage } from "../types/index.js";
import { SubmitVoteSchema } from "../types/index.js";
import { debateOrchestrator } from "../services/debateOrchestrator.js";

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
 */
export class DebateWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Client> = new Map();
  private debateSpectators: Map<number, Set<WebSocket>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });

    console.log("WebSocket server initialized on /ws");
  }

  private handleConnection(ws: WebSocket): void {
    const client: Client = {
      ws,
      debateId: null,
      userId: null,
    };

    this.clients.set(ws, client);

    ws.on("message", (data) => {
      this.handleMessage(client, data.toString());
    });

    ws.on("close", () => {
      this.handleDisconnect(client);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.handleDisconnect(client);
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
          this.handleJoinDebate(client, message.payload as { debateId: number | string; userId?: string });
          break;

        case "leave_debate":
          this.handleLeaveDebate(client);
          break;

        case "submit_vote":
          this.handleSubmitVote(client, message.payload);
          break;

        case "ping":
          client.ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      client.ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "INVALID_MESSAGE", message: "Invalid message format" },
        })
      );
    }
  }

  private handleJoinDebate(client: Client, payload: { debateId: number | string; userId?: string }): void {
    const debateId = typeof payload.debateId === "number" ? payload.debateId : parseInt(payload.debateId, 10);
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
      this.handleLeaveDebate(client);
    }

    // Join new debate
    client.debateId = debateId;
    client.userId = userId ?? null;

    // Add to spectators
    let spectators = this.debateSpectators.get(debateId);
    if (!spectators) {
      spectators = new Set();
      this.debateSpectators.set(debateId, spectators);
    }
    spectators.add(client.ws);

    // Update spectator count
    debateOrchestrator.updateSpectatorCount(debateId, spectators.size);

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

    console.log(`Client joined debate ${debateId}, spectators: ${spectators.size}`);
  }

  private handleLeaveDebate(client: Client): void {
    if (!client.debateId) return;

    const debateId = client.debateId;
    const spectators = this.debateSpectators.get(debateId);

    if (spectators) {
      spectators.delete(client.ws);

      if (spectators.size === 0) {
        this.debateSpectators.delete(debateId);
      } else {
        debateOrchestrator.updateSpectatorCount(debateId, spectators.size);
      }

      console.log(`Client left debate ${debateId}, spectators: ${spectators.size}`);
    }

    client.debateId = null;
    client.userId = null;
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

    const success = await debateOrchestrator.submitVote(debateId, roundIndex, client.userId, choice);

    if (success) {
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
          payload: { code: "VOTE_FAILED", message: "Vote could not be submitted" },
        })
      );
    }
  }

  private handleDisconnect(client: Client): void {
    this.handleLeaveDebate(client);
    this.clients.delete(client.ws);
  }

  /**
   * Broadcast a message to all spectators of a debate
   */
  broadcast(debateId: number, message: WSMessage): void {
    const spectators = this.debateSpectators.get(debateId);
    if (!spectators) return;

    const data = JSON.stringify(message);

    for (const ws of spectators) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Get number of spectators for a debate
   */
  getSpectatorCount(debateId: number): number {
    return this.debateSpectators.get(debateId)?.size ?? 0;
  }

  /**
   * Get total connected clients
   */
  getTotalClients(): number {
    return this.clients.size;
  }
}
