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
