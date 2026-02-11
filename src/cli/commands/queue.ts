import { createLogger } from "@x1-labs/logging";
import { isLoggedIn } from "../lib/config.js";
import {
  post,
  get,
  type JoinQueueResponse,
  type LeaveQueueResponse,
  type QueueStats,
} from "../lib/api.js";

const logger = createLogger({ name: "cli-queue" });

interface PresetsResponse {
  presets: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

/**
 * Join the matchmaking queue
 */
export async function join(
  botId: string,
  options: { stake?: string; preset?: string }
): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  const stake = options.stake ? parseFloat(options.stake) : 0;
  const presetId = options.preset || "classic";

  if (isNaN(stake) || stake < 0) {
    logger.error({}, "Invalid stake amount");
    process.exit(1);
  }

  logger.info({ botId, stake, presetId }, "Joining queue");

  const result = await post<JoinQueueResponse>("/queue/join", {
    botId: parseInt(botId, 10),
    stake,
    presetId,
  });

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to join queue");
    process.exit(1);
  }

  const { entry } = result.data;

  console.log(`\nJoined matchmaking queue!`);
  console.log(`Bot: ${entry.botName} (ID: ${entry.botId})`);
  console.log(`ELO: ${entry.elo}`);
  console.log(`Stake: ${entry.stake} XNT`);
  console.log(`Preset: ${entry.presetId}`);
  console.log(`\nWaiting for a match... Use 'cli queue leave ${botId}' to cancel.`);
}

/**
 * Leave the matchmaking queue
 */
export async function leave(botId: string): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  logger.info({ botId }, "Leaving queue");

  const result = await post<LeaveQueueResponse>("/queue/leave", {
    botId: parseInt(botId, 10),
  });

  if (result.error) {
    logger.error({ error: result.error }, "Failed to leave queue");
    process.exit(1);
  }

  console.log(`\nLeft matchmaking queue.`);
}

/**
 * Show queue status
 */
export async function status(): Promise<void> {
  const result = await get<QueueStats>("/queue/stats");

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to get queue status");
    process.exit(1);
  }

  const stats = result.data;

  console.log(`\nMatchmaking Queue Status`);
  console.log("─".repeat(40));
  console.log(`Bots in queue: ${stats.queueSize}`);

  if (stats.waitTimes && stats.queueSize > 0) {
    console.log(`\nWait times:`);
    console.log(`  Average: ${Math.round(stats.waitTimes.avg / 1000)}s`);
    console.log(`  Min: ${Math.round(stats.waitTimes.min / 1000)}s`);
    console.log(`  Max: ${Math.round(stats.waitTimes.max / 1000)}s`);
  }

  if (stats.byPreset && Object.keys(stats.byPreset).length > 0) {
    console.log(`\nBy preset:`);
    for (const [preset, count] of Object.entries(stats.byPreset)) {
      console.log(`  ${preset}: ${count}`);
    }
  }

  if (stats.byLeague && Object.keys(stats.byLeague).length > 0) {
    console.log(`\nBy league:`);
    for (const [league, count] of Object.entries(stats.byLeague)) {
      console.log(`  ${league}: ${count}`);
    }
  }
}

/**
 * List available presets
 */
export async function presets(): Promise<void> {
  const result = await get<PresetsResponse>("/presets");

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to get presets");
    process.exit(1);
  }

  console.log(`\nAvailable Debate Presets`);
  console.log("─".repeat(50));

  for (const preset of result.data.presets) {
    console.log(`  ${preset.id.padEnd(15)} - ${preset.name}`);
    if (preset.description) {
      console.log(`${"".padEnd(18)}${preset.description}`);
    }
  }
}
