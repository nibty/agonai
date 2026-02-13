import { Request, Response, NextFunction } from "express";
import Hashids from "hashids";

const SALT = process.env.HASHIDS_SALT || "agonai-dev-salt-change-in-prod";
const MIN_LENGTH = 12;

const hashids = {
  debate: new Hashids(`${SALT}-debate`, MIN_LENGTH),
  bot: new Hashids(`${SALT}-bot`, MIN_LENGTH),
  user: new Hashids(`${SALT}-user`, MIN_LENGTH),
  topic: new Hashids(`${SALT}-topic`, MIN_LENGTH),
};

type ResourceType = keyof typeof hashids;

// Map field names to their resource types for response encoding
const FIELD_TYPE_MAP: Record<string, ResourceType> = {
  debateId: "debate",
  botId: "bot",
  proBotId: "bot",
  conBotId: "bot",
  userId: "user",
  ownerId: "user",
  bettorId: "user",
  proposerId: "user",
  topicId: "topic",
};

/**
 * Encode a numeric ID to a public alphanumeric string
 */
export function encodeId(type: ResourceType, id: number): string {
  return hashids[type].encode(id);
}

/**
 * Decode a public alphanumeric string back to numeric ID.
 * Returns null if invalid.
 */
export function decodeId(type: ResourceType, publicId: string): number | null {
  const decoded = hashids[type].decode(publicId);
  if (decoded.length !== 1) return null;
  return decoded[0] as number;
}

/**
 * Infer resource type from field name
 */
function inferType(fieldName: string, parentKey?: string): ResourceType | null {
  if (FIELD_TYPE_MAP[fieldName]) {
    return FIELD_TYPE_MAP[fieldName];
  }

  if (fieldName === "id" && parentKey) {
    const singular = parentKey.replace(/s$/, "");
    if (singular in hashids) return singular as ResourceType;
    if (parentKey.toLowerCase().includes("bot")) return "bot";
    if (parentKey.toLowerCase().includes("debate")) return "debate";
    if (parentKey.toLowerCase().includes("topic")) return "topic";
    if (parentKey.toLowerCase().includes("user")) return "user";
  }

  return null;
}

/**
 * Recursively encode numeric IDs in an object for API responses
 */
function encodeIds(obj: unknown, parentKey?: string): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => encodeIds(item, parentKey));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === "number") {
        const type = inferType(key, parentKey);
        if (type) {
          result[key] = encodeId(type, value);
          continue;
        }
      }
      result[key] = encodeIds(value, key);
    }
    return result;
  }

  return obj;
}

/**
 * Middleware to encode IDs in response JSON.
 * Apply at app level — no route params needed.
 */
export function encodeResponseIds(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    return originalJson(encodeIds(body));
  };
  next();
}
