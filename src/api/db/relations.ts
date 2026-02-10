import { relations } from "drizzle-orm";
import {
  users,
  bots,
  topics,
  topicVotes,
  debates,
  roundResults,
  debateMessages,
  votes,
  bets,
} from "./schema.js";

// ============================================================================
// User Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  bots: many(bots),
  proposedTopics: many(topics),
  topicVotes: many(topicVotes),
  votes: many(votes),
  bets: many(bets),
}));

// ============================================================================
// Bot Relations
// ============================================================================

export const botsRelations = relations(bots, ({ one, many }) => ({
  owner: one(users, {
    fields: [bots.ownerId],
    references: [users.id],
  }),
  proDebates: many(debates, { relationName: "proBot" }),
  conDebates: many(debates, { relationName: "conBot" }),
  messages: many(debateMessages),
}));

// ============================================================================
// Topic Relations
// ============================================================================

export const topicsRelations = relations(topics, ({ one, many }) => ({
  proposer: one(users, {
    fields: [topics.proposerId],
    references: [users.id],
  }),
  debates: many(debates),
  votes: many(topicVotes),
}));

// ============================================================================
// Topic Votes Relations
// ============================================================================

export const topicVotesRelations = relations(topicVotes, ({ one }) => ({
  topic: one(topics, {
    fields: [topicVotes.topicId],
    references: [topics.id],
  }),
  voter: one(users, {
    fields: [topicVotes.voterId],
    references: [users.id],
  }),
}));

// ============================================================================
// Debate Relations
// ============================================================================

export const debatesRelations = relations(debates, ({ one, many }) => ({
  topic: one(topics, {
    fields: [debates.topicId],
    references: [topics.id],
  }),
  proBot: one(bots, {
    fields: [debates.proBotId],
    references: [bots.id],
    relationName: "proBot",
  }),
  conBot: one(bots, {
    fields: [debates.conBotId],
    references: [bots.id],
    relationName: "conBot",
  }),
  roundResults: many(roundResults),
  messages: many(debateMessages),
  votes: many(votes),
  bets: many(bets),
}));

// ============================================================================
// Round Results Relations
// ============================================================================

export const roundResultsRelations = relations(roundResults, ({ one }) => ({
  debate: one(debates, {
    fields: [roundResults.debateId],
    references: [debates.id],
  }),
}));

// ============================================================================
// Debate Messages Relations
// ============================================================================

export const debateMessagesRelations = relations(debateMessages, ({ one }) => ({
  debate: one(debates, {
    fields: [debateMessages.debateId],
    references: [debates.id],
  }),
  bot: one(bots, {
    fields: [debateMessages.botId],
    references: [bots.id],
  }),
}));

// ============================================================================
// Votes Relations
// ============================================================================

export const votesRelations = relations(votes, ({ one }) => ({
  debate: one(debates, {
    fields: [votes.debateId],
    references: [debates.id],
  }),
  voter: one(users, {
    fields: [votes.voterId],
    references: [users.id],
  }),
}));

// ============================================================================
// Bets Relations
// ============================================================================

export const betsRelations = relations(bets, ({ one }) => ({
  debate: one(debates, {
    fields: [bets.debateId],
    references: [debates.id],
  }),
  bettor: one(users, {
    fields: [bets.bettorId],
    references: [users.id],
  }),
}));
