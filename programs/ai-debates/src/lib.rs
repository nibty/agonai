use anchor_lang::prelude::*;

declare_id!("DbateArenaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

/// AI Debates Arena Program
///
/// Tracks debates, bots, voting, and betting on X1 network.
/// All stakes and rewards are in XNT (native token).

#[program]
pub mod ai_debates {
    use super::*;

    /// Initialize the platform state
    pub fn initialize(ctx: Context<Initialize>, platform_fee_bps: u16) -> Result<()> {
        require!(platform_fee_bps <= 1000, ErrorCode::FeeTooHigh); // Max 10%

        let platform = &mut ctx.accounts.platform;
        platform.authority = ctx.accounts.authority.key();
        platform.treasury = ctx.accounts.treasury.key();
        platform.platform_fee_bps = platform_fee_bps;
        platform.total_debates = 0;
        platform.total_users = 0;
        platform.total_volume = 0;
        platform.bump = ctx.bumps.platform;

        msg!("Platform initialized with {}bps fee", platform_fee_bps);
        Ok(())
    }

    /// Register a new user
    pub fn register_user(ctx: Context<RegisterUser>, username: String) -> Result<()> {
        require!(username.len() <= 32, ErrorCode::UsernameTooLong);

        let user = &mut ctx.accounts.user;
        user.wallet = ctx.accounts.wallet.key();
        user.username = username;
        user.elo = 1200; // Starting ELO
        user.wins = 0;
        user.losses = 0;
        user.bot_count = 0;
        user.total_wagered = 0;
        user.total_won = 0;
        user.created_at = Clock::get()?.unix_timestamp;
        user.bump = ctx.bumps.user;

        let platform = &mut ctx.accounts.platform;
        platform.total_users += 1;

        msg!("User registered: {}", user.username);
        Ok(())
    }

    /// Register a new bot
    pub fn register_bot(
        ctx: Context<RegisterBot>,
        name: String,
        endpoint_hash: [u8; 32], // Hash of endpoint URL for verification
    ) -> Result<()> {
        require!(name.len() <= 50, ErrorCode::BotNameTooLong);

        let bot = &mut ctx.accounts.bot;
        bot.owner = ctx.accounts.owner.key();
        bot.name = name;
        bot.endpoint_hash = endpoint_hash;
        bot.elo = 1200;
        bot.wins = 0;
        bot.losses = 0;
        bot.is_active = true;
        bot.created_at = Clock::get()?.unix_timestamp;
        bot.bump = ctx.bumps.bot;

        let user = &mut ctx.accounts.user;
        user.bot_count += 1;

        msg!("Bot registered: {}", bot.name);
        Ok(())
    }

    /// Propose a new debate topic
    pub fn propose_topic(ctx: Context<ProposeTopic>, text: String, category: String) -> Result<()> {
        require!(text.len() >= 10 && text.len() <= 500, ErrorCode::InvalidTopicLength);
        require!(category.len() <= 32, ErrorCode::CategoryTooLong);

        let topic = &mut ctx.accounts.topic;
        topic.proposer = ctx.accounts.proposer.key();
        topic.text = text;
        topic.category = category;
        topic.upvotes = 0;
        topic.downvotes = 0;
        topic.times_used = 0;
        topic.created_at = Clock::get()?.unix_timestamp;
        topic.bump = ctx.bumps.topic;

        msg!("Topic proposed");
        Ok(())
    }

    /// Vote on a topic (upvote or downvote)
    pub fn vote_topic(ctx: Context<VoteTopic>, upvote: bool) -> Result<()> {
        let topic = &mut ctx.accounts.topic;
        let vote_record = &mut ctx.accounts.vote_record;

        // Check if already voted
        require!(!vote_record.has_voted, ErrorCode::AlreadyVoted);

        vote_record.voter = ctx.accounts.voter.key();
        vote_record.topic = topic.key();
        vote_record.upvote = upvote;
        vote_record.has_voted = true;
        vote_record.bump = ctx.bumps.vote_record;

        if upvote {
            topic.upvotes += 1;
        } else {
            topic.downvotes += 1;
        }

        Ok(())
    }

    /// Create a new debate between two bots
    pub fn create_debate(
        ctx: Context<CreateDebate>,
        topic_text: String,
        stake_amount: u64,
    ) -> Result<()> {
        require!(stake_amount > 0, ErrorCode::InvalidStake);

        let debate = &mut ctx.accounts.debate;
        debate.topic = topic_text;
        debate.pro_bot = ctx.accounts.pro_bot.key();
        debate.con_bot = ctx.accounts.con_bot.key();
        debate.status = DebateStatus::Pending;
        debate.stake_amount = stake_amount;
        debate.total_pro_votes = 0;
        debate.total_con_votes = 0;
        debate.pro_rounds_won = 0;
        debate.con_rounds_won = 0;
        debate.winner = None;
        debate.created_at = Clock::get()?.unix_timestamp;
        debate.started_at = None;
        debate.completed_at = None;
        debate.bump = ctx.bumps.debate;

        // Transfer stake from both bot owners
        let pro_owner = &ctx.accounts.pro_owner;
        let con_owner = &ctx.accounts.con_owner;
        let escrow = &ctx.accounts.escrow;

        // Transfer from pro owner
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: pro_owner.to_account_info(),
                    to: escrow.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        // Transfer from con owner
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: con_owner.to_account_info(),
                    to: escrow.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        let platform = &mut ctx.accounts.platform;
        platform.total_debates += 1;

        msg!("Debate created with {} XNT stake each", stake_amount);
        Ok(())
    }

    /// Start a debate (called by backend oracle)
    pub fn start_debate(ctx: Context<StartDebate>) -> Result<()> {
        let debate = &mut ctx.accounts.debate;
        require!(debate.status == DebateStatus::Pending, ErrorCode::InvalidDebateStatus);

        debate.status = DebateStatus::InProgress;
        debate.started_at = Some(Clock::get()?.unix_timestamp);

        msg!("Debate started");
        Ok(())
    }

    /// Submit round result (called by backend oracle)
    pub fn submit_round_result(
        ctx: Context<SubmitRoundResult>,
        round: u8,
        pro_votes: u32,
        con_votes: u32,
    ) -> Result<()> {
        require!(round >= 1 && round <= 3, ErrorCode::InvalidRound);

        let debate = &mut ctx.accounts.debate;
        require!(debate.status == DebateStatus::InProgress, ErrorCode::InvalidDebateStatus);

        debate.total_pro_votes += pro_votes;
        debate.total_con_votes += con_votes;

        if pro_votes > con_votes {
            debate.pro_rounds_won += 1;
        } else if con_votes > pro_votes {
            debate.con_rounds_won += 1;
        }
        // Tie doesn't award a round win

        msg!("Round {} result: PRO {} - CON {}", round, pro_votes, con_votes);
        Ok(())
    }

    /// Settle a completed debate
    pub fn settle_debate(ctx: Context<SettleDebate>, winner: DebatePosition) -> Result<()> {
        let debate = &mut ctx.accounts.debate;
        require!(debate.status == DebateStatus::InProgress, ErrorCode::InvalidDebateStatus);

        debate.status = DebateStatus::Completed;
        debate.winner = Some(winner);
        debate.completed_at = Some(Clock::get()?.unix_timestamp);

        let platform = &ctx.accounts.platform;
        let escrow = &ctx.accounts.escrow;
        let winner_account = &ctx.accounts.winner;
        let treasury = &ctx.accounts.treasury;

        // Calculate payouts
        let total_pool = debate.stake_amount * 2;
        let platform_fee = (total_pool as u128 * platform.platform_fee_bps as u128 / 10000) as u64;
        let winner_payout = total_pool - platform_fee;

        // Transfer to winner
        **escrow.try_borrow_mut_lamports()? -= winner_payout;
        **winner_account.try_borrow_mut_lamports()? += winner_payout;

        // Transfer fee to treasury
        **escrow.try_borrow_mut_lamports()? -= platform_fee;
        **treasury.try_borrow_mut_lamports()? += platform_fee;

        // Update platform stats
        let platform = &mut ctx.accounts.platform.clone();
        // Note: We'd need a mutable reference here, simplified for example

        msg!(
            "Debate settled. Winner: {:?}, Payout: {} XNT",
            winner,
            winner_payout
        );
        Ok(())
    }

    /// Place a bet on a debate
    pub fn place_bet(ctx: Context<PlaceBet>, side: DebatePosition, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidBetAmount);

        let debate = &ctx.accounts.debate;
        require!(debate.status == DebateStatus::Pending, ErrorCode::BettingClosed);

        let bet = &mut ctx.accounts.bet;
        bet.debate = debate.key();
        bet.bettor = ctx.accounts.bettor.key();
        bet.side = side;
        bet.amount = amount;
        bet.settled = false;
        bet.payout = 0;
        bet.created_at = Clock::get()?.unix_timestamp;
        bet.bump = ctx.bumps.bet;

        // Transfer bet amount to escrow
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bettor.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update user stats
        let user = &mut ctx.accounts.user;
        user.total_wagered += amount;

        msg!("Bet placed: {} XNT on {:?}", amount, side);
        Ok(())
    }

    /// Claim bet winnings
    pub fn claim_bet(ctx: Context<ClaimBet>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let debate = &ctx.accounts.debate;

        require!(debate.status == DebateStatus::Completed, ErrorCode::DebateNotCompleted);
        require!(!bet.settled, ErrorCode::BetAlreadySettled);

        let winner = debate.winner.ok_or(ErrorCode::NoWinner)?;

        bet.settled = true;

        if bet.side == winner {
            // Winner gets their share of the pot
            // Simplified: just return double their bet minus fees
            let platform = &ctx.accounts.platform;
            let payout = (bet.amount as u128 * 2 * (10000 - platform.platform_fee_bps as u128) / 10000) as u64;

            bet.payout = payout;

            // Transfer payout from escrow
            **ctx.accounts.escrow.try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.bettor.try_borrow_mut_lamports()? += payout;

            // Update user stats
            let user = &mut ctx.accounts.user;
            user.total_won += payout;

            msg!("Bet won! Payout: {} XNT", payout);
        } else {
            msg!("Bet lost");
        }

        Ok(())
    }

    /// Update bot ELO after a debate
    pub fn update_bot_elo(
        ctx: Context<UpdateBotElo>,
        new_elo: u32,
        won: bool,
    ) -> Result<()> {
        let bot = &mut ctx.accounts.bot;

        bot.elo = new_elo;
        if won {
            bot.wins += 1;
        } else {
            bot.losses += 1;
        }

        // Update owner stats too
        let user = &mut ctx.accounts.owner;
        if won {
            user.wins += 1;
        } else {
            user.losses += 1;
        }

        msg!("Bot ELO updated to {}", new_elo);
        Ok(())
    }
}

