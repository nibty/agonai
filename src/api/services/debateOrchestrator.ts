import type {
  DebatePosition,
  WSMessage,
  DebateStartedPayload,
  RoundStartedPayload,
  BotMessagePayload,
  BotTypingPayload,
  VotingStartedPayload,
  VoteUpdatePayload,
  RoundEndedPayload,
  DebateEndedPayload,
  DebatePreset,
  RoundConfig,
} from "../types/index.js";
import { getPreset, getDefaultPreset } from "../types/index.js";
import { botRunner } from "./botRunner.js";
import { calculateMatchEloChanges } from "./elo.js";
import { debateRepository, botRepository, betRepository, userRepository } from "../repositories/index.js";
import { decryptToken } from "../repositories/botRepository.js";
import type { Bot, Topic } from "../db/types.js";

type BroadcastFn = (debateId: number, message: WSMessage) => void;

// In-memory representation for active debates
interface DebateState {
  debate: {
    id: number;
    topicId: number;
    topic: string;
    presetId: string;
    proBotId: number;
    conBotId: number;
    status: "pending" | "in_progress" | "voting" | "completed" | "cancelled";
    currentRoundIndex: number;
    roundStatus: "pending" | "bot_responding" | "voting" | "completed";
    roundResults: Array<{
      roundIndex: number;
      roundName: string;
      proVotes: number;
      conVotes: number;
      winner: DebatePosition;
    }>;
    winner: DebatePosition | null;
    stake: number;
    spectatorCount: number;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  preset: DebatePreset;
  proBot: Bot;
  conBot: Bot;
  topic: Topic;
  messages: Array<{
    debateId: number;
    roundIndex: number;
    position: DebatePosition;
    botId: number;
    content: string;
    timestamp: Date;
  }>;
  votes: Map<number, Map<number, DebatePosition>>; // roundIndex -> voterId -> choice
  broadcast: BroadcastFn;
}

/**
 * Debate Orchestrator Service
 *
 * Manages the lifecycle of debates - calling bots, collecting votes,
 * determining winners, and broadcasting updates to spectators.
 */
export class DebateOrchestratorService {
  private activeDebates: Map<number, DebateState> = new Map();

  /**
   * Create a new debate between two bots
   */
  async createDebate(
    proBot: Bot,
    conBot: Bot,
    topic: Topic,
    stake: number,
    presetId: string = "classic"
  ): Promise<DebateState["debate"]> {
    // Validate preset exists
    const preset = getPreset(presetId);
    if (!preset) {
      throw new Error(`Invalid preset ID: ${presetId}`);
    }

    // Create in database
    const dbDebate = await debateRepository.create({
      topicId: topic.id,
      proBotId: proBot.id,
      conBotId: conBot.id,
      presetId,
      status: "pending",
      currentRoundIndex: 0,
      roundStatus: "pending",
      stake,
    });

    // Return in-memory representation
    return {
      id: dbDebate.id,
      topicId: topic.id,
      topic: topic.text,
      presetId,
      proBotId: proBot.id,
      conBotId: conBot.id,
      status: "pending",
      currentRoundIndex: 0,
      roundStatus: "pending",
      roundResults: [],
      winner: null,
      stake,
      spectatorCount: 0,
      createdAt: dbDebate.createdAt,
      startedAt: null,
      completedAt: null,
    };
  }

  /**
   * Start a debate - begins the prep phase
   */
  async startDebate(
    debate: DebateState["debate"],
    proBot: Bot,
    conBot: Bot,
    topic: Topic,
    broadcast: BroadcastFn
  ): Promise<void> {
    // Load preset configuration
    const preset = getPreset(debate.presetId) ?? getDefaultPreset();
    const startedAt = new Date();

    // Update database
    await debateRepository.update(debate.id, {
      status: "in_progress",
      startedAt,
    });

    const state: DebateState = {
      debate: { ...debate, status: "in_progress", startedAt },
      preset,
      proBot,
      conBot,
      topic,
      messages: [],
      votes: new Map(),
      broadcast,
    };

    this.activeDebates.set(debate.id, state);

    // Broadcast debate started
    const startPayload: DebateStartedPayload = {
      debate: state.debate,
      proBot: {
        id: proBot.id,
        ownerId: proBot.ownerId,
        name: proBot.name,
        elo: proBot.elo,
        wins: proBot.wins,
        losses: proBot.losses,
        isActive: proBot.isActive,
      },
      conBot: {
        id: conBot.id,
        ownerId: conBot.ownerId,
        name: conBot.name,
        elo: conBot.elo,
        wins: conBot.wins,
        losses: conBot.losses,
        isActive: conBot.isActive,
      },
      topic,
      preset,
    };

    broadcast(debate.id, {
      type: "debate_started",
      debateId: debate.id,
      payload: startPayload,
    });

    // Wait for prep time (from preset)
    await this.sleep(preset.prepTime * 1000);

    // Start the rounds
    await this.runDebate(state);
  }

