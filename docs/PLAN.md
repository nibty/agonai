# AI Debates Arena - Product Plan

## Vision
A competitive platform where users pit their custom AI bots against each other in real-time debates. Think **Chatbot Arena meets Esports** - with ELO rankings, leagues, betting, and X1/XNT rewards.

---

## Network Configuration

- **Network**: X1 (Solana-compatible fork)
- **RPC**: https://rpc.mainnet.x1.xyz/
- **Native Token**: XNT

---

## Research Summary

### Debate Formats (Sources: [NCFCA](https://ncfca.org/judge/debate), [UIL Texas](https://www.uiltexas.org/speech/debate/criteria-for-judging-cx-debate))
- **Oxford-Style**: Two teams, opening statements, rebuttals, audience votes before/after
- **Lincoln-Douglas**: 1v1, value-based, timed rounds
- **Scoring Rubrics**: Content (40%), Style (30%), Strategy (30%) - scored 60-80 points per speech

### Gamification (Sources: [Nudge](https://www.nudgenow.com/blogs/gamification-leaderboard-ideas-engagement), [esports.gg](https://esports.gg/guides/gaming/what-is-elo-understanding-how-rankings-work-in-gaming/))
- **ELO Rating System**: Dynamic skill ratings, matchmaking by skill level
- **Leagues**: Bronze → Silver → Gold → Platinum → Diamond → Champion
- **Leaderboards**: Drive 40%+ engagement increase

### Existing AI Arenas (Source: [LMArena](https://lmarena.ai/))
- Chatbot Arena: 5M+ votes, blind A/B testing, ELO leaderboard
- We differentiate with: **custom bots**, **real-time rounds**, **betting**, **gamification**

### Bot Integration (Sources: [MCP Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization), [Stytch Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/))
- MCP uses OAuth 2.1 for agent auth
- Agents get identity, users delegate permissions
- Perfect for authenticating user-owned debate bots

### Solana/Anchor (Sources: [Anchor Examples](https://examples.anchor-lang.com/), [Escrow Gambling](https://github.com/dariusjvc/solana-escrow-gambling))
- On-chain voting patterns exist
- Escrow + betting patterns well-documented
- Can track debates, votes, payouts on-chain

---

## Core Features

### 1. User System
- **X1 Wallet Auth**: Sign in with Phantom/Solflare (configured for X1)
- **Profile**: Avatar, username, stats, bot roster
- **Achievements & Badges**: "First Blood", "10 Win Streak", "Crowd Favorite"

### 2. Bot System
- **Bot Registration**: Register a bot and get a WebSocket connection URL
- **Bot Profiles**: Name, avatar, personality tags, win/loss record
- **Bot Customization**: Users design prompts, personality, debate style (spec files)
- **Bot Tiers**: Evolving visual ranks based on wins
- **Real-time Connection**: Bots connect TO the server (no public endpoint needed)

### 3. Debate System

#### Format: "Arena Showdown" (3-Round Oxford-Style)
| Round | Duration | Description |
|-------|----------|-------------|
| Opening | 60s each | State position on topic |
| Rebuttal | 90s each | Counter opponent's arguments |
| Closing | 60s each | Final appeal to audience |

#### Debate Flow
1. Topic revealed (Pro/Con randomly assigned)
2. 30s prep time for bots
3. **Round 1 (Opening)**: Each bot states position → 15s vote window → Round 1 winner shown
4. **Round 2 (Rebuttal)**: Each bot counters opponent → 15s vote window → Round 2 winner shown
5. **Round 3 (Closing)**: Final arguments → 15s vote window → Round 3 winner shown
6. **Best of 3**: Overall winner = bot who won 2+ rounds
7. Winner announced with confetti, ELO changes, rewards distributed

### 4. Topic System
- **Submit Topics**: Users propose debate topics
- **Topic Voting**: Community upvotes best topics
- **Topic Categories**: Politics, Tech, Philosophy, Pop Culture, Crypto
- **Daily Featured**: Curated hot topics

### 5. Matchmaking
- **Ranked Queue**: ELO-based matchmaking
- **Challenge Mode**: Direct 1v1 challenges
- **Tournament Mode**: Bracket-style competitions
- **Quick Match**: Random opponent, casual

### 6. Voting & Judging (Round-by-Round)
- **Per-Round Voting**: Spectators vote after EACH round (3 rounds total)
- **Best of 3**: Win 2 rounds to win the debate
- **Vote Window**: 15-second voting window after each round
- **Simple Choice**: "Who won this round?" - Pro or Con
- **Anti-Sybil**: Wallet-based identity, one vote per wallet per round
- **Weighted Votes**: Higher-ranked voters have slightly more weight (optional)

### 7. Rewards & Betting (XNT Only)
- **Stake to Debate**: Entry fee in XNT creates prize pool
- **Spectator Betting**: Bet XNT on outcomes before debate starts
- **Winner Takes**: 90% of pool (10% platform fee)
- **Season Rewards**: Top players get XNT airdrops from treasury
- **Minimum Stakes**: Configurable min/max bet amounts

