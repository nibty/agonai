import { eq, and, lt, gt, desc } from "drizzle-orm";
import { db, authChallenges } from "../db/index.js";
import type { User } from "../db/types.js";
import { userRepository } from "../repositories/userRepository.js";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { logger } from "./logger.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";
const JWT_EXPIRY = "7d";
const CHALLENGE_EXPIRY_MINUTES = 5;

export interface JwtPayload {
  userId: number;
  walletAddress: string;
}

export const authService = {
  /**
   * Generate a challenge for wallet authentication
   */
  async createChallenge(walletAddress: string): Promise<{ challenge: string; expiresAt: Date }> {
    // Invalidate any existing challenges for this wallet
    await db
      .update(authChallenges)
      .set({ used: true })
      .where(and(eq(authChallenges.walletAddress, walletAddress), eq(authChallenges.used, false)));

    const nonce = randomBytes(32).toString("hex");
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000);

    const message = `AI Debates Arena

Sign this message to verify your wallet ownership.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}

This signature will not trigger any blockchain transaction or cost any gas fees.`;

    const insertResult = await db
      .insert(authChallenges)
      .values({
        walletAddress,
        nonce,
        message,
        expiresAt,
      })
      .returning();

    // Immediately verify what was stored
    const stored = insertResult[0];
    if (stored) {
      const storedBytes = new TextEncoder().encode(stored.message);
      const storedChecksum = Array.from(storedBytes).reduce((a, b) => a + b, 0);
      logger.debug(
        { messageLength: stored.message.length, checksum: storedChecksum },
        "Challenge stored in DB"
      );
      if (stored.message !== message) {
        logger.warn({ walletAddress }, "Message was modified during insert");
        // Find first difference
        for (let i = 0; i < message.length; i++) {
          if (message[i] !== stored.message[i]) {
            logger.warn(
              {
                index: i,
                originalChar: message[i],
                originalCharCode: message.charCodeAt(i),
                storedChar: stored.message[i],
                storedCharCode: stored.message.charCodeAt(i),
              },
              "First character difference found"
            );
            break;
          }
        }
      }
    }

    // Log checksum of message being sent to client
    const msgBytes = new TextEncoder().encode(message);
    const checksum = Array.from(msgBytes).reduce((a, b) => a + b, 0);
    logger.debug({ messageLength: message.length, checksum }, "Challenge created");

    return { challenge: message, expiresAt };
  },

  /**
   * Verify a signed challenge and return JWT + user
   */
  async verifyChallenge(
    walletAddress: string,
    signature: string
  ): Promise<{ token: string; user: User } | null> {
    logger.debug({ walletAddress: walletAddress.slice(0, 8) + "..." }, "Looking for challenge");

    // Find valid challenge
    const result = await db
      .select()
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.walletAddress, walletAddress),
          eq(authChallenges.used, false),
          gt(authChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(authChallenges.expiresAt))
      .limit(1);

    const challenge = result[0];
    if (!challenge) {
      logger.debug({ walletAddress }, "No valid challenge found (expired or already used)");
      // Check if any challenges exist at all for this wallet
      const allChallenges = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.walletAddress, walletAddress));
      logger.debug(
        { walletAddress, totalChallenges: allChallenges.length },
        "Total challenges for wallet"
      );
      if (allChallenges.length > 0) {
        const latest = allChallenges[allChallenges.length - 1];
        logger.debug(
          {
            used: latest?.used,
            expiresAt: latest?.expiresAt?.toISOString(),
            now: new Date().toISOString(),
          },
          "Latest challenge details"
        );
      }
      return null;
    }

    // Log checksum of message retrieved from database
    const dbMsgBytes = new TextEncoder().encode(challenge.message);
    const dbChecksum = Array.from(dbMsgBytes).reduce((a, b) => a + b, 0);
    logger.debug(
      { messageLength: challenge.message.length, checksum: dbChecksum },
      "Retrieved challenge from DB"
    );

    // Log detailed diff to find what changed
    logger.debug(
      { messageStart: challenge.message.slice(0, 100), messageEnd: challenge.message.slice(-100) },
      "DB message raw content"
    );

    logger.debug({ walletAddress }, "Found challenge, verifying signature");

    // Verify signature
    const isValid = this.verifySignature(walletAddress, challenge.message, signature);
    if (!isValid) {
      logger.warn({ walletAddress }, "Signature verification failed");
      return null;
    }

    logger.debug({ walletAddress }, "Signature verified successfully");

    // Mark challenge as used
    await db.update(authChallenges).set({ used: true }).where(eq(authChallenges.id, challenge.id));

    // Find or create user
    const user = await userRepository.findOrCreate(walletAddress);

    // Generate JWT
    const token = this.generateToken(user);

    return { token, user };
  },

  /**
   * Verify a Solana wallet signature
   */
  verifySignature(walletAddress: string, message: string, signatureBase64: string): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = Buffer.from(signatureBase64, "base64");

      // Use Solana PublicKey for verification
      const publicKey = new PublicKey(walletAddress);
      const publicKeyBytes = publicKey.toBytes();

      // Simple checksum for comparison
      const checksum = Array.from(messageBytes).reduce((a, b) => a + b, 0);
      // Find all newline positions and their byte values
      const newlinePositions: string[] = [];
      for (let i = 0; i < messageBytes.length; i++) {
        if (messageBytes[i] === 10 || messageBytes[i] === 13) {
          newlinePositions.push(`${i}:${messageBytes[i]}`);
        }
      }
      logger.debug(
        {
          messageLength: messageBytes.length,
          messageFirst10Bytes: Array.from(messageBytes.slice(0, 10)).join(","),
          checksum,
          newlinePositions: newlinePositions.join(", "),
          signatureLength: signatureBytes.length,
          publicKeyBytesLength: publicKeyBytes.length,
        },
        "Verifying signature"
      );

      // Try nacl verification
      const result = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      logger.debug({ result }, "nacl.verify result");
      return result;
    } catch (err) {
      logger.error({ err }, "Signature verification error");
      return false;
    }
  },

  /**
   * Generate a JWT for the user
   */
  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      walletAddress: user.walletAddress,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  },

  /**
   * Verify and decode a JWT
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  },

  /**
   * Clean up expired challenges
   */
  async cleanupExpiredChallenges(): Promise<number> {
    const result = await db
      .delete(authChallenges)
      .where(lt(authChallenges.expiresAt, new Date()))
      .returning();

    return result.length;
  },
};
