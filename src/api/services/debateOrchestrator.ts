import type {
  DebatePosition,
  WSMessage,
  DebateStartedPayload,
  DebateResumedPayload,
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
import {
  debateRepository,
  botRepository,
  betRepository,
  userRepository,
  topicRepository,
} from "../repositories/index.js";
import { decryptToken } from "../repositories/botRepository.js";
import type { Bot, Topic, RoundResult as DbRoundResult, DebateMessage } from "../db/types.js";
import { logger } from "./logger.js";
import { getBotConnectionServer } from "../ws/botConnectionServer.js";

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
      winner: DebatePosition | null; // null = tie
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
  private async runRound(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig
  ): Promise<void> {
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
  private async runVotingPhase(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig
  ): Promise<void> {
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
      const { proVotes, conVotes } = await debateRepository.countRoundVotes(
        state.debate.id,
        roundIndex
      );

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
    const { proVotes, conVotes } = await debateRepository.countRoundVotes(
      state.debate.id,
      roundIndex
    );

    // Determine winner (null if tie)
    const winner: DebatePosition | null =
      proVotes > conVotes ? "pro" : conVotes > proVotes ? "con" : null;

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

    // Calculate overall score (ties don't count)
    const overallScore = { pro: 0, con: 0 };
    for (const r of state.debate.roundResults) {
      if (r.winner === "pro") overallScore.pro++;
      else if (r.winner === "con") overallScore.con++;
      // ties (winner === null) don't add to either score
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
   *
   * Supports multi-pod deployments: if the debate is not active locally,
   * falls back to checking the database state.
   */
  async submitVote(
    debateId: number,
    roundIndex: number,
    walletAddress: string,
    choice: DebatePosition
  ): Promise<{ success: boolean; error?: string }> {
    // First check local in-memory state (fast path)
    const state = this.activeDebates.get(debateId);

    if (state) {
      // Debate is active locally - use in-memory state for validation
      if (state.debate.currentRoundIndex !== roundIndex) {
        return {
          success: false,
          error: `Wrong round (expected ${state.debate.currentRoundIndex}, got ${roundIndex})`,
        };
      }
      if (state.debate.roundStatus !== "voting") {
        return { success: false, error: `Voting not open (status: ${state.debate.roundStatus})` };
      }
    } else {
      // Debate not active locally - check database (multi-pod support)
      const debate = await debateRepository.findById(debateId);
      if (!debate) {
        return { success: false, error: "Debate not found" };
      }
      if (debate.status !== "in_progress") {
        return { success: false, error: "Debate not active" };
      }
      if (debate.currentRoundIndex !== roundIndex) {
        return {
          success: false,
          error: `Wrong round (expected ${debate.currentRoundIndex}, got ${roundIndex})`,
        };
      }
      if (debate.roundStatus !== "voting") {
        return { success: false, error: `Voting not open (status: ${debate.roundStatus})` };
      }
    }

    // Look up or create user by wallet address
    const user = await userRepository.findOrCreate(walletAddress);

    // Submit vote to database with user ID
    const vote = await debateRepository.submitVote({
      debateId,
      roundIndex,
      voterId: user.id,
      choice,
    });

    if (!vote) {
      return { success: false, error: "Already voted this round" };
    }

    return { success: true };
  }

  /**
   * Complete the debate and determine overall winner
   */
  private async completeDebate(state: DebateState): Promise<void> {
    // Count round wins (ties don't count)
    let proWins = 0;
    let conWins = 0;

    for (const result of state.debate.roundResults) {
      if (result.winner === "pro") proWins++;
      else if (result.winner === "con") conWins++;
      // ties (winner === null) don't add to either score
    }

    // Determine overall winner (null if tied)
    const winner: DebatePosition | null =
      proWins > conWins ? "pro" : conWins > proWins ? "con" : null;

    // Calculate ELO changes (only if there's a winner)
    let eloChanges = {
      winner: { oldElo: 0, newElo: 0, change: 0 },
      loser: { oldElo: 0, newElo: 0, change: 0 },
    };
    if (winner) {
      const winnerBot = winner === "pro" ? state.proBot : state.conBot;
      const loserBot = winner === "pro" ? state.conBot : state.proBot;
      eloChanges = calculateMatchEloChanges(winnerBot.elo, loserBot.elo);

      // Update bots ELO in database
      await Promise.all([
        botRepository.updateStats(winnerBot.id, true, eloChanges.winner.change),
        botRepository.updateStats(loserBot.id, false, eloChanges.loser.change),
      ]);
    }
    // If tied, no ELO changes

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
      eloChanges: winner
        ? {
            proBot: winner === "pro" ? eloChanges.winner : eloChanges.loser,
            conBot: winner === "con" ? eloChanges.winner : eloChanges.loser,
          }
        : {
            proBot: { oldElo: state.proBot.elo, newElo: state.proBot.elo, change: 0 },
            conBot: { oldElo: state.conBot.elo, newElo: state.conBot.elo, change: 0 },
          },
      payouts,
    };

    state.broadcast(state.debate.id, {
      type: "debate_ended",
      debateId: state.debate.id,
      payload: endPayload,
    });

    // Notify bots that their debate has completed (for auto-queue feature)
    const botServer = getBotConnectionServer();
    if (botServer) {
      const proEloChange =
        winner === "pro"
          ? eloChanges.winner.change
          : winner === "con"
            ? eloChanges.loser.change
            : 0;
      const conEloChange =
        winner === "con"
          ? eloChanges.winner.change
          : winner === "pro"
            ? eloChanges.loser.change
            : 0;

      botServer.notifyDebateComplete(
        state.proBot.id,
        state.debate.id,
        winner === "pro" ? true : winner === "con" ? false : null,
        proEloChange
      );
      botServer.notifyDebateComplete(
        state.conBot.id,
        state.debate.id,
        winner === "con" ? true : winner === "pro" ? false : null,
        conEloChange
      );
    }

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
    void debateRepository.update(debateId, { spectatorCount: count });

    state.broadcast(debateId, {
      type: "spectator_count",
      debateId,
      payload: { count },
    });
  }

  /**
   * Forfeit a debate - the forfeiting bot loses, opponent wins
   */
  async forfeitDebate(
    debateId: number,
    visitorId: number
  ): Promise<{ success: boolean; error?: string }> {
    const state = this.activeDebates.get(debateId);
    if (!state) {
      return { success: false, error: "Debate not found or not active" };
    }

    // Check if the user owns one of the bots
    const isProOwner = state.proBot.ownerId === visitorId;
    const isConOwner = state.conBot.ownerId === visitorId;

    if (!isProOwner && !isConOwner) {
      return { success: false, error: "You don't own a bot in this debate" };
    }

    // Determine winner (the bot that didn't forfeit)
    const forfeitingPosition: DebatePosition = isProOwner ? "pro" : "con";
    const winner: DebatePosition = forfeitingPosition === "pro" ? "con" : "pro";
    const winnerBot = winner === "pro" ? state.proBot : state.conBot;
    const loserBot = winner === "pro" ? state.conBot : state.proBot;

    // Calculate ELO changes (forfeit has same ELO impact as a loss)
    const eloChanges = calculateMatchEloChanges(winnerBot.elo, loserBot.elo);

    // Update bots ELO in database
    await Promise.all([
      botRepository.updateStats(winnerBot.id, true, eloChanges.winner.change),
      botRepository.updateStats(loserBot.id, false, eloChanges.loser.change),
    ]);

    // Settle bets - winner takes all
    const payouts = await betRepository.settleBets(state.debate.id, winner);

    // Count current round wins
    let proWins = 0;
    let conWins = 0;
    for (const result of state.debate.roundResults) {
      if (result.winner === "pro") proWins++;
      else conWins++;
    }

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

    // Broadcast forfeit
    state.broadcast(state.debate.id, {
      type: "debate_forfeit",
      debateId: state.debate.id,
      payload: {
        forfeitedBy: forfeitingPosition,
        forfeitedBotName: loserBot.name,
        winner,
        winnerBotName: winnerBot.name,
        finalScore: { pro: proWins, con: conWins },
        eloChanges: {
          proBot: winner === "pro" ? eloChanges.winner : eloChanges.loser,
          conBot: winner === "con" ? eloChanges.winner : eloChanges.loser,
        },
        payouts,
      },
    });

    // Remove from active debates
    this.activeDebates.delete(state.debate.id);

    logger.info(
      { debateId, forfeitedBy: loserBot.name, winner: winnerBot.name },
      "Debate forfeited"
    );

    return { success: true };
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
        preset: DebatePreset;
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
      preset: state.preset,
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
  getActiveDebates(): Array<
    DebateState["debate"] & {
      proBotName: string;
      proBotElo: number;
      conBotName: string;
      conBotElo: number;
    }
  > {
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

  /**
   * Recover a stuck debate after API restart.
   * Reconstructs state from DB, waits for bots to reconnect, then resumes.
   */
  async recoverDebate(debateId: number, broadcast: BroadcastFn): Promise<boolean> {
    logger.info({ debateId }, "Attempting to recover stuck debate");

    // Reconstruct state from database
    const state = await this.reconstructState(debateId, broadcast);
    if (!state) {
      logger.error({ debateId }, "Failed to reconstruct debate state");
      return false;
    }

    // Wait for bots to reconnect (up to 60 seconds)
    const botServer = getBotConnectionServer();
    if (!botServer) {
      logger.error({ debateId }, "Bot connection server not available");
      return false;
    }

    const startWait = Date.now();
    const maxWaitMs = 60000;
    let proConnected = false;
    let conConnected = false;

    while (Date.now() - startWait < maxWaitMs) {
      proConnected = await botServer.isConnected(state.proBot.id);
      conConnected = await botServer.isConnected(state.conBot.id);

      if (proConnected && conConnected) {
        break;
      }

      await this.sleep(2000);
    }

    if (!proConnected || !conConnected) {
      logger.warn(
        { debateId, proConnected, conConnected },
        "Bots did not reconnect in time, cancelling debate"
      );
      await this.cancelDebate(debateId, "Bots failed to reconnect after server restart");
      return false;
    }

    // Store in active debates
    this.activeDebates.set(debateId, state);

    // Broadcast debate resumed to spectators
    const resumePayload: DebateResumedPayload = {
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
      preset: state.preset,
      messages: state.messages.map((m) => ({
        roundIndex: m.roundIndex,
        position: m.position,
        botId: m.botId,
        content: m.content,
      })),
      resumingFromRound: state.debate.currentRoundIndex,
    };

    broadcast(debateId, {
      type: "debate_resumed",
      debateId,
      payload: resumePayload,
    });

    logger.info(
      {
        debateId,
        currentRound: state.debate.currentRoundIndex,
        roundStatus: state.debate.roundStatus,
      },
      "Debate recovered, resuming"
    );

    // Resume from where we left off
    await this.resumeFromCurrentRound(state);

    return true;
  }

  /**
   * Reconstruct DebateState from database records.
   */
  private async reconstructState(
    debateId: number,
    broadcast: BroadcastFn
  ): Promise<DebateState | null> {
    // Load debate from DB
    const dbDebate = await debateRepository.findById(debateId);
    if (!dbDebate) {
      logger.error({ debateId }, "Debate not found in database");
      return null;
    }

    // Load related data
    const [proBot, conBot, topic, dbRoundResults, dbMessages] = await Promise.all([
      botRepository.findById(dbDebate.proBotId),
      botRepository.findById(dbDebate.conBotId),
      topicRepository.findById(dbDebate.topicId),
      debateRepository.getRoundResults(debateId),
      debateRepository.getMessages(debateId),
    ]);

    if (!proBot || !conBot || !topic) {
      logger.error(
        { debateId, proBot: !!proBot, conBot: !!conBot, topic: !!topic },
        "Missing debate participants"
      );
      return null;
    }

    // Get preset
    const preset = getPreset(dbDebate.presetId) ?? getDefaultPreset();

    // Build round results array
    const roundResults = dbRoundResults.map((r: DbRoundResult) => ({
      roundIndex: r.roundIndex,
      roundName: preset.rounds[r.roundIndex]?.name ?? `Round ${r.roundIndex}`,
      proVotes: r.proVotes,
      conVotes: r.conVotes,
      winner: r.winner as DebatePosition | null,
    }));

    // Build messages array
    const messages = dbMessages.map((m: DebateMessage) => ({
      debateId: m.debateId,
      roundIndex: m.roundIndex,
      position: m.position as DebatePosition,
      botId: m.botId,
      content: m.content,
      timestamp: m.createdAt,
    }));

    // Reconstruct in-memory debate state
    const debate: DebateState["debate"] = {
      id: dbDebate.id,
      topicId: dbDebate.topicId,
      topic: topic.text,
      presetId: dbDebate.presetId,
      proBotId: dbDebate.proBotId,
      conBotId: dbDebate.conBotId,
      status: dbDebate.status as DebateState["debate"]["status"],
      currentRoundIndex: dbDebate.currentRoundIndex,
      roundStatus: dbDebate.roundStatus as DebateState["debate"]["roundStatus"],
      roundResults,
      winner: dbDebate.winner as DebatePosition | null,
      stake: dbDebate.stake,
      spectatorCount: dbDebate.spectatorCount,
      createdAt: dbDebate.createdAt,
      startedAt: dbDebate.startedAt,
      completedAt: dbDebate.completedAt,
    };

    return {
      debate,
      preset,
      proBot,
      conBot,
      topic,
      messages,
      votes: new Map(), // Will be repopulated during voting phases
      broadcast,
    };
  }

  /**
   * Resume debate from the current round based on roundStatus.
   */
  private async resumeFromCurrentRound(state: DebateState): Promise<void> {
    const { rounds } = state.preset;
    const currentIndex = state.debate.currentRoundIndex;
    const roundConfig = rounds[currentIndex];

    if (!roundConfig) {
      // No more rounds, complete the debate
      await this.completeDebate(state);
      return;
    }

    switch (state.debate.roundStatus) {
      case "pending":
        // Round hasn't started yet, run it from the beginning
        await this.runRemainingRounds(state, currentIndex);
        break;

      case "bot_responding":
        // Check which bot messages exist for this round and get missing ones
        await this.resumeBotResponding(state, currentIndex, roundConfig);
        break;

      case "voting":
        // Check if round result exists, restart voting if needed
        await this.resumeVoting(state, currentIndex, roundConfig);
        break;

      case "completed":
        // This round is done, move to next
        await this.runRemainingRounds(state, currentIndex + 1);
        break;
    }
  }

  /**
   * Run remaining rounds starting from the given index.
   */
  private async runRemainingRounds(state: DebateState, startIndex: number): Promise<void> {
    const { rounds } = state.preset;

    for (let i = startIndex; i < rounds.length; i++) {
      const roundConfig = rounds[i];
      if (!roundConfig) continue;

      state.debate.currentRoundIndex = i;
      await debateRepository.update(state.debate.id, { currentRoundIndex: i });

      await this.runRound(state, i, roundConfig);

      if (state.debate.status === "cancelled") {
        return;
      }
    }

    await this.completeDebate(state);
  }

  /**
   * Resume from bot_responding phase - check existing messages and get missing ones.
   */
  private async resumeBotResponding(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig
  ): Promise<void> {
    const { speaker, exchanges = 1 } = roundConfig;
    const existingMessages = state.messages.filter((m) => m.roundIndex === roundIndex);

    // Broadcast round started for reconnected spectators
    const roundPayload: RoundStartedPayload = {
      round: roundConfig.name,
      roundIndex,
      timeLimit: roundConfig.timeLimit,
    };
    state.broadcast(state.debate.id, {
      type: "round_started",
      debateId: state.debate.id,
      payload: roundPayload,
    });

    // Determine expected messages based on speaker config
    for (let exchange = 0; exchange < exchanges; exchange++) {
      if (speaker === "pro" || speaker === "both") {
        const hasProMessage = existingMessages.some(
          (m) => m.position === "pro" && existingMessages.indexOf(m) >= exchange * 2
        );
        if (!hasProMessage) {
          await this.getBotResponse(state, roundIndex, roundConfig, "pro", state.proBot);
        } else {
          // Re-broadcast existing message for reconnected spectators
          const proMsg = existingMessages.find((m) => m.position === "pro");
          if (proMsg) {
            this.broadcastExistingMessage(state, roundIndex, roundConfig, proMsg);
          }
        }
      }

      if (speaker === "con" || speaker === "both") {
        const hasConMessage = existingMessages.some(
          (m) =>
            m.position === "con" &&
            existingMessages.indexOf(m) >= exchange * 2 + (speaker === "both" ? 1 : 0)
        );
        if (!hasConMessage) {
          await this.getBotResponse(state, roundIndex, roundConfig, "con", state.conBot);
        } else {
          // Re-broadcast existing message for reconnected spectators
          const conMsg = existingMessages.find((m) => m.position === "con");
          if (conMsg) {
            this.broadcastExistingMessage(state, roundIndex, roundConfig, conMsg);
          }
        }
      }
    }

    // Proceed to voting
    state.debate.roundStatus = "voting";
    await debateRepository.update(state.debate.id, { roundStatus: "voting" });
    await this.runVotingPhase(state, roundIndex, roundConfig);

    state.debate.roundStatus = "completed";
    await debateRepository.update(state.debate.id, { roundStatus: "completed" });

    // Continue with remaining rounds
    await this.runRemainingRounds(state, roundIndex + 1);
  }

  /**
   * Broadcast an existing message for reconnected spectators.
   */
  private broadcastExistingMessage(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig,
    message: DebateState["messages"][0]
  ): void {
    const messagePayload: BotMessagePayload = {
      round: roundConfig.name,
      roundIndex,
      position: message.position,
      botId: message.botId,
      content: message.content,
      isComplete: true,
    };

    state.broadcast(state.debate.id, {
      type: "bot_message",
      debateId: state.debate.id,
      payload: messagePayload,
    });
  }

  /**
   * Resume from voting phase - check if round result exists.
   */
  private async resumeVoting(
    state: DebateState,
    roundIndex: number,
    roundConfig: RoundConfig
  ): Promise<void> {
    // Check if round result already exists
    const existingResult = state.debate.roundResults.find((r) => r.roundIndex === roundIndex);

    if (existingResult) {
      // Round result exists, voting was completed - move to next round
      state.debate.roundStatus = "completed";
      await debateRepository.update(state.debate.id, { roundStatus: "completed" });
      await this.runRemainingRounds(state, roundIndex + 1);
      return;
    }

    // Re-broadcast round messages for spectators
    const roundMessages = state.messages.filter((m) => m.roundIndex === roundIndex);
    for (const msg of roundMessages) {
      this.broadcastExistingMessage(state, roundIndex, roundConfig, msg);
    }

    // Restart voting phase (in-progress votes are lost but acceptable)
    await this.runVotingPhase(state, roundIndex, roundConfig);

    state.debate.roundStatus = "completed";
    await debateRepository.update(state.debate.id, { roundStatus: "completed" });

    // Continue with remaining rounds
    await this.runRemainingRounds(state, roundIndex + 1);
  }

  /**
   * Check if a debate is currently active (in-memory)
   */
  isDebateActive(debateId: number): boolean {
    return this.activeDebates.has(debateId);
  }

  /**
   * Release a debate from active tracking (for shutdown)
   */
  releaseDebate(debateId: number): void {
    this.activeDebates.delete(debateId);
  }

  /**
   * Get all active debate IDs (for shutdown cleanup)
   */
  getActiveDebateIds(): number[] {
    return Array.from(this.activeDebates.keys());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const debateOrchestrator = new DebateOrchestratorService();
