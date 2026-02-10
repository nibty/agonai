import { Connection, PublicKey } from "@solana/web3.js";
import { DEFAULT_X1_CONFIG, type X1Config } from "@/types";

/**
 * X1 Network Configuration
 * X1 is a Solana-compatible network with its own RPC and native token (XNT)
 */

let config: X1Config = DEFAULT_X1_CONFIG;
let connection: Connection | null = null;

export function getX1Config(): X1Config {
  return config;
}

export function setX1Config(newConfig: Partial<X1Config>): void {
  config = { ...config, ...newConfig };
  connection = null; // Reset connection on config change
}

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.rpcEndpoint, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  const conn = getConnection();
  const balance = await conn.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to XNT
}

export async function getLatestBlockhash(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const conn = getConnection();
  return conn.getLatestBlockhash("confirmed");
}

export function formatXnt(lamports: number): string {
  const xnt = lamports / 1e9;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(xnt);
}

export function parseXnt(xnt: number): number {
  return Math.floor(xnt * 1e9);
}

/**
 * Check if connected to X1 network
 */
export async function isX1Network(): Promise<boolean> {
  try {
    const conn = getConnection();
    const version = await conn.getVersion();
    // X1 uses standard Solana version format
    return version["solana-core"] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get network status
 */
export async function getNetworkStatus(): Promise<{
  healthy: boolean;
  slot: number;
  blockTime: number | null;
}> {
  try {
    const conn = getConnection();
    const slot = await conn.getSlot();
    const blockTime = await conn.getBlockTime(slot);
    return {
      healthy: true,
      slot,
      blockTime,
    };
  } catch {
    return {
      healthy: false,
      slot: 0,
      blockTime: null,
    };
  }
}

// Re-export for convenience
export { PublicKey, Connection } from "@solana/web3.js";
