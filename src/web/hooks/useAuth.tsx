import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useWallet } from "./useWallet";
import { api } from "@/lib/api";

interface AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  userId: string | null;
  error: string | null;
  authenticate: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, signMessage, disconnect } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasTriedAutoAuth = useRef(false); // Only auto-auth once per session

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected");
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const walletAddress = publicKey.toBase58();

      // Get challenge from API
      const { challenge } = await api.getChallenge(walletAddress);

      // Sign the challenge
      const messageBytes = new TextEncoder().encode(challenge);
      const signature = await signMessage(messageBytes);

      // Convert signature to base64
      let binary = "";
      for (let i = 0; i < signature.length; i++) {
        binary += String.fromCharCode(signature[i]!);
      }
      const signatureBase64 = btoa(binary);

      // Verify with API and get token
      const { token, user } = await api.verifyChallenge(walletAddress, signatureBase64);

      // Store token
      localStorage.setItem("auth_token", token);
      api.setAuthToken(token);

      setUserId(user.id);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Authentication failed:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    api.setAuthToken(null);
    setIsAuthenticated(false);
    setUserId(null);
    void disconnect();
  }, [disconnect]);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      api.setAuthToken(token);
      // Verify token is still valid
      api.getMe()
        .then((res) => {
          setUserId(res.user.id);
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem("auth_token");
          api.setAuthToken(null);
        });
    }
  }, []);

  // Auto-authenticate when wallet connects (only once per connection)
  useEffect(() => {
    if (connected && publicKey && !isAuthenticated && !isAuthenticating && !hasTriedAutoAuth.current) {
      hasTriedAutoAuth.current = true;
      void authenticate();
    }
  }, [connected, publicKey, isAuthenticated, isAuthenticating, authenticate]);

  // Reset auto-auth flag and clear auth state when wallet disconnects
  useEffect(() => {
    if (!connected) {
      hasTriedAutoAuth.current = false;
      if (isAuthenticated) {
        localStorage.removeItem("auth_token");
        api.setAuthToken(null);
        setIsAuthenticated(false);
        setUserId(null);
      }
    }
  }, [connected, isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthenticating,
        userId,
        error,
        authenticate,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