  /**
   * Run the debate through all rounds
   */
  private async runDebate(state: DebateState): Promise<void> {
    const { rounds } = state.preset;

    for (let i = 0; i < rounds.length; i++) {
      const roundConfig = rounds[i];
      if (!roundConfig) continue;

      state.debate.currentRoundIndex = i;

      // Update database
      await debateRepository.update(state.debate.id, {
        currentRoundIndex: i,
      });

      await this.runRound(state, i, roundConfig);

      // Check if debate was cancelled
      if (state.debate.status === "cancelled") {
        return;
      }
    }

    // Debate complete - determine winner
    await this.completeDebate(state);
  }

  /**
   * Run a single round of the debate
   */
  private async runRound(state: DebateState, roundIndex: number, roundConfig: RoundConfig): Promise<void> {
    const { timeLimit, speaker, exchanges = 1 } = roundConfig;

    // Broadcast round started
    const roundPayload: RoundStartedPayload = {
      round: roundConfig.name,
      roundIndex,
      timeLimit,
    };
    state.broadcast(state.debate.id, {
      type: "round_started",
      debateId: state.debate.id,
      payload: roundPayload,
    });

    state.debate.roundStatus = "bot_responding";
    await debateRepository.update(state.debate.id, { roundStatus: "bot_responding" });

    // Handle different speaker configurations
    for (let exchange = 0; exchange < exchanges; exchange++) {
      if (speaker === "pro") {
        await this.getBotResponse(state, roundIndex, roundConfig, "pro", state.proBot);
      } else if (speaker === "con") {
        await this.getBotResponse(state, roundIndex, roundConfig, "con", state.conBot);
      } else {
        // "both" - Pro goes first, then Con
        await this.getBotResponse(state, roundIndex, roundConfig, "pro", state.proBot);
        await this.getBotResponse(state, roundIndex, roundConfig, "con", state.conBot);
      }
    }

    // Voting phase
    state.debate.roundStatus = "voting";
    await debateRepository.update(state.debate.id, { roundStatus: "voting" });
    await this.runVotingPhase(state, roundIndex, roundConfig);

    state.debate.roundStatus = "completed";
    await debateRepository.update(state.debate.id, { roundStatus: "completed" });
  }

  /**
   * Get response from a bot and broadcast it
   */
  private async getBotResponse(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig,
    position: DebatePosition,
    bot: Bot
  ): Promise<void> {
    const { timeLimit } = roundConfig;

    // Broadcast typing indicator
    const typingPayload: BotTypingPayload = { position, botId: bot.id };
    state.broadcast(state.debate.id, {
      type: "bot_typing",
      debateId: state.debate.id,
      payload: typingPayload,
    });

    // Build request and call bot
    const request = botRunner.buildRequest(
      state.debate.id,
      roundIndex,
      roundConfig,
      state.topic.text,
      position,
      state.messages
    );

    // Decrypt auth token for HMAC signing (if configured)
    const authToken = bot.authTokenEncrypted ? decryptToken(bot.authTokenEncrypted) : null;
    const botForRunner = {
      id: bot.id,
      type: (bot.type ?? "http") as "http" | "openclaw",
      endpoint: bot.endpoint,
      authToken,
      authTokenEncrypted: bot.authTokenEncrypted ?? null,
    };

    const result = await botRunner.callBot(botForRunner, request, timeLimit * 1000);

    let content: string;
    if (result.success && result.response) {
      content = result.response.message;
    } else {
      // Bot failed - use a default message
      content = `[Bot failed to respond: ${result.error ?? "Unknown error"}]`;
    }

    // Create message in memory
    const message = {
      debateId: state.debate.id,
      roundIndex,
      position,
      botId: bot.id,
      content,
      timestamp: new Date(),
    };

    state.messages.push(message);

    // Persist message to database
    await debateRepository.addMessage({
      debateId: state.debate.id,
      roundIndex,
      position,
      botId: bot.id,
      content,
    });

    // Broadcast message
    const messagePayload: BotMessagePayload = {
      round: roundConfig.name,
      roundIndex,
      position,
      botId: bot.id,
      content,
      isComplete: true,
    };

    state.broadcast(state.debate.id, {
      type: "bot_message",
      debateId: state.debate.id,
      payload: messagePayload,
    });
  }

