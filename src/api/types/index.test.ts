import { describe, it, expect } from "vitest";
import { JoinQueueSchema, countWords, validateBotResponse } from "./index.js";

describe("JoinQueueSchema", () => {
  it("defaults allowSameOwnerMatch to false", () => {
    const parsed = JoinQueueSchema.parse({ botId: 123, stake: 0, presetId: "classic" });
    expect(parsed.allowSameOwnerMatch).toBe(false);
  });

  it("accepts allowSameOwnerMatch=true when explicitly provided", () => {
    const parsed = JoinQueueSchema.parse({
      botId: 123,
      stake: 0,
      presetId: "classic",
      allowSameOwnerMatch: true,
    });
    expect(parsed.allowSameOwnerMatch).toBe(true);
  });
});

describe("Bot Response Validation", () => {
  describe("countWords", () => {
    it("counts words in a simple sentence", () => {
      expect(countWords("Hello world")).toBe(2);
    });

    it("handles multiple spaces between words", () => {
      expect(countWords("Hello    world")).toBe(2);
    });

    it("handles leading and trailing whitespace", () => {
      expect(countWords("  Hello world  ")).toBe(2);
    });

    it("returns 0 for empty string", () => {
      expect(countWords("")).toBe(0);
    });

    it("returns 0 for whitespace-only string", () => {
      expect(countWords("   ")).toBe(0);
      expect(countWords("\t\n")).toBe(0);
    });

    it("handles newlines and tabs as word separators", () => {
      expect(countWords("Hello\nworld\tthere")).toBe(3);
    });

    it("counts single word correctly", () => {
      expect(countWords("Hello")).toBe(1);
    });

    it("handles punctuation attached to words", () => {
      expect(countWords("Hello, world!")).toBe(2);
    });

    it("handles longer text", () => {
      const text =
        "The quick brown fox jumps over the lazy dog. This is a classic pangram used for testing.";
      expect(countWords(text)).toBe(17);
    });
  });

  describe("validateBotResponse", () => {
    const defaultWordLimit = { min: 50, max: 100 };
    const defaultCharLimit = { min: 200, max: 500 };

    it("validates a response within all limits", () => {
      // 60 words, ~360 characters
      const message = Array(60).fill("word").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects response with too few words", () => {
      const message = Array(30).fill("word").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Response too short: 30 words (minimum 50)");
    });

    it("rejects response with too many words", () => {
      const message = Array(150).fill("word").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too long") && e.includes("words"))).toBe(true);
    });

    it("rejects response with too few characters", () => {
      // 60 short words but under 200 chars
      const message = Array(60).fill("a").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too short") && e.includes("characters"))).toBe(
        true
      );
    });

    it("rejects response with too many characters", () => {
      // 60 long words, over 500 chars
      const message = Array(60).fill("supercalifragilistic").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too long") && e.includes("characters"))).toBe(
        true
      );
    });

    it("returns multiple errors when multiple limits exceeded", () => {
      const message = "Hi"; // too few words and too few characters
      const result = validateBotResponse(message, defaultWordLimit, defaultCharLimit);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it("validates at exact word minimum boundary", () => {
      const message = Array(50).fill("testing").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, { min: 0, max: 10000 });
      expect(result.valid).toBe(true);
    });

    it("validates at exact word maximum boundary", () => {
      const message = Array(100).fill("test").join(" ");
      const result = validateBotResponse(message, defaultWordLimit, { min: 0, max: 10000 });
      expect(result.valid).toBe(true);
    });

    it("validates at exact character minimum boundary", () => {
      const message = "a".repeat(200);
      const result = validateBotResponse(message, { min: 0, max: 10000 }, defaultCharLimit);
      expect(result.valid).toBe(true);
    });

    it("validates at exact character maximum boundary", () => {
      const message = "a".repeat(500);
      const result = validateBotResponse(message, { min: 0, max: 10000 }, defaultCharLimit);
      expect(result.valid).toBe(true);
    });
  });
});