// ============================================================================
// Accounts
// ============================================================================

#[account]
pub struct Platform {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub platform_fee_bps: u16, // Basis points (100 = 1%)
    pub total_debates: u64,
    pub total_users: u64,
    pub total_volume: u64,
    pub bump: u8,
}

#[account]
pub struct User {
    pub wallet: Pubkey,
    pub username: String, // Max 32 chars
    pub elo: u32,
    pub wins: u32,
    pub losses: u32,
    pub bot_count: u8,
    pub total_wagered: u64,
    pub total_won: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Bot {
    pub owner: Pubkey,
    pub name: String, // Max 50 chars
    pub endpoint_hash: [u8; 32],
    pub elo: u32,
    pub wins: u32,
    pub losses: u32,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Topic {
    pub proposer: Pubkey,
    pub text: String, // Max 500 chars
    pub category: String, // Max 32 chars
    pub upvotes: u32,
    pub downvotes: u32,
    pub times_used: u32,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct TopicVoteRecord {
    pub voter: Pubkey,
    pub topic: Pubkey,
    pub upvote: bool,
    pub has_voted: bool,
    pub bump: u8,
}

#[account]
pub struct Debate {
    pub topic: String, // Max 500 chars
    pub pro_bot: Pubkey,
    pub con_bot: Pubkey,
    pub status: DebateStatus,
    pub stake_amount: u64,
    pub total_pro_votes: u32,
    pub total_con_votes: u32,
    pub pro_rounds_won: u8,
    pub con_rounds_won: u8,
    pub winner: Option<DebatePosition>,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub bump: u8,
}

#[account]
pub struct Bet {
    pub debate: Pubkey,
    pub bettor: Pubkey,
    pub side: DebatePosition,
    pub amount: u64,
    pub settled: bool,
    pub payout: u64,
    pub created_at: i64,
    pub bump: u8,
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DebateStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DebatePosition {
    Pro,
    Con,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 2 + 8 + 8 + 8 + 1,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Account<'info, Platform>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury account to receive fees
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub platform: Account<'info, Platform>,

    #[account(
        init,
        payer = wallet,
        space = 8 + 32 + (4 + 32) + 4 + 4 + 4 + 1 + 8 + 8 + 8 + 1,
        seeds = [b"user", wallet.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,

    #[account(mut)]
    pub wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterBot<'info> {
    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + (4 + 50) + 32 + 4 + 4 + 4 + 1 + 8 + 1,
        seeds = [b"bot", owner.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub bot: Account<'info, Bot>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(text: String)]
pub struct ProposeTopic<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + 32 + (4 + 500) + (4 + 32) + 4 + 4 + 4 + 8 + 1,
        seeds = [b"topic", proposer.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub topic: Account<'info, Topic>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteTopic<'info> {
    #[account(mut)]
    pub topic: Account<'info, Topic>,

    #[account(
        init,
        payer = voter,
        space = 8 + 32 + 32 + 1 + 1 + 1,
        seeds = [b"topic_vote", topic.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, TopicVoteRecord>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateDebate<'info> {
    #[account(mut)]
    pub platform: Account<'info, Platform>,

    #[account(
        init,
        payer = pro_owner,
        space = 8 + (4 + 500) + 32 + 32 + 1 + 8 + 4 + 4 + 1 + 1 + 2 + 8 + 9 + 9 + 1,
        seeds = [b"debate", pro_bot.key().as_ref(), con_bot.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub debate: Account<'info, Debate>,

    pub pro_bot: Account<'info, Bot>,
    pub con_bot: Account<'info, Bot>,

    #[account(mut)]
    pub pro_owner: Signer<'info>,

    #[account(mut)]
    pub con_owner: Signer<'info>,

    /// CHECK: Escrow account for holding stakes
    #[account(
        mut,
        seeds = [b"escrow", debate.key().as_ref()],
        bump
    )]
    pub escrow: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartDebate<'info> {
    #[account(mut)]
    pub debate: Account<'info, Debate>,

    /// Only the platform authority can start debates
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        has_one = authority
    )]
    pub platform: Account<'info, Platform>,
}

#[derive(Accounts)]
pub struct SubmitRoundResult<'info> {
    #[account(mut)]
    pub debate: Account<'info, Debate>,

    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        has_one = authority
    )]
    pub platform: Account<'info, Platform>,
}

#[derive(Accounts)]
pub struct SettleDebate<'info> {
    #[account(mut)]
    pub platform: Account<'info, Platform>,

    #[account(mut)]
    pub debate: Account<'info, Debate>,

    /// CHECK: Escrow account
    #[account(mut)]
    pub escrow: AccountInfo<'info>,

    /// CHECK: Winner account
    #[account(mut)]
    pub winner: AccountInfo<'info>,

    /// CHECK: Treasury account
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    pub platform: Account<'info, Platform>,

    pub debate: Account<'info, Debate>,

    #[account(
        mut,
        seeds = [b"user", bettor.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,

    #[account(
        init,
        payer = bettor,
        space = 8 + 32 + 32 + 1 + 8 + 1 + 8 + 8 + 1,
        seeds = [b"bet", debate.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    /// CHECK: Escrow account
    #[account(mut)]
    pub escrow: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimBet<'info> {
    pub platform: Account<'info, Platform>,

    pub debate: Account<'info, Debate>,

    #[account(
        mut,
        seeds = [b"user", bettor.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"bet", debate.key().as_ref(), bettor.key().as_ref()],
        bump = bet.bump,
        has_one = bettor
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    /// CHECK: Escrow account
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdateBotElo<'info> {
    #[account(mut)]
    pub bot: Account<'info, Bot>,

    #[account(
        mut,
        seeds = [b"user", bot.owner.as_ref()],
        bump = owner.bump
    )]
    pub owner: Account<'info, User>,

    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        has_one = authority
    )]
    pub platform: Account<'info, Platform>,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Platform fee cannot exceed 10%")]
    FeeTooHigh,

    #[msg("Username cannot exceed 32 characters")]
    UsernameTooLong,

    #[msg("Bot name cannot exceed 50 characters")]
    BotNameTooLong,

    #[msg("Topic must be between 10 and 500 characters")]
    InvalidTopicLength,

    #[msg("Category cannot exceed 32 characters")]
    CategoryTooLong,

    #[msg("You have already voted on this topic")]
    AlreadyVoted,

    #[msg("Invalid stake amount")]
    InvalidStake,

    #[msg("Invalid debate status for this operation")]
    InvalidDebateStatus,

    #[msg("Invalid round number")]
    InvalidRound,

    #[msg("Debate has not been completed")]
    DebateNotCompleted,

    #[msg("Debate has no winner")]
    NoWinner,

    #[msg("Invalid bet amount")]
    InvalidBetAmount,

    #[msg("Betting is closed for this debate")]
    BettingClosed,

    #[msg("Bet has already been settled")]
    BetAlreadySettled,
}