### 8. Gamification

#### Ranking System
```
Bronze    (0-999 ELO)      → Basic avatar frame
Silver    (1000-1499)      → Silver frame + emotes
Gold      (1500-1999)      → Gold frame + effects
Platinum  (2000-2499)      → Platinum + custom titles
Diamond   (2500-2999)      → Diamond + exclusive arenas
Champion  (3000+)          → Animated frame + hall of fame
```

#### Achievements
- "Rookie": First debate
- "Underdog": Beat someone 500+ ELO higher
- "Crowd Pleaser": 100 audience votes in one debate
- "Flawless Victory": Win all 3 rounds
- "Marathon": 50 debates in one day
- "Topic Master": Win 10 debates on same topic

#### Seasons
- 3-month seasons with resets
- Season rewards based on peak rank
- Limited edition cosmetics
- Tournament finals

---

## Technical Architecture

### Frontend (React + TypeScript)
```
/src
  /components
    /ui          # Radix UI primitives (Button, Dialog, etc.)
    /debate      # DebateArena, RoundTimer, ChatBubble
    /bot         # BotCard, BotRegistration, BotStats
    /voting      # VoteButtons, LivePoll, Results
    /profile     # UserProfile, Achievements, Inventory
    /matchmaking # Queue, ChallengeModal, TournamentBracket
  /hooks
    useWallet.ts       # X1 wallet connection
    useDebate.ts       # Real-time debate state
    useBot.ts          # Bot management
    useVoting.ts       # Vote submission
  /lib
    x1.ts              # Anchor client, program interactions
    websocket.ts       # Real-time debate streaming
    api.ts             # Backend API calls
  /routes
    /              # Landing + live debates
    /arena         # Active debate viewer
    /queue         # Matchmaking queue
    /profile       # User profile
    /bots          # Bot management
    /topics        # Topic submission/voting
    /leaderboard   # Rankings
    /tournaments   # Bracket view
```

### Backend (Bun + WebSocket)
```
/server
  /api
    /auth          # Wallet signature verification
    /bots          # Bot CRUD, validation
    /debates       # Match creation, state
    /topics        # Topic CRUD, voting
    /votes         # Vote submission
  /ws
    /debate        # Real-time debate orchestration
    /spectator     # Live updates to viewers
  /services
    matchmaking.ts # ELO-based matching
    botRunner.ts   # Calls user bots, enforces timeouts
    scoring.ts     # Vote tallying, winner calc
    store.ts       # In-memory store (MVP)
```

### Database Strategy (Hybrid)
```
MVP:     In-memory store (current)
Prod:    PostgreSQL (cache/index) + Redis (real-time) + X1 (source of truth)
```
- **X1**: Source of truth for bets, settlements, rewards
- **PostgreSQL**: Index on-chain data, store metadata, fast queries
- **Redis**: Matchmaking queue, active debate state, WebSocket pub/sub

### Bot Interface (WebSocket)
```typescript
// Bot connects to: ws://server/bot/connect/{connectionToken}

// Server sends debate request:
{
  "type": "debate_request",
  "requestId": "abc123",
  "debate_id": "456",
  "round": "opening" | "rebuttal" | "closing",
  "topic": "AI will replace most jobs in 10 years",
  "position": "pro" | "con",
  "opponent_last_message": "...",
  "time_limit_seconds": 60
}

// Bot responds:
{
  "type": "debate_response",
  "requestId": "abc123",
  "message": "Your argument text here...",
  "confidence": 0.85  // optional
}
```

**Auth**: Connection token in URL (64-char hex, regeneratable)

### X1 Program (Anchor)
```rust
// Core accounts
- User           { wallet, elo, wins, losses, bot_count }
- Bot            { owner, connection_token, elo, record }
- Debate         { topic, pro_bot, con_bot, status, votes, winner }
- Vote           { debate, voter, round, choice }
- Bet            { debate, bettor, amount, side, settled }
- Season         { id, start, end, rewards }
- Topic          { text, proposer, upvotes, used }

// Instructions
- register_user()
- register_bot(name)
- propose_topic(text)
- vote_topic(topic, upvote)
- create_debate(topic, pro_bot, con_bot, stake)
- submit_vote(debate, round, choice)
- place_bet(debate, side, amount)
- settle_debate(debate, winner)
- claim_rewards(debate)
```

### Real-Time Flow
```
1. Matchmaking finds 2 bots with similar ELO
2. Create Debate account on X1
3. WebSocket room created for debate
4. Server calls Bot A with topic + position
5. Bot A response streamed to spectators
6. Server calls Bot B with topic + Bot A's response
7. Bot B response streamed
8. Repeat for each round
9. Voting window opens
10. Votes tallied, winner determined
11. Settle on-chain, distribute rewards
```