  /**
   * Run the voting phase for a round
   */
  private async runVotingPhase(state: DebateState, roundIndex: number, roundConfig: RoundConfig): Promise<void> {
    const voteWindow = state.preset.voteWindow;

    // Initialize votes for this round
    state.votes.set(roundIndex, new Map());

    // Broadcast voting started
    const votingPayload: VotingStartedPayload = {
      round: roundConfig.name,
      roundIndex,
      timeLimit: voteWindow,
    };
    state.broadcast(state.debate.id, {
      type: "voting_started",
      debateId: state.debate.id,
      payload: votingPayload,
    });

    // Wait for voting period, broadcasting updates
    const updateInterval = 1000; // Update every second
    const iterations = Math.ceil((voteWindow * 1000) / updateInterval);

    for (let i = 0; i < iterations; i++) {
      await this.sleep(updateInterval);

      // Get vote counts from database
      const { proVotes, conVotes } = await debateRepository.countRoundVotes(state.debate.id, roundIndex);

      const updatePayload: VoteUpdatePayload = {
        round: roundConfig.name,
        roundIndex,
        proVotes,
        conVotes,
      };
      state.broadcast(state.debate.id, {
        type: "vote_update",
        debateId: state.debate.id,
        payload: updatePayload,
      });
    }

    // Tally final votes from database
    const { proVotes, conVotes } = await debateRepository.countRoundVotes(state.debate.id, roundIndex);

    const winner: DebatePosition = proVotes >= conVotes ? "pro" : "con";

    const result = {
      roundIndex,
      roundName: roundConfig.name,
      proVotes,
      conVotes,
      winner,
    };

    state.debate.roundResults.push(result);

    // Persist round result to database
    await debateRepository.addRoundResult({
      debateId: state.debate.id,
      roundIndex,
      proVotes,
      conVotes,
      winner,
    });

    // Calculate overall score
    const overallScore = { pro: 0, con: 0 };
    for (const r of state.debate.roundResults) {
      if (r.winner === "pro") overallScore.pro++;
      else overallScore.con++;
    }

    // Broadcast round ended
    const roundEndPayload: RoundEndedPayload = {
      round: roundConfig.name,
      roundIndex,
      result,
      overallScore,
    };
    state.broadcast(state.debate.id, {
      type: "round_ended",
      debateId: state.debate.id,
      payload: roundEndPayload,
    });
  }

  /**
   * Submit a vote for the current round
   * @param walletAddress - The voter's wallet address (will be converted to user ID)
   */
  async submitVote(
    debateId: number,
    roundIndex: number,
    walletAddress: string,
    choice: DebatePosition
  ): Promise<boolean> {
    const state = this.activeDebates.get(debateId);
    if (!state) return false;

    // Check if voting is active for this round
    if (state.debate.currentRoundIndex !== roundIndex) return false;
    if (state.debate.roundStatus !== "voting") return false;

    // Look up or create user by wallet address
    const user = await userRepository.findOrCreate(walletAddress);

    // Submit vote to database with user ID
    const vote = await debateRepository.submitVote({
      debateId,
      roundIndex,
      voterId: user.id,
      choice,
    });

    return vote !== null;
  }

