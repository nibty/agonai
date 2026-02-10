import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authService } from "../services/authService.js";

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const ChallengeRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

const VerifyRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string().min(1),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/auth/challenge
 *
 * Request a challenge message for wallet authentication.
 * The client should sign this message with their wallet.
 */
router.post("/challenge", async (req: Request, res: Response) => {
  const result = ChallengeRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { walletAddress } = result.data;

  console.log(`[Auth] Challenge request for wallet: ${walletAddress.slice(0, 8)}...`);

  try {
    const { challenge, expiresAt } = await authService.createChallenge(walletAddress);

    console.log(`[Auth] Challenge created, expires: ${expiresAt.toISOString()}`);

    res.json({
      challenge,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create challenge:", error);
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

/**
 * POST /api/auth/verify
 *
 * Verify a signed challenge and return JWT + user data.
 */
router.post("/verify", async (req: Request, res: Response) => {
  const result = VerifyRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { walletAddress, signature } = result.data;

  console.log(`[Auth] Verify request for wallet: ${walletAddress.slice(0, 8)}...`);

  try {
    const authResult = await authService.verifyChallenge(walletAddress, signature);

    if (!authResult) {
      console.log(`[Auth] Verification failed for wallet: ${walletAddress.slice(0, 8)}...`);
      res.status(401).json({ error: "Invalid or expired challenge" });
      return;
    }

    console.log(`[Auth] Verification successful for wallet: ${walletAddress.slice(0, 8)}...`);

    res.json({
      token: authResult.token,
      user: {
        id: authResult.user.id,
        walletAddress: authResult.user.walletAddress,
        username: authResult.user.username,
        elo: authResult.user.elo,
        wins: authResult.user.wins,
        losses: authResult.user.losses,
        createdAt: authResult.user.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to verify challenge:", error);
    res.status(500).json({ error: "Failed to verify challenge" });
  }
});

/**
 * GET /api/auth/me
 *
 * Get current user from JWT.
 * Requires Authorization: Bearer <token>
 */
router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Import here to avoid circular dependency
  const { userRepository } = await import("../repositories/userRepository.js");
  const user = await userRepository.findById(payload.userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      createdAt: user.createdAt,
    },
  });
});

export { router as authRouter };
