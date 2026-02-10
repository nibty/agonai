/**
 * ELO Rating System for AI Debates Arena
 *
 * Uses standard ELO formula with K-factor of 32 for dynamic rating changes.
 * Higher K-factor means faster rating changes, suitable for a competitive game.
 */

const K_FACTOR = 32;
const MIN_ELO = 0;
const INITIAL_ELO = 1200;

/**
 * Calculate expected score (probability of winning) for a player
 * Based on rating difference using the standard ELO formula
 */
export function calculateExpectedScore(
  playerElo: number,
  opponentElo: number
): number {
  const exponent = (opponentElo - playerElo) / 400;
  return 1 / (1 + Math.pow(10, exponent));
}

/**
 * Calculate new ELO rating after a match
 * @param currentElo - Player's current ELO
 * @param opponentElo - Opponent's ELO
 * @param score - 1 for win, 0 for loss, 0.5 for draw
 * @returns Object with new ELO and change amount
 */
export function calculateNewElo(
  currentElo: number,
  opponentElo: number,
  score: number
): { oldElo: number; newElo: number; change: number } {
  const expectedScore = calculateExpectedScore(currentElo, opponentElo);
  const change = Math.round(K_FACTOR * (score - expectedScore));
  const newElo = Math.max(MIN_ELO, currentElo + change);

  return {
    oldElo: currentElo,
    newElo,
    change: newElo - currentElo,
  };
}

/**
 * Calculate ELO changes for both players after a match
 */
export function calculateMatchEloChanges(
  winnerElo: number,
  loserElo: number
): {
  winner: { oldElo: number; newElo: number; change: number };
  loser: { oldElo: number; newElo: number; change: number };
} {
  return {
    winner: calculateNewElo(winnerElo, loserElo, 1),
    loser: calculateNewElo(loserElo, winnerElo, 0),
  };
}

/**
 * Check if two players are within acceptable ELO range for matching
 */
export function isBalancedMatch(
  elo1: number,
  elo2: number,
  maxDifference = 200
): boolean {
  return Math.abs(elo1 - elo2) <= maxDifference;
}

/**
 * Get expanded match range based on wait time
 * Range expands over time to ensure matches happen
 */
export function getExpandedMatchRange(waitTimeSeconds: number): number {
  const baseRange = 100;
  const maxRange = 500;
  const expansionRate = 50 / 60; // 50 ELO per minute

  const expandedRange = baseRange + waitTimeSeconds * expansionRate;
  return Math.min(maxRange, Math.round(expandedRange));
}

/**
 * Calculate ELO difference needed for a given win probability
 */
export function eloDifferenceForProbability(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1 (exclusive)");
  }
  return Math.round(400 * Math.log10(probability / (1 - probability)));
}

/**
 * Get rank tier based on ELO
 */
export type RankTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "champion";

export function getRankTier(elo: number): RankTier {
  if (elo >= 3000) return "champion";
  if (elo >= 2500) return "diamond";
  if (elo >= 2000) return "platinum";
  if (elo >= 1500) return "gold";
  if (elo >= 1000) return "silver";
  return "bronze";
}

export function getNextRankThreshold(elo: number): number | null {
  if (elo >= 3000) return null;
  if (elo >= 2500) return 3000;
  if (elo >= 2000) return 2500;
  if (elo >= 1500) return 2000;
  if (elo >= 1000) return 1500;
  return 1000;
}

export { INITIAL_ELO, K_FACTOR, MIN_ELO };
