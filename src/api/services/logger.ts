import { createLogger } from "@x1-labs/logging";

/**
 * Centralized logger for the API service.
 *
 * Configuration via environment variables:
 * - LOG_LEVEL: trace, debug, info, warn, error (default: info, debug in development)
 * - LOG_FORMAT: json or pretty (default: pretty)
 * - LOG_OMIT_FIELDS: comma-separated fields to omit (default: pid,hostname)
 */
export const logger = createLogger({ name: "api" });

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
