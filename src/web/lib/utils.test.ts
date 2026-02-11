import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatNumber, truncateAddress, clamp, generateId, cn } from "./utils";

describe("Utils", () => {
  describe("cn", () => {
    it("merges class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes", () => {
      const shouldInclude = false;
      expect(cn("foo", shouldInclude && "bar", "baz")).toBe("foo baz");
    });

    it("merges tailwind classes correctly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("handles arrays", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("handles objects", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });
  });

  describe("formatRelativeTime", () => {
    // Helper to create a date relative to a fixed "now"
    const createRelativeTest = (nowStr: string, dateStr: string, expected: string | RegExp) => {
      // Temporarily override Date to test relative times
      const originalDate = globalThis.Date;
      const mockNow = new originalDate(nowStr).getTime();

      // Create a mock Date class
      class MockDate extends originalDate {
        constructor(...args: Parameters<typeof originalDate>) {
          if (args.length === 0) {
            super(mockNow);
          } else {
            super(...args);
          }
        }
      }

      globalThis.Date = MockDate as typeof Date;

      try {
        const date = new originalDate(dateStr);
        const result = formatRelativeTime(date);
        if (typeof expected === "string") {
          expect(result).toBe(expected);
        } else {
          expect(result).toMatch(expected);
        }
      } finally {
        globalThis.Date = originalDate;
      }
    };

    it("returns 'just now' for very recent times", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-15T11:59:30Z", "just now");
    });

    it("returns minutes ago for times within an hour", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-15T11:55:00Z", "5m ago");
    });

    it("returns hours ago for times within a day", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-15T09:00:00Z", "3h ago");
    });

    it("returns days ago for times within a week", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-13T12:00:00Z", "2d ago");
    });

    it("returns formatted date for times older than a week", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-01T12:00:00Z", /\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("handles edge case at exactly 60 seconds", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-15T11:59:00Z", "1m ago");
    });

    it("handles edge case at exactly 60 minutes", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-15T11:00:00Z", "1h ago");
    });

    it("handles edge case at exactly 24 hours", () => {
      createRelativeTest("2025-01-15T12:00:00Z", "2025-01-14T12:00:00Z", "1d ago");
    });
  });

  describe("formatNumber", () => {
    it("formats small numbers without commas", () => {
      expect(formatNumber(123)).toBe("123");
    });

    it("formats thousands with commas", () => {
      expect(formatNumber(1234)).toBe("1,234");
    });

    it("formats millions with commas", () => {
      expect(formatNumber(1234567)).toBe("1,234,567");
    });

    it("handles zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("handles negative numbers", () => {
      expect(formatNumber(-1234)).toBe("-1,234");
    });

    it("handles decimals", () => {
      expect(formatNumber(1234.56)).toBe("1,234.56");
    });
  });

  describe("truncateAddress", () => {
    it("truncates long addresses", () => {
      const address = "DRpbCBMxVnDK7maPgSjnaG6VnVuLaKZ7p3iaNmhG7yfP";
      expect(truncateAddress(address)).toBe("DRpb...7yfP");
    });

    it("uses custom character count", () => {
      const address = "DRpbCBMxVnDK7maPgSjnaG6VnVuLaKZ7p3iaNmhG7yfP";
      expect(truncateAddress(address, 6)).toBe("DRpbCB...hG7yfP");
    });

    it("returns short addresses unchanged", () => {
      expect(truncateAddress("short")).toBe("short");
      expect(truncateAddress("12345678901")).toBe("12345678901");
    });

    it("handles empty string", () => {
      expect(truncateAddress("")).toBe("");
    });

    it("handles edge case where length equals 2*chars+3", () => {
      // 4 + 4 + 3 = 11 chars boundary
      expect(truncateAddress("12345678901", 4)).toBe("12345678901");
      expect(truncateAddress("123456789012", 4)).toBe("1234...9012");
    });
  });

  describe("clamp", () => {
    it("returns value when within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("returns min when value is below range", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("returns max when value is above range", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("handles value equal to min", () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    it("handles value equal to max", () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it("handles negative ranges", () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });

    it("handles floating point numbers", () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(1.5, 0, 1)).toBe(1);
    });
  });

  describe("generateId", () => {
    it("returns a string", () => {
      expect(typeof generateId()).toBe("string");
    });

    it("returns non-empty string", () => {
      expect(generateId().length).toBeGreaterThan(0);
    });

    it("returns different IDs on multiple calls", () => {
      const ids = new Set([generateId(), generateId(), generateId(), generateId(), generateId()]);
      expect(ids.size).toBe(5);
    });

    it("returns alphanumeric characters only", () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });
});
