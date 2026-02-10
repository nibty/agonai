import type {
  DebateRound,
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
} from "../types/index.js";
import {
  DEBATE_ROUNDS,
  ROUND_DURATIONS,
  VOTE_WINDOW_SECONDS,
  PREP_TIME_SECONDS,
} from "../types/index.js";
import { botRunner } from "./botRunner.js";
import { calculateMatchEloChanges } from "./elo.js";
import { debateRepository, botRepository, betRepository, userRepository } from "../repositories/index.js";
import type { Bot, Topic } from "../db/types.js";

type BroadcastFn = (debateId: number, message: WSMessage) => void;

// In-memory representation for active debates (compatible with old types)
interface DebateState {
  debate: {
    id: number;
    topicId: number;
    topic: string;
    proBotId: number;
    conBotId: number;
    status: "pending" | "in_progress" | "voting" | "completed" | "cancelled";
    currentRound: DebateRound;
    roundStatus: "pending" | "bot_responding" | "voting" | "completed";
    roundResults: Array<{
      round: DebateRound;
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
  proBot: Bot;
  conBot: Bot;
  topic: Topic;
  messages: Array<{
    debateId: number;
    round: DebateRound;
    position: DebatePosition;
    botId: number;
    content: string;
    timestamp: Date;
  }>;
  votes: Map<string, Map<number, DebatePosition>>; // round -> voterId -> choice
  currentRoundIndex: number;
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
  async createDebate(proBot: Bot, conBot: Bot, topic: Topic, stake: number): Promise<DebateState["debate"]> {
    // Create in database
    const dbDebate = await debateRepository.create({
      topicId: topic.id,
      proBotId: proBot.id,
      conBotId: conBot.id,
      status: "pending",
      currentRound: "opening",
      roundStatus: "pending",
      stake,
    });

    // Return in-memory representation
    return {
      id: dbDebate.id,
      topicId: topic.id,
      topic: topic.text,
      proBotId: proBot.id,
      conBotId: conBot.id,
      status: "pending",
      currentRound: "opening",
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
    const startedAt = new Date();

    // Update database
    await debateRepository.update(debate.id, {
      status: "in_progress",
      startedAt,
    });

    const state: DebateState = {
      debate: { ...debate, status: "in_progress", startedAt },
      proBot,
      conBot,
      topic,
      messages: [],
      votes: new Map(),
      currentRoundIndex: 0,
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
    };

    broadcast(debate.id, {
      type: "debate_started",
      debateId: debate.id,
      payload: startPayload,
    });

    // Wait for prep time
    await this.sleep(PREP_TIME_SECONDS * 1000);

    // Start the rounds
    await this.runDebate(state);
  }

  /**
   * Run the debate through all rounds
   */
  private async runDebate(state: DebateState): Promise<void> {
    for (let i = 0; i < DEBATE_ROUNDS.length; i++) {
      state.currentRoundIndex = i;
      const round = DEBATE_ROUNDS[i];
      if (!round) continue;

      state.debate.currentRound = round;

      // Update database
      await debateRepository.update(state.debate.id, {
        currentRound: round,
      });

      await this.runRound(state, round);

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
  private async runRound(state: DebateState, round: DebateRound): Promise<void> {
    const timeLimit = ROUND_DURATIONS[round];

    // Broadcast round started
    const roundPayload: RoundStartedPayload = { round, timeLimit };
    state.broadcast(state.debate.id, {
      type: "round_started",
      debateId: state.debate.id,
      payload: roundPayload,
    });

    state.debate.roundStatus = "bot_responding";
    await debateRepository.update(state.debate.id, { roundStatus: "bot_responding" });

    // Pro bot goes first
    await this.getBotResponse(state, round, "pro", state.proBot, timeLimit);

    // Con bot responds
    await this.getBotResponse(state, round, "con", state.conBot, timeLimit);

    // Voting phase
    state.debate.roundStatus = "voting";
    await debateRepository.update(state.debate.id, { roundStatus: "voting" });
    await this.runVotingPhase(state, round);

    state.debate.roundStatus = "completed";
    await debateRepository.update(state.debate.id, { roundStatus: "completed" });
  }

  /**
   * Get response from a bot and broadcast it
   */
  private async getBotResponse(
    state: DebateState,
    round: DebateRound,
    position: DebatePosition,
    bot: Bot,
    timeLimit: number
  ): Promise<void> {
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
      round,
      state.topic.text,
      position,
      timeLimit,
      state.messages
    );

    const result = await botRunner.callBot(bot, request, timeLimit * 1000);

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
      round,
      position,
      botId: bot.id,
      content,
      timestamp: new Date(),
    };

    state.messages.push(message);

    // Persist message to database
    await debateRepository.addMessage({
      debateId: state.debate.id,
      round,
      position,
      botId: bot.id,
      content,
    });

    // Broadcast message
    const messagePayload: BotMessagePayload = {
      round,
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
  private async runVotingPhase(state: DebateState, round: DebateRound): Promise<void> {
    // Initialize votes for this round
    state.votes.set(round, new Map());

    // Broadcast voting started
    const votingPayload: VotingStartedPayload = {
      round,
      timeLimit: VOTE_WINDOW_SECONDS,
    };
    state.broadcast(state.debate.id, {
      type: "voting_started",
      debateId: state.debate.id,
      payload: votingPayload,
    });

    // Wait for voting period, broadcasting updates
    const updateInterval = 1000; // Update every second
    const iterations = Math.ceil((VOTE_WINDOW_SECONDS * 1000) / updateInterval);

    for (let i = 0; i < iterations; i++) {
      await this.sleep(updateInterval);

      // Get vote counts from database
      const { proVotes, conVotes } = await debateRepository.countRoundVotes(state.debate.id, round);

      const updatePayload: VoteUpdatePayload = { round, proVotes, conVotes };
      state.broadcast(state.debate.id, {
        type: "vote_update",
        debateId: state.debate.id,
        payload: updatePayload,
      });
    }

    // Tally final votes from database
    const { proVotes, conVotes } = await debateRepository.countRoundVotes(state.debate.id, round);

    const winner: DebatePosition = proVotes >= conVotes ? "pro" : "con";

    const result = {
      round,
      proVotes,
      conVotes,
      winner,
    };

    state.debate.roundResults.push(result);

    // Persist round result to database
    await debateRepository.addRoundResult({
      debateId: state.debate.id,
      round,
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
      round,
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
   * @param walletAddress - The voter's wallet address (will be converted to user UUID)
   */
  async submitVote(
    debateId: number,
    round: DebateRound,
    walletAddress: string,
    choice: DebatePosition
  ): Promise<boolean> {
    const state = this.activeDebates.get(debateId);
    if (!state) return false;

    // Check if voting is active for this round
    if (state.debate.currentRound !== round) return false;
    if (state.debate.roundStatus !== "voting") return false;

    // Look up or create user by wallet address
    const user = await userRepository.findOrCreate(walletAddress);

    // Submit vote to database with user UUID
    const vote = await debateRepository.submitVote({
      debateId,
      round,
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
