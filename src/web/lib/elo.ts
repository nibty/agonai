import { ELO_CONFIG, type EloChange } from "@/types";

/**
 * ELO Rating System
 * Standard implementation with K-factor of 32
 */

/**
 * Calculate expected score for a player against an opponent
 * @param playerElo Player's current ELO rating
 * @param opponentElo Opponent's current ELO rating
 * @returns Expected score between 0 and 1
 */
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  const exponent = (opponentElo - playerElo) / 400;
  return 1 / (1 + Math.pow(10, exponent));
}

/**
 * Calculate new ELO rating after a match
 * @param playerElo Player's current ELO rating
 * @param opponentElo Opponent's current ELO rating
 * @param actualScore 1 for win, 0.5 for draw, 0 for loss
 * @param kFactor K-factor for rating adjustment (default: 32)
 * @returns Object containing old ELO, new ELO, and change
 */
export function calculateNewElo(
  playerElo: number,
  opponentElo: number,
  actualScore: number,
  kFactor: number = ELO_CONFIG.K_FACTOR
): EloChange {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const change = Math.round(kFactor * (actualScore - expectedScore));
  const newElo = Math.max(0, playerElo + change); // ELO can't go below 0

  return {
    oldElo: playerElo,
    newElo,
    change,
  };
}

/**
 * Calculate ELO changes for both players after a match
 * @param winnerElo Winner's current ELO rating
 * @param loserElo Loser's current ELO rating
 * @returns Object containing ELO changes for both winner and loser
 */
export function calculateMatchEloChanges(
  winnerElo: number,
  loserElo: number
): {
  winner: EloChange;
  loser: EloChange;
} {
  return {
    winner: calculateNewElo(winnerElo, loserElo, 1),
    loser: calculateNewElo(loserElo, winnerElo, 0),
  };
}

/**
 * Calculate the ELO difference needed for a given win probability
 * @param probability Win probability (0-1)
 * @returns ELO difference needed
 */
export function eloDifferenceForProbability(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1 (exclusive)");
  }
  return Math.round(400 * Math.log10(probability / (1 - probability)));
}

/**
 * Determine if matchmaking between two players is balanced
 * @param elo1 First player's ELO
 * @param elo2 Second player's ELO
 * @param maxDifference Maximum acceptable ELO difference (default: 200)
 * @returns Whether the match is considered balanced
 */
export function isBalancedMatch(elo1: number, elo2: number, maxDifference: number = 200): boolean {
  return Math.abs(elo1 - elo2) <= maxDifference;
}

/**
 * Get matchmaking priority based on wait time
 * As players wait longer, their acceptable ELO range expands
 * @param waitTimeSeconds How long the player has been waiting
 * @param baseRange Base ELO range for matching
 * @returns Expanded ELO range
 */
export function getExpandedMatchRange(waitTimeSeconds: number, baseRange: number = 100): number {
  // Expand range by 50 ELO every 30 seconds, up to 500 max
  const expansion = Math.floor(waitTimeSeconds / 30) * 50;
  return Math.min(baseRange + expansion, 500);
}
