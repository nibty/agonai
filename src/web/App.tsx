import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "flowbite-react";
import { WalletProvider, AuthProvider, useAuth } from "@/hooks";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/routes/Home";
import { ArenaPage } from "@/routes/Arena";
import { QueuePage } from "@/routes/Queue";
import { ProfilePage } from "@/routes/Profile";
import { BotsPage } from "@/routes/Bots";
import { TopicsPage } from "@/routes/Topics";
import { LeaderboardPage } from "@/routes/Leaderboard";
import { arenaTheme } from "@/lib/flowbiteTheme";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthenticating } = useAuth();

  if (isAuthenticating) {
    return <div className="flex min-h-[50vh] items-center justify-center text-gray-400">Authenticating...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <ThemeProvider theme={arenaTheme}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/arena/:debateId" element={<ArenaPage />} />
                  <Route path="/queue" element={<QueuePage />} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/bots" element={<ProtectedRoute><BotsPage /></ProtectedRoute>} />
                  <Route path="/topics" element={<TopicsPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
