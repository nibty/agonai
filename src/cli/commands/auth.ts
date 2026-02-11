import { createLogger } from "@x1-labs/logging";
import { loadConfig, updateConfig, clearToken, isLoggedIn } from "../lib/config.js";
import { loadKeypair, getWalletAddress, signMessage } from "../lib/wallet.js";
import { getChallenge, verifySignature, get } from "../lib/api.js";

const logger = createLogger({ name: "cli-auth" });

interface MeResponse {
  user: {
    id: number;
    walletAddress: string;
    username: string | null;
    elo: number;
    wins: number;
    losses: number;
  };
}

/**
 * Login with a Solana keypair
 * Priority: WALLET_KEYPAIR env > --keypair flag > default path
 */
export async function login(keypairPath?: string): Promise<void> {
  const config = loadConfig();
  const hasEnvKeypair = !!process.env["WALLET_KEYPAIR"];

  if (hasEnvKeypair) {
    logger.info({}, "Loading keypair from WALLET_KEYPAIR env var");
  } else {
    const kpPath = keypairPath || config.defaultKeypair;
    logger.info({ keypairPath: kpPath }, "Loading keypair from file");
  }

  let keypair;
  try {
    keypair = loadKeypair(keypairPath || config.defaultKeypair);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to load keypair"
    );
    process.exit(1);
  }

  const walletAddress = getWalletAddress(keypair);
  logger.info({ walletAddress }, "Wallet loaded");

  // Step 1: Get challenge
  logger.info({}, "Requesting auth challenge");
  const challengeResult = await getChallenge(walletAddress);

  if (challengeResult.error || !challengeResult.data) {
    logger.error({ error: challengeResult.error }, "Failed to get challenge");
    process.exit(1);
  }

  const { challenge } = challengeResult.data;
  logger.debug({ challenge: challenge.slice(0, 50) }, "Challenge received");

  // Step 2: Sign challenge
  const signature = signMessage(keypair, challenge);
  logger.debug({}, "Challenge signed");

  // Step 3: Verify and get token
  logger.info({}, "Verifying signature");
  const verifyResult = await verifySignature(walletAddress, signature);

  if (verifyResult.error || !verifyResult.data) {
    logger.error({ error: verifyResult.error }, "Failed to verify signature");
    process.exit(1);
  }

  const { token, user } = verifyResult.data;

  // Save token to config
  updateConfig({ token });

  logger.info(
    { userId: user.id, walletAddress: user.walletAddress, elo: user.elo },
    "Login successful"
  );

  console.log(`\nLogged in as: ${user.walletAddress}`);
  console.log(`ELO: ${user.elo} | Wins: ${user.wins} | Losses: ${user.losses}`);
}

/**
 * Show login status
 */
export async function status(): Promise<void> {
  if (!isLoggedIn()) {
    console.log("Not logged in. Use 'cli login' to authenticate.");
    return;
  }

  const result = await get<MeResponse>("/auth/me");

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Session invalid or expired");
    clearToken();
    console.log("Session expired. Please login again.");
    return;
  }

  const { user } = result.data;
  console.log(`\nLogged in as: ${user.walletAddress}`);
  console.log(`ELO: ${user.elo} | Wins: ${user.wins} | Losses: ${user.losses}`);
}

/**
 * Logout (clear token)
 */
export function logout(): void {
  if (!isLoggedIn()) {
    console.log("Not logged in.");
    return;
  }

  clearToken();
  console.log("Logged out successfully.");
}
