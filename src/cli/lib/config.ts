import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Config {
  apiUrl: string;
  token?: string;
  defaultKeypair?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".agonai");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: Config = {
  apiUrl: "https://api.debate.x1.xyz",
  defaultKeypair: path.join(os.homedir(), ".config", "solana", "id.json"),
};

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load config from file, merging with defaults
 */
export function loadConfig(): Config {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const stored = JSON.parse(content) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save config to file
 */
export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Update specific config values
 */
export function updateConfig(updates: Partial<Config>): Config {
  const config = loadConfig();
  const updated = { ...config, ...updates };
  saveConfig(updated);
  return updated;
}

/**
 * Get the JWT token from config
 */
export function getToken(): string | undefined {
  return loadConfig().token;
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  const token = getToken();
  return token !== undefined && token.length > 0;
}

/**
 * Clear the stored token (logout)
 */
export function clearToken(): void {
  const config = loadConfig();
  delete config.token;
  saveConfig(config);
}
