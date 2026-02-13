import { Request, Response, NextFunction } from "express";
import Hashids from "hashids";

// Use environment variable for salt, with a fallback for development
const SALT = process.env.HASHIDS_SALT || "agonai-dev-salt-change-in-prod";
const MIN_LENGTH = 12;

// Separate hashids instances for each resource type
const hashids = {
  debate: new Hashids(`${SALT}-debate`, MIN_LENGTH),
  bot: new Hashids(`${SALT}-bot`, MIN_LENGTH),
  user: new Hashids(`${SALT}-user`, MIN_LENGTH),
  topic: new Hashids(`${SALT}-topic`, MIN_LENGTH),
};

type ResourceType = keyof typeof hashids;

// Map field names to their resource types
const FIELD_TYPE_MAP: Record<string, ResourceType> = {
  id: "debate", // Default, but context-dependent
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

// Route param patterns to resource types
const PARAM_TYPE_MAP: Record<string, ResourceType> = {
  debateId: "debate",
  botId: "bot",
  topicId: "topic",
};

/**
 * Encode a numeric ID to a public alphanumeric string
 */
export function encodeId(type: ResourceType, id: number): string {
  return hashids[type].encode(id);
}

/**
 * Decode a public alphanumeric string back to numeric ID
 * Returns null if invalid
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
  // Direct mapping
  if (FIELD_TYPE_MAP[fieldName]) {
    return FIELD_TYPE_MAP[fieldName];
  }

  // "id" field - infer from parent object name
  if (fieldName === "id" && parentKey) {
    const singular = parentKey.replace(/s$/, ""); // debates -> debate
    if (singular in hashids) {
      return singular as ResourceType;
    }
    // Handle camelCase like proBot -> bot
    if (parentKey.toLowerCase().includes("bot")) return "bot";
    if (parentKey.toLowerCase().includes("debate")) return "debate";
    if (parentKey.toLowerCase().includes("topic")) return "topic";
    if (parentKey.toLowerCase().includes("user")) return "user";
  }

  return null;
}

/**
 * Recursively encode IDs in an object
 */
function encodeIds(obj: unknown, parentKey?: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

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
      // Recurse with current key as parent context
      result[key] = encodeIds(value, key);
    }
    return result;
  }

  return obj;
}

/**
 * Recursively decode IDs in an object
 */
function decodeIds(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => decodeIds(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === "string" && FIELD_TYPE_MAP[key]) {
        const type = FIELD_TYPE_MAP[key];
        const decoded = decodeId(type, value);
        if (decoded !== null) {
          result[key] = decoded;
          continue;
        }
      }
      result[key] = decodeIds(value);
    }
    return result;
  }

  return obj;
}

/**
 * Middleware to decode hashids in request params and body
 */
export function decodeRequestIds(req: Request, _res: Response, next: NextFunction): void {
  // Decode route params
  for (const [param, type] of Object.entries(PARAM_TYPE_MAP)) {
    const paramValue = req.params[param];
    if (typeof paramValue === "string") {
      const decoded = decodeId(type, paramValue);
      if (decoded !== null) {
        (req.params as Record<string, string>)[param] = String(decoded);
      }
      // If decode fails, leave as-is (will fail validation later)
    }
  }

  // Decode body fields
  if (req.body && typeof req.body === "object") {
    req.body = decodeIds(req.body);
  }

  next();
}

/**
 * Middleware to encode hashids in response JSON
 */
export function encodeResponseIds(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    const encoded = encodeIds(body);
    return originalJson(encoded);
  };

  next();
}

/**
 * Combined middleware - apply both decode (request) and encode (response)
 */
export function hashidsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Set up response encoding
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const encoded = encodeIds(body);
    return originalJson(encoded);
  };

  // Decode request params
  for (const [param, type] of Object.entries(PARAM_TYPE_MAP)) {
    const paramValue = req.params[param];
    if (typeof paramValue === "string") {
      const decoded = decodeId(type, paramValue);
      if (decoded !== null) {
        (req.params as Record<string, string>)[param] = String(decoded);
      }
    }
  }

  // Decode body fields
  if (req.body && typeof req.body === "object") {
    req.body = decodeIds(req.body);
  }

  next();
}
