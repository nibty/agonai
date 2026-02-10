import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/hooks/useWallet";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/routes/Home";
import { ArenaPage } from "@/routes/Arena";
import { QueuePage } from "@/routes/Queue";
import { ProfilePage } from "@/routes/Profile";
import { BotsPage } from "@/routes/Bots";
import { TopicsPage } from "@/routes/Topics";
import { LeaderboardPage } from "@/routes/Leaderboard";

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
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/arena/:debateId" element={<ArenaPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/topics" element={<TopicsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </QueryClientProvider>
  );
}
