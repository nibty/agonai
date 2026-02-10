// ============================================================================
// Debate Preset System
// ============================================================================

/**
 * Round configuration within a preset
 */
export interface RoundConfig {
  /** Display name for the round (e.g., "Opening", "Cross-Examination") */
  name: string;

  /** Round type identifier */
  type: "opening" | "argument" | "rebuttal" | "counter" | "closing" | "question" | "answer";

  /** Who speaks this round */
  speaker: "pro" | "con" | "both";

  /** Word limits for this round */
  wordLimit: { min: number; max: number };

  /** Time limit in seconds */
  timeLimit: number;

  /** For Q&A rounds: number of exchanges */
  exchanges?: number;
}

/**
 * Complete debate preset configuration
 */
export interface DebatePreset {
  /** Unique identifier (e.g., "lightning", "classic") */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** What this format is best for */
  bestFor: string;

  /** Structure explanation */
  structure: string;

  /** Round configurations in order */
  rounds: RoundConfig[];

  /** Prep time before debate starts (seconds) */
  prepTime: number;

  /** Voting window after each round (seconds) */
  voteWindow: number;

  /** How winner is determined */
  winCondition: string;
}

// ============================================================================
// Preset Definitions
// ============================================================================

export const PRESETS: Record<string, DebatePreset> = {
  lightning: {
    id: "lightning",
    name: "Lightning Round",
    description: "Quick-fire exchanges with tight constraints.",
    bestFor: "Fast, punchy back-and-forth",
    structure: "Alternating responses, no formal opening/closing statements",
    prepTime: 15,
    voteWindow: 45,
    winCondition: "Win 3 of 5 rounds",
    rounds: [
      {
        name: "Round 1",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 30, max: 75 },
        timeLimit: 30,
      },
      {
        name: "Round 2",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 30, max: 75 },
        timeLimit: 30,
      },
      {
        name: "Round 3",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 30, max: 75 },
        timeLimit: 30,
      },
      {
        name: "Round 4",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 30, max: 75 },
        timeLimit: 30,
      },
      {
        name: "Round 5",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 30, max: 75 },
        timeLimit: 30,
      },
    ],
  },

  classic: {
    id: "classic",
    name: "Classic Duel",
    description: "Traditional structured debate with clear phases.",
    bestFor: "Deeper arguments with formal rhythm",
    structure: "Each bot gets one turn per round, sides assigned (Pro/Con)",
    prepTime: 30,
    voteWindow: 60,
    winCondition: "Win 4 of 7 rounds",
    rounds: [
      {
        name: "Opening",
        type: "opening",
        speaker: "both",
        wordLimit: { min: 75, max: 150 },
        timeLimit: 45,
      },
      {
        name: "Argument 1",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Argument 2",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Rebuttal",
        type: "rebuttal",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Counter-Rebuttal",
        type: "counter",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Final Rebuttal",
        type: "rebuttal",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Closing",
        type: "closing",
        speaker: "both",
        wordLimit: { min: 75, max: 150 },
        timeLimit: 45,
      },
    ],
  },

  crossex: {
    id: "crossex",
    name: "Cross-Examination",
    description: "One bot argues, the other grills them — then they swap.",
    bestFor: "Testing how well bots defend under pressure",
    structure: "Argument → Questions → Swap roles → Final statements",
    prepTime: 20,
    voteWindow: 50,
    winCondition: "Win 4 of 7 rounds",
    rounds: [
      {
        name: "Pro Opening",
        type: "opening",
        speaker: "pro",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Con Opening",
        type: "opening",
        speaker: "con",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Pro Argument",
        type: "argument",
        speaker: "pro",
        wordLimit: { min: 75, max: 150 },
        timeLimit: 45,
      },
      {
        name: "Con Cross-Examination",
        type: "question",
        speaker: "con",
        wordLimit: { min: 25, max: 50 },
        timeLimit: 20,
        exchanges: 3,
      },
      {
        name: "Con Argument",
        type: "argument",
        speaker: "con",
        wordLimit: { min: 75, max: 150 },
        timeLimit: 45,
      },
      {
        name: "Pro Cross-Examination",
        type: "question",
        speaker: "pro",
        wordLimit: { min: 25, max: 50 },
        timeLimit: 20,
        exchanges: 3,
      },
      {
        name: "Final Statements",
        type: "closing",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
    ],
  },

  escalation: {
    id: "escalation",
    name: "Escalation",
    description: "Starts casual, gets increasingly formal and intense.",
    bestFor: "Building tension and variety within a single debate",
    structure:
      "Word limits grow each round; early rounds loose, final round requires structured arguments",
    prepTime: 20,
    voteWindow: 50,
    winCondition: "Win 4 of 6 rounds",
    rounds: [
      {
        name: "Warm Up",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 25, max: 50 },
        timeLimit: 20,
      },
      {
        name: "Getting Started",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 40, max: 75 },
        timeLimit: 25,
      },
      {
        name: "Building",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 50, max: 100 },
        timeLimit: 30,
      },
      {
        name: "Heating Up",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 60, max: 110 },
        timeLimit: 35,
      },
      {
        name: "Intensifying",
        type: "argument",
        speaker: "both",
        wordLimit: { min: 75, max: 125 },
        timeLimit: 40,
      },
      {
        name: "Climax",
        type: "closing",
        speaker: "both",
        wordLimit: { min: 100, max: 175 },
        timeLimit: 50,
      },
    ],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a preset by ID
 */
export function getPreset(id: string): DebatePreset | undefined {
  return PRESETS[id];
}

/**
 * Get all available presets
 */
export function getAllPresets(): DebatePreset[] {
  return Object.values(PRESETS);
}

/**
 * Get preset IDs
 */
export function getPresetIds(): string[] {
  return Object.keys(PRESETS);
}

/**
 * Default preset ID
 */
export const DEFAULT_PRESET_ID = "classic";

/**
 * Get the default preset
 */
export function getDefaultPreset(): DebatePreset {
  return PRESETS[DEFAULT_PRESET_ID]!;
}

/**
 * Calculate total debate duration estimate (in seconds)
 */
export function estimateDuration(preset: DebatePreset): number {
  const roundTime = preset.rounds.reduce((sum, r) => {
    // For "both" speakers, double the time (pro + con)
    const multiplier = r.speaker === "both" ? 2 : 1;
    const exchanges = r.exchanges ?? 1;
    return sum + r.timeLimit * multiplier * exchanges + preset.voteWindow;
  }, 0);

  return preset.prepTime + roundTime;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${minutes}m`;
  return `${minutes}m ${secs}s`;
}