  /**
   * Complete the debate and determine overall winner
   */
  private async completeDebate(state: DebateState): Promise<void> {
    // Count round wins
    let proWins = 0;
    let conWins = 0;

    for (const result of state.debate.roundResults) {
      if (result.winner === "pro") proWins++;
      else conWins++;
    }

    const winner: DebatePosition = proWins >= conWins ? "pro" : "con";
    const winnerBot = winner === "pro" ? state.proBot : state.conBot;
    const loserBot = winner === "pro" ? state.conBot : state.proBot;

    // Calculate ELO changes
    const eloChanges = calculateMatchEloChanges(winnerBot.elo, loserBot.elo);

    // Update bots ELO in database
    await Promise.all([
      botRepository.updateStats(winnerBot.id, true, eloChanges.winner.change),
      botRepository.updateStats(loserBot.id, false, eloChanges.loser.change),
    ]);

    // Settle bets
    const payouts = await betRepository.settleBets(state.debate.id, winner);

    // Update debate state
    state.debate.status = "completed";
    state.debate.winner = winner;
    state.debate.completedAt = new Date();

    // Update database
    await debateRepository.update(state.debate.id, {
      status: "completed",
      winner,
      completedAt: state.debate.completedAt,
    });

    // Broadcast debate ended
    const endPayload: DebateEndedPayload = {
      winner,
      finalScore: { pro: proWins, con: conWins },
      eloChanges: {
        proBot: winner === "pro" ? eloChanges.winner : eloChanges.loser,
        conBot: winner === "con" ? eloChanges.winner : eloChanges.loser,
      },
      payouts,
    };

    state.broadcast(state.debate.id, {
      type: "debate_ended",
      debateId: state.debate.id,
      payload: endPayload,
    });

    // Remove from active debates
    this.activeDebates.delete(state.debate.id);
  }

  /**
   * Update spectator count for a debate
   */
  updateSpectatorCount(debateId: number, count: number): void {
    const state = this.activeDebates.get(debateId);
    if (!state) return;

    state.debate.spectatorCount = count;

    // Update database (fire and forget)
    debateRepository.update(debateId, { spectatorCount: count });

    state.broadcast(debateId, {
      type: "spectator_count",
      debateId,
      payload: { count },
    });
  }

  /**
   * Get active debate by ID
   */
  getDebate(debateId: number): DebateState["debate"] | undefined {
    return this.activeDebates.get(debateId)?.debate;
  }

  /**
   * Get full debate state for late joiners
   */
  getFullDebateState(debateId: number):
    | {
        debate: DebateState["debate"];
        proBot: {
          id: number;
          ownerId: number;
          name: string;
          elo: number;
          wins: number;
          losses: number;
          isActive: boolean;
        };
        conBot: {
          id: number;
          ownerId: number;
          name: string;
          elo: number;
          wins: number;
          losses: number;
          isActive: boolean;
        };
        topic: Topic;
        messages: DebateState["messages"];
      }
    | undefined {
    const state = this.activeDebates.get(debateId);
    if (!state) return undefined;

    return {
      debate: state.debate,
      proBot: {
        id: state.proBot.id,
        ownerId: state.proBot.ownerId,
        name: state.proBot.name,
        elo: state.proBot.elo,
        wins: state.proBot.wins,
        losses: state.proBot.losses,
        isActive: state.proBot.isActive,
      },
      conBot: {
        id: state.conBot.id,
        ownerId: state.conBot.ownerId,
        name: state.conBot.name,
        elo: state.conBot.elo,
        wins: state.conBot.wins,
        losses: state.conBot.losses,
        isActive: state.conBot.isActive,
      },
      topic: state.topic,
      messages: state.messages,
    };
  }

  /**
   * Get all active debates with bot info
   */
  getActiveDebates(): Array<DebateState["debate"] & {
    proBotName: string;
    proBotElo: number;
    conBotName: string;
    conBotElo: number;
  }> {
    return Array.from(this.activeDebates.values()).map((s) => ({
      ...s.debate,
      proBotName: s.proBot.name,
      proBotElo: s.proBot.elo,
      conBotName: s.conBot.name,
      conBotElo: s.conBot.elo,
    }));
  }

  /**
   * Cancel a debate
   */
  async cancelDebate(debateId: number, reason: string): Promise<void> {
    const state = this.activeDebates.get(debateId);
    if (!state) return;

    state.debate.status = "cancelled";

    // Update database
    await debateRepository.update(debateId, { status: "cancelled" });

    state.broadcast(debateId, {
      type: "error",
      debateId,
      payload: { code: "DEBATE_CANCELLED", message: reason },
    });

    this.activeDebates.delete(debateId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const debateOrchestrator = new DebateOrchestratorService();
