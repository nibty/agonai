import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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
      console.log(`[Auth FE] Challenge length: ${challenge.length}`);
      console.log(`[Auth FE] Challenge first 50 chars: "${challenge.slice(0, 50)}"`);
      const messageBytes = new TextEncoder().encode(challenge);
      console.log(`[Auth FE] Message bytes length: ${messageBytes.length}`);
      // Log first 10 bytes to compare with backend
      console.log(`[Auth FE] Message first 10 bytes: ${Array.from(messageBytes.slice(0, 10)).join(",")}`);
      // Simple checksum for comparison
      const checksum = Array.from(messageBytes).reduce((a, b) => a + b, 0);
      console.log(`[Auth FE] Message checksum: ${checksum}`);
      // Find all newline positions
      const newlinePositions: string[] = [];
      for (let i = 0; i < messageBytes.length; i++) {
        if (messageBytes[i] === 10 || messageBytes[i] === 13) {
          newlinePositions.push(`${i}:${messageBytes[i]}`);
        }
      }
      console.log(`[Auth FE] Newlines (pos:byte): ${newlinePositions.join(", ")}`);
      const signature = await signMessage(messageBytes);
      console.log(`[Auth] Signature length: ${signature.length}`);
      console.log(`[Auth] Signature first 8 bytes: ${Array.from(signature.slice(0, 8)).join(",")}`);

      // Convert signature to base64 using Buffer-like approach
      let binary = "";
      for (let i = 0; i < signature.length; i++) {
        binary += String.fromCharCode(signature[i]!);
      }
      const signatureBase64 = btoa(binary);
      console.log(`[Auth] Signature base64: ${signatureBase64.slice(0, 20)}...`);

      // Verify encoding round-trip
      const decoded = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
      console.log(`[Auth] Decoded first 8 bytes: ${Array.from(decoded.slice(0, 8)).join(",")}`);
      console.log(`[Auth] Encoding match: ${Array.from(signature.slice(0, 8)).join(",") === Array.from(decoded.slice(0, 8)).join(",")}`);


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

  // NOTE: We intentionally do NOT auto-authenticate when wallet connects.
  // Users must explicitly click "Sign In" to avoid unexpected wallet popups on page reload.

  // Clear auth state when wallet disconnects
  useEffect(() => {
    if (!connected && isAuthenticated) {
      localStorage.removeItem("auth_token");
      api.setAuthToken(null);
      setIsAuthenticated(false);
      setUserId(null);
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
