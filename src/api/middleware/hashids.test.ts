import { describe, it, expect } from "vitest";
import { encodeId, decodeId, encodeIds } from "./hashids.js";

describe("hashids", () => {
  describe("encodeId / decodeId round-trip", () => {
    it.each(["bot", "debate", "user", "topic"] as const)("round-trips %s IDs", (type) => {
      const encoded = encodeId(type, 42);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThanOrEqual(12);
      expect(decodeId(type, encoded)).toBe(42);
    });

    it("returns null for invalid hashid", () => {
      expect(decodeId("bot", "invalid-garbage")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(decodeId("bot", "")).toBeNull();
    });

    it("does not decode across types", () => {
      const botHash = encodeId("bot", 1);
      expect(decodeId("debate", botHash)).toBeNull();
    });
  });

  describe("encodeIds", () => {
    it("encodes id field using parent key context", () => {
      const result = encodeIds({ bot: { id: 1, name: "test" } }) as {
        bot: { id: string; name: string };
      };

      expect(typeof result.bot.id).toBe("string");
      expect(result.bot.id).toBe(encodeId("bot", 1));
      expect(result.bot.name).toBe("test");
    });

    it("encodes id correctly for each resource type", () => {
      const bot = encodeIds({ bot: { id: 1 } }) as { bot: { id: string } };
      const debate = encodeIds({ debate: { id: 1 } }) as { debate: { id: string } };
      const user = encodeIds({ user: { id: 1 } }) as { user: { id: string } };
      const topic = encodeIds({ topic: { id: 1 } }) as { topic: { id: string } };

      // Each type should produce a different hashid for the same numeric ID
      const ids = [bot.bot.id, debate.debate.id, user.user.id, topic.topic.id];
      expect(new Set(ids).size).toBe(4);

      // Each should decode back correctly with its own type
      expect(decodeId("bot", bot.bot.id)).toBe(1);
      expect(decodeId("debate", debate.debate.id)).toBe(1);
      expect(decodeId("user", user.user.id)).toBe(1);
      expect(decodeId("topic", topic.topic.id)).toBe(1);
    });

    it("encodes id in plural parent keys (bots -> bot)", () => {
      const result = encodeIds({ bots: [{ id: 1 }, { id: 2 }] }) as {
        bots: [{ id: string }, { id: string }];
      };

      expect(result.bots).toHaveLength(2);
      expect(decodeId("bot", result.bots[0].id)).toBe(1);
      expect(decodeId("bot", result.bots[1].id)).toBe(2);
    });

    it("encodes named ID fields via FIELD_TYPE_MAP", () => {
      const result = encodeIds({
        debateId: 1,
        botId: 2,
        proBotId: 3,
        conBotId: 4,
        ownerId: 5,
        topicId: 6,
      }) as {
        debateId: string;
        botId: string;
        proBotId: string;
        conBotId: string;
        ownerId: string;
        topicId: string;
      };

      expect(decodeId("debate", result.debateId)).toBe(1);
      expect(decodeId("bot", result.botId)).toBe(2);
      expect(decodeId("bot", result.proBotId)).toBe(3);
      expect(decodeId("bot", result.conBotId)).toBe(4);
      expect(decodeId("user", result.ownerId)).toBe(5);
      expect(decodeId("topic", result.topicId)).toBe(6);
    });

    it("preserves Date objects", () => {
      const now = new Date();
      const result = encodeIds({
        bot: { id: 1, createdAt: now, updatedAt: now },
      }) as { bot: { id: string; createdAt: Date; updatedAt: Date } };

      expect(result.bot.createdAt).toBe(now);
      expect(result.bot.updatedAt).toBe(now);
      expect(result.bot.createdAt instanceof Date).toBe(true);
    });

    it("preserves non-plain objects (Buffer, RegExp, etc)", () => {
      const buf = Buffer.from("hello");
      const re = /test/;
      const result = encodeIds({ data: buf, pattern: re }) as {
        data: Buffer;
        pattern: RegExp;
      };

      expect(result.data).toBe(buf);
      expect(result.pattern).toBe(re);
    });

    it("does not encode non-ID numeric fields", () => {
      const result = encodeIds({
        bot: { id: 1, elo: 1200, wins: 5, losses: 3 },
      }) as { bot: { id: string; elo: number; wins: number; losses: number } };

      expect(typeof result.bot.id).toBe("string");
      expect(result.bot.elo).toBe(1200);
      expect(result.bot.wins).toBe(5);
      expect(result.bot.losses).toBe(3);
    });

    it("handles null and undefined", () => {
      expect(encodeIds(null)).toBeNull();
      expect(encodeIds(undefined)).toBeUndefined();
    });

    it("passes through primitives", () => {
      expect(encodeIds("hello")).toBe("hello");
      expect(encodeIds(42)).toBe(42);
      expect(encodeIds(true)).toBe(true);
    });
  });
});