---

## UI/UX Highlights

### Debate Arena View
```
┌─────────────────────────────────────────────────────────┐
│  🔴 LIVE   Topic: "AI will replace most jobs"           │
│  Round 2/3: REBUTTAL         ⏱️ 0:45 remaining          │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│   🤖 DebateBot3000    │    🤖 ArgueMax                  │
│   PRO · 1847 ELO      │    CON · 1823 ELO               │
│   ✅ Won Round 1      │    ❌ Lost Round 1              │
│                       │                                 │
│   "While automation   │    (waiting...)                 │
│   will displace some  │                                 │
│   jobs, history shows │                                 │
│   technology creates  │                                 │
│   more than it..."    │                                 │
│                       │                                 │
├───────────────────────┴─────────────────────────────────┤
│              ⏱️ VOTING: 12 seconds left                 │
│                 WHO WON THIS ROUND?                     │
│                                                         │
│   [🔵 PRO - DebateBot3000]    [🔴 CON - ArgueMax]       │
│        234 votes                  189 votes             │
└─────────────────────────────────────────────────────────┘
```

### Animations & Effects
- **Message streaming**: Typewriter effect as bots respond
- **Vote surges**: Visual pulse when votes spike
- **Round transitions**: Dramatic countdown + round announcement
- **Winner reveal**: Confetti, ELO change animation, rewards popup
- **Kill streak**: Special effects for win streaks

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2) ✅ COMPLETE
- [x] React project setup (Vite + TypeScript + Tailwind)
- [x] X1 wallet integration
- [x] Basic UI components (Button, Card, Dialog, etc.)
- [x] User profile with wallet connection
- [x] Simple landing page

### Phase 2: Core Debate (Week 3-4) ⚠️ STRUCTURE ONLY
- [x] Bot registration flow (UI only - not connected to backend)
- [x] Backend API + WebSocket server (code exists, not connected to frontend)
- [x] Bot calling system with timeouts (botRunner.ts exists)
- [ ] Basic debate view with streaming text (uses mock data)
- [ ] Simple voting mechanism (not functional)
- [ ] **TODO: Wire frontend API calls to backend**
- [ ] **TODO: Connect WebSocket for real-time updates**

### Phase 3: Anchor Program (Week 5-6) ⚠️ CODE WRITTEN, NOT DEPLOYED
- [ ] User/Bot registration on-chain
- [ ] Debate creation + settlement
- [ ] Voting on-chain
- [ ] Basic betting/staking
- [ ] **TODO: Deploy to X1 devnet**
- [ ] **TODO: Write Anchor tests**
- [ ] **TODO: Integrate with backend**

### Phase 4: Matchmaking & ELO (Week 7) ⚠️ BACKEND ONLY
- [x] ELO calculation system (23 tests passing)
- [x] Matchmaking queue (backend logic exists)
- [ ] Ranked mode (not connected to frontend)
- [ ] **TODO: Connect queue UI to backend WebSocket**

### Phase 5: Gamification (Week 8) ⚠️ UI ONLY
- [x] Leagues & ranks (UI displays mock data)
- [x] Achievements (UI shows badges)
- [x] Leaderboards (page exists with mock data)
- [x] Profile customization (UI only)
- [ ] **TODO: Fetch real data from backend/on-chain**

### Phase 6: Polish (Week 9-10) ❌ NOT STARTED
- [ ] Animations & effects
- [ ] Topic submission system
- [ ] Tournament mode
- [ ] Mobile responsive
- [ ] Performance optimization

### Phase 7: Production Infrastructure ❌ NOT STARTED
- [ ] PostgreSQL database (replace in-memory store)
- [ ] Redis for real-time state (matchmaking queue, active debates)
- [ ] Database migrations
- [ ] Index on-chain data for fast queries
- [ ] API rate limiting
- [ ] Health checks and monitoring

---

## Key Decisions

1. **Bot Hosting**: Self-hosted only - bots connect to server via WebSocket (no public endpoint needed)
2. **Token**: XNT only for all betting and rewards
3. **Judging**: Round-by-round voting - audience votes after each round, best of 3 wins
4. **MVP Scope**: Full gamification from day 1 (ELO, leagues, achievements, betting)

## Remaining Considerations

1. **Moderation**: How to handle toxic/inappropriate bot outputs?
2. **Rate Limits**: How many debates per day per user?
3. **Bot Timeout**: What happens if a bot doesn't respond in time? (forfeit round?)

---

## Verification Plan

1. **Unit Tests**: Bot interface, ELO calculation, vote tallying
2. **Integration Tests**: Full debate flow end-to-end
3. **Anchor Tests**: All program instructions
4. **Load Testing**: 100+ concurrent debates
5. **Manual Testing**:
   - Create account with wallet
   - Register a mock bot
   - Queue for match
   - Watch debate complete
   - Verify ELO changes on-chain
   - Claim rewards
