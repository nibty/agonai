import { describe, it, expect } from "vitest";
import {
  calculateExpectedScore,
  calculateNewElo,
  calculateMatchEloChanges,
  isBalancedMatch,
  getExpandedMatchRange,
  eloDifferenceForProbability,
} from "./elo";

describe("ELO System", () => {
  describe("calculateExpectedScore", () => {
    it("returns 0.5 for equal ratings", () => {
      const expected = calculateExpectedScore(1500, 1500);
      expect(expected).toBeCloseTo(0.5);
    });

    it("returns higher expected score for higher rated player", () => {
      const expected = calculateExpectedScore(1600, 1400);
      expect(expected).toBeGreaterThan(0.5);
      expect(expected).toBeCloseTo(0.76, 1);
    });

    it("returns lower expected score for lower rated player", () => {
      const expected = calculateExpectedScore(1400, 1600);
      expect(expected).toBeLessThan(0.5);
      expect(expected).toBeCloseTo(0.24, 1);
    });

    it("expected scores of opponents sum to 1", () => {
      const player1 = calculateExpectedScore(1500, 1700);
      const player2 = calculateExpectedScore(1700, 1500);
      expect(player1 + player2).toBeCloseTo(1);
    });
  });

  describe("calculateNewElo", () => {
    it("increases ELO for a win against equal opponent", () => {
      const result = calculateNewElo(1500, 1500, 1);
      expect(result.newElo).toBeGreaterThan(result.oldElo);
      expect(result.change).toBe(16); // K * (1 - 0.5) = 32 * 0.5
    });

    it("decreases ELO for a loss against equal opponent", () => {
      const result = calculateNewElo(1500, 1500, 0);
      expect(result.newElo).toBeLessThan(result.oldElo);
      expect(result.change).toBe(-16);
    });

    it("gains less ELO for beating lower rated opponent", () => {
      const beatWeaker = calculateNewElo(1600, 1400, 1);
      const beatEqual = calculateNewElo(1500, 1500, 1);
      expect(beatWeaker.change).toBeLessThan(beatEqual.change);
    });

    it("gains more ELO for beating higher rated opponent", () => {
      const beatStronger = calculateNewElo(1400, 1600, 1);
      const beatEqual = calculateNewElo(1500, 1500, 1);
      expect(beatStronger.change).toBeGreaterThan(beatEqual.change);
    });

    it("ELO cannot go below 0", () => {
      const result = calculateNewElo(10, 1500, 0);
      expect(result.newElo).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateMatchEloChanges", () => {
    it("changes are symmetric for equal ratings", () => {
      const changes = calculateMatchEloChanges(1500, 1500);
      expect(changes.winner.change).toBe(-changes.loser.change);
    });

    it("winner gains ELO, loser loses ELO", () => {
      const changes = calculateMatchEloChanges(1500, 1500);
      expect(changes.winner.change).toBeGreaterThan(0);
      expect(changes.loser.change).toBeLessThan(0);
    });

    it("underdog win results in larger ELO swing", () => {
      const underdogWins = calculateMatchEloChanges(1400, 1600);
      const favoriteWins = calculateMatchEloChanges(1600, 1400);
      expect(Math.abs(underdogWins.winner.change)).toBeGreaterThan(
        Math.abs(favoriteWins.winner.change)
      );
    });
  });

  describe("isBalancedMatch", () => {
    it("returns true for equal ratings", () => {
      expect(isBalancedMatch(1500, 1500)).toBe(true);
    });

    it("returns true within default range", () => {
      expect(isBalancedMatch(1500, 1600)).toBe(true);
      expect(isBalancedMatch(1500, 1700)).toBe(true);
    });

    it("returns false outside default range", () => {
      expect(isBalancedMatch(1500, 1800)).toBe(false);
    });

    it("respects custom range parameter", () => {
      expect(isBalancedMatch(1500, 1600, 50)).toBe(false);
      expect(isBalancedMatch(1500, 1550, 50)).toBe(true);
    });
  });

  describe("getExpandedMatchRange", () => {
    it("returns base range at 0 wait time", () => {
      expect(getExpandedMatchRange(0)).toBe(100);
    });

    it("expands range over time", () => {
      expect(getExpandedMatchRange(30)).toBe(150);
      expect(getExpandedMatchRange(60)).toBe(200);
      expect(getExpandedMatchRange(120)).toBe(300);
    });

    it("caps at maximum range", () => {
      expect(getExpandedMatchRange(600)).toBe(500);
      expect(getExpandedMatchRange(1000)).toBe(500);
    });
  });

  describe("eloDifferenceForProbability", () => {
    it("returns 0 for 50% probability", () => {
      expect(eloDifferenceForProbability(0.5)).toBe(0);
    });

    it("returns positive for >50% probability", () => {
      expect(eloDifferenceForProbability(0.75)).toBeGreaterThan(0);
    });

    it("returns negative for <50% probability", () => {
      expect(eloDifferenceForProbability(0.25)).toBeLessThan(0);
    });

    it("throws for invalid probabilities", () => {
      expect(() => eloDifferenceForProbability(0)).toThrow();
      expect(() => eloDifferenceForProbability(1)).toThrow();
    });
  });
});
