import { useState, useEffect, useCallback, useMemo } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { User, Bot, Achievement, Rank } from "@/types";
import { getRankFromElo, ELO_CONFIG } from "@/types";

interface UserProfile extends User {
  bots: Bot[];
}

interface UseUserResult {
  user: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Mock achievements for development
const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-win",
    name: "First Victory",
    description: "Win your first debate",
    icon: "trophy",
    unlockedAt: new Date("2024-01-15"),
  },
  {
    id: "debate-veteran",
    name: "Debate Veteran",
    description: "Participate in 10 debates",
    icon: "medal",
    unlockedAt: new Date("2024-01-20"),
  },
];

// Mock bots for development
function createMockBots(wallet: string): Bot[] {
  return [
    {
      id: `bot-${wallet.slice(0, 8)}-1`,
      owner: wallet,
      name: "Aristotle AI",
      avatar: null,
      endpoint: "https://api.example.com/bots/aristotle",
      elo: 1250,
      wins: 15,
      losses: 8,
      tier: 2,
      personalityTags: ["logical", "philosophical", "calm"],
      createdAt: new Date("2024-01-10"),
    },
    {
      id: `bot-${wallet.slice(0, 8)}-2`,
      owner: wallet,
      name: "Socratic Inquirer",
      avatar: null,
      endpoint: "https://api.example.com/bots/socratic",
      elo: 980,
      wins: 5,
      losses: 7,
      tier: 1,
      personalityTags: ["questioning", "methodical"],
      createdAt: new Date("2024-01-25"),
    },
  ];
}

// Mock user data generator
function createMockUser(wallet: string): UserProfile {
  const elo = 1250;
  const rank: Rank = getRankFromElo(elo);
  const bots = createMockBots(wallet);

  return {
    wallet,
    username: null,
    avatar: null,
    elo,
    wins: 20,
    losses: 15,
    botCount: bots.length,
    rank,
    achievements: MOCK_ACHIEVEMENTS,
    createdAt: new Date("2024-01-01"),
    bots,
  };
}

export function useUser(publicKey: PublicKey | null): UseUserResult {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const walletAddress = useMemo(() => (publicKey ? publicKey.toBase58() : null), [publicKey]);

  const fetchUser = useCallback(async (): Promise<void> => {
    if (!walletAddress) {
      setUser(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/users/${walletAddress}`);
      // const data = await response.json();

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Use mock data for now
      const mockUser = createMockUser(walletAddress);
      setUser(mockUser);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user data");
      setError(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const refetch = useCallback(async (): Promise<void> => {
    await fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    error,
    refetch,
  };
}

// Export individual stat getters for convenience
export function useUserStats(publicKey: PublicKey | null): {
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  rank: Rank;
  isLoading: boolean;
} {
  const { user, isLoading } = useUser(publicKey);

  const stats = useMemo(() => {
    if (!user) {
      return {
        elo: ELO_CONFIG.DEFAULT_ELO,
        wins: 0,
        losses: 0,
        winRate: 0,
        rank: "bronze" as Rank,
        isLoading,
      };
    }

    const totalGames = user.wins + user.losses;
    const winRate = totalGames > 0 ? (user.wins / totalGames) * 100 : 0;

    return {
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      winRate,
      rank: user.rank,
      isLoading,
    };
  }, [user, isLoading]);

  return stats;
}

// Export bots list getter
export function useUserBots(publicKey: PublicKey | null): {
  bots: Bot[];
  isLoading: boolean;
  error: Error | null;
} {
  const { user, isLoading, error } = useUser(publicKey);

  return {
    bots: user?.bots ?? [],
    isLoading,
    error,
  };
}

// Export achievements getter
export function useUserAchievements(publicKey: PublicKey | null): {
  achievements: Achievement[];
  isLoading: boolean;
} {
  const { user, isLoading } = useUser(publicKey);

  return {
    achievements: user?.achievements ?? [],
    isLoading,
  };
}
