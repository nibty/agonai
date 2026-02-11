import { describe, it, expect } from "vitest";
import {
  getPreset,
  getAllPresets,
  getPresetIds,
  getDefaultPreset,
  estimateDuration,
  formatDuration,
  PRESETS,
  DEFAULT_PRESET_ID,
} from "./presets.js";

describe("Presets", () => {
  describe("getPreset", () => {
    it("returns preset for valid ID", () => {
      const preset = getPreset("classic");
      expect(preset).toBeDefined();
      expect(preset?.id).toBe("classic");
      expect(preset?.name).toBe("Classic Duel");
    });

    it("returns undefined for invalid ID", () => {
      expect(getPreset("nonexistent")).toBeUndefined();
    });

    it("returns all known presets", () => {
      expect(getPreset("lightning")).toBeDefined();
      expect(getPreset("classic")).toBeDefined();
      expect(getPreset("crossex")).toBeDefined();
      expect(getPreset("escalation")).toBeDefined();
    });
  });

  describe("getAllPresets", () => {
    it("returns an array of presets", () => {
      const presets = getAllPresets();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
    });

    it("returns all presets from PRESETS object", () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(Object.keys(PRESETS).length);
    });

    it("each preset has required fields", () => {
      const presets = getAllPresets();
      for (const preset of presets) {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.rounds).toBeDefined();
        expect(Array.isArray(preset.rounds)).toBe(true);
        expect(preset.rounds.length).toBeGreaterThan(0);
        expect(preset.prepTime).toBeGreaterThanOrEqual(0);
        expect(preset.voteWindow).toBeGreaterThan(0);
        expect(preset.winCondition).toBeDefined();
      }
    });
  });

  describe("getPresetIds", () => {
    it("returns an array of strings", () => {
      const ids = getPresetIds();
      expect(Array.isArray(ids)).toBe(true);
      ids.forEach((id) => expect(typeof id).toBe("string"));
    });

    it("contains all preset IDs", () => {
      const ids = getPresetIds();
      expect(ids).toContain("lightning");
      expect(ids).toContain("classic");
      expect(ids).toContain("crossex");
      expect(ids).toContain("escalation");
    });

    it("matches keys of PRESETS object", () => {
      const ids = getPresetIds();
      expect(ids.sort()).toEqual(Object.keys(PRESETS).sort());
    });
  });

  describe("getDefaultPreset", () => {
    it("returns a valid preset", () => {
      const preset = getDefaultPreset();
      expect(preset).toBeDefined();
      expect(preset.id).toBe(DEFAULT_PRESET_ID);
    });

    it("returns the classic preset by default", () => {
      const preset = getDefaultPreset();
      expect(preset.id).toBe("classic");
      expect(preset.name).toBe("Classic Duel");
    });
  });

  describe("estimateDuration", () => {
    it("calculates duration for lightning preset", () => {
      const preset = getPreset("lightning");
      expect(preset).toBeDefined();
      if (!preset) return;
      const duration = estimateDuration(preset);
      // 5 rounds * (30s * 2 speakers + 45s vote) = 5 * 105 = 525 + 3 prep = 528
      expect(duration).toBe(528);
    });

    it("calculates duration for classic preset", () => {
      const preset = getPreset("classic");
      expect(preset).toBeDefined();
      if (!preset) return;
      const duration = estimateDuration(preset);
      // Should include prep time + all rounds + voting
      expect(duration).toBeGreaterThan(preset.prepTime);
    });

    it("accounts for 'both' speaker multiplier", () => {
      const preset = getPreset("classic");
      expect(preset).toBeDefined();
      if (!preset) return;
      const duration = estimateDuration(preset);
      // All classic rounds have "both" speakers, so times should be doubled
      const singleRoundTime =
        preset.rounds.reduce((sum, r) => sum + r.timeLimit * 2 + preset.voteWindow, 0) +
        preset.prepTime;
      expect(duration).toBe(singleRoundTime);
    });

    it("accounts for exchanges in Q&A rounds", () => {
      const preset = getPreset("crossex");
      expect(preset).toBeDefined();
      if (!preset) return;
      const duration = estimateDuration(preset);
      // crossex has question rounds with exchanges: 3
      expect(duration).toBeGreaterThan(preset.prepTime);
    });

    it("returns positive duration for all presets", () => {
      const presets = getAllPresets();
      for (const preset of presets) {
        const duration = estimateDuration(preset);
        expect(duration).toBeGreaterThan(0);
      }
    });
  });

  describe("formatDuration", () => {
    it("formats minutes only when seconds is 0", () => {
      expect(formatDuration(60)).toBe("1m");
      expect(formatDuration(120)).toBe("2m");
      expect(formatDuration(300)).toBe("5m");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(65)).toBe("1m 5s");
      expect(formatDuration(90)).toBe("1m 30s");
      expect(formatDuration(125)).toBe("2m 5s");
    });

    it("handles zero duration", () => {
      expect(formatDuration(0)).toBe("0m");
    });

    it("handles less than a minute", () => {
      expect(formatDuration(30)).toBe("0m 30s");
      expect(formatDuration(59)).toBe("0m 59s");
    });

    it("handles large durations", () => {
      expect(formatDuration(3600)).toBe("60m");
      expect(formatDuration(3661)).toBe("61m 1s");
    });
  });

  describe("Preset Integrity", () => {
    it("all presets have unique IDs", () => {
      const presets = getAllPresets();
      const ids = presets.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all rounds have valid types", () => {
      const validTypes = [
        "opening",
        "argument",
        "rebuttal",
        "counter",
        "closing",
        "question",
        "answer",
      ];
      const presets = getAllPresets();
      for (const preset of presets) {
        for (const round of preset.rounds) {
          expect(validTypes).toContain(round.type);
        }
      }
    });

    it("all rounds have valid speaker values", () => {
      const validSpeakers = ["pro", "con", "both"];
      const presets = getAllPresets();
      for (const preset of presets) {
        for (const round of preset.rounds) {
          expect(validSpeakers).toContain(round.speaker);
        }
      }
    });

    it("all word limits have min <= max", () => {
      const presets = getAllPresets();
      for (const preset of presets) {
        for (const round of preset.rounds) {
          expect(round.wordLimit.min).toBeLessThanOrEqual(round.wordLimit.max);
        }
      }
    });

    it("all time limits are positive", () => {
      const presets = getAllPresets();
      for (const preset of presets) {
        for (const round of preset.rounds) {
          expect(round.timeLimit).toBeGreaterThan(0);
        }
      }
    });
  });
});
