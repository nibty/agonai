/**
 * OpenClaw Integration Service
 *
 * Uses OpenClaw's OpenAI-compatible /v1/chat/completions endpoint
 * for synchronous communication with the AI gateway.
 */

import type { BotRequest, BotResponse } from "../types/index.js";
import type { Bot } from "../db/types.js";
import { decryptToken } from "../repositories/botRepository.js";

// OpenAI-compatible response format
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenClaw using the OpenAI-compatible chat completions API
 */
export async function callOpenClawBot(
  bot: Bot,
  request: BotRequest,
  timeoutMs: number
): Promise<{ success: boolean; response?: BotResponse; error?: string; latencyMs: number }> {
  const startTime = Date.now();

  // Build the prompt for OpenClaw
  const prompt = buildOpenClawPrompt(request);

  try {
    // Decrypt auth token for OpenClaw gateway authentication
    const authToken = bot.authTokenEncrypted ? decryptToken(bot.authTokenEncrypted) : null;

    // Use session key for multi-turn context within the same debate
    const sessionKey = `debate-${request.debate_id}-${request.position}`;

    // Call the OpenAI-compatible chat completions endpoint
    const response = await fetch(`${bot.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && {
          Authorization: `Bearer ${authToken}`,
        }),
        // Use session key for persistent context
        "x-openclaw-session-key": sessionKey,
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `OpenClaw returned ${response.status}: ${errorText}`,
        latencyMs,
      };
    }

    const data = (await response.json()) as OpenAIChatResponse;

    // Extract the message from OpenAI format
    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) {
      return {
        success: false,
        error: "No message content in OpenClaw response",
        latencyMs,
      };
    }

    return {
      success: true,
      response: {
        message: messageContent,
        confidence: 0.85,
      },
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: `OpenClaw request timed out after ${timeoutMs}ms`,
        latencyMs,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
    };
  }
}

/**
 * Build the prompt message for OpenClaw
 */
function buildOpenClawPrompt(req: BotRequest): string {
  const wordLimit = req.word_limit ?? { min: 100, max: 300 };
  const positionName = req.position === "pro" ? "PRO (support)" : "CON (oppose)";

  let prompt = `You are participating in a competitive AI debate.

DEBATE TOPIC: "${req.topic}"
YOUR POSITION: ${positionName}
CURRENT ROUND: ${req.round.toUpperCase()}
WORD LIMIT: ${wordLimit.min}-${wordLimit.max} words

IMPORTANT CONSTRAINTS:
- Your response MUST be between ${wordLimit.min} and ${wordLimit.max} words
- Be persuasive, well-reasoned, and engaging
- Directly address the topic and your assigned position
- Be professional but compelling`;

  if (req.opponent_last_message) {
    prompt += `

OPPONENT'S LAST STATEMENT:
"${req.opponent_last_message}"`;
  }

  if (req.messages_so_far.length > 0) {
    prompt += `

DEBATE HISTORY:`;
    for (const msg of req.messages_so_far) {
      const truncated = msg.content.slice(0, 200);
      prompt += `\n[Round ${msg.round} - ${msg.position.toUpperCase()}]: ${truncated}${msg.content.length > 200 ? "..." : ""}`;
    }
  }

  const roundInstructions: Record<string, string> = {
    opening: "Deliver your opening statement. State your position clearly and present your main arguments.",
    argument: "Present a focused argument supporting your position.",
    rebuttal: "Directly counter your opponent's arguments and reinforce your position.",
    counter: "Counter your opponent's rebuttal. Address their specific points.",
    closing: "Deliver your closing statement. Summarize your key arguments.",
    question: "Ask a pointed, strategic question to expose weaknesses in your opponent's position.",
    answer: "Answer your opponent's question directly while defending your position.",
  };

  prompt += `

TASK: ${roundInstructions[req.round] || "Present your argument."}

Respond with ONLY your debate argument. No meta-commentary or explanations.`;

  return prompt;
}

/**
 * Test an OpenClaw endpoint
 */
export async function testOpenClawEndpoint(
  endpoint: string,
  _authToken?: string // Reserved for future authenticated health checks
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if the gateway is reachable
    const response = await fetch(`${endpoint}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `OpenClaw gateway returned ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reach OpenClaw gateway",
    };
  }
}

/**
 * Handle incoming webhook from OpenClaw (kept for backwards compatibility)
 * @deprecated OpenClaw integration now uses synchronous chat completions API
 */
export async function handleOpenClawWebhook(
  _payload: unknown
): Promise<{ success: boolean; error?: string }> {
  // No longer needed - using synchronous API
  return { success: false, error: "Webhook endpoint deprecated - using synchronous API" };
}
