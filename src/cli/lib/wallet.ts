import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

/**
 * Resolve keypair path, expanding ~ to home directory
 */
function resolvePath(keypairPath: string): string {
  if (keypairPath.startsWith("~")) {
    return path.join(os.homedir(), keypairPath.slice(1));
  }
  return path.resolve(keypairPath);
}

/**
 * Load a Solana keypair from the WALLET_KEYPAIR env var (JSON array of bytes)
 */
export function loadKeypairFromEnv(): Keypair | null {
  const envValue = process.env["WALLET_KEYPAIR"];
  if (!envValue) {
    return null;
  }

  try {
    const secretKey = new Uint8Array(JSON.parse(envValue) as number[]);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error("Invalid WALLET_KEYPAIR format. Expected JSON array of bytes.");
  }
}

/**
 * Load a Solana keypair from a JSON file
 */
export function loadKeypairFromFile(keypairPath: string): Keypair {
  const resolvedPath = resolvePath(keypairPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Keypair file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const secretKey = new Uint8Array(JSON.parse(content) as number[]);
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Load keypair from env var, file path, or default location
 * Priority: WALLET_KEYPAIR env > --keypair flag > default path
 */
export function loadKeypair(keypairPath?: string): Keypair {
  // First try env var
  const fromEnv = loadKeypairFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  // Then try file path
  if (keypairPath) {
    return loadKeypairFromFile(keypairPath);
  }

  // Finally try default location
  const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
  return loadKeypairFromFile(defaultPath);
}

/**
 * Get the wallet address (public key) from a keypair
 */
export function getWalletAddress(keypair: Keypair): string {
  return keypair.publicKey.toBase58();
}

/**
 * Sign a message with a keypair
 * Returns base64-encoded signature
 */
export function signMessage(keypair: Keypair, message: string): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return Buffer.from(signature).toString("base64");
}
