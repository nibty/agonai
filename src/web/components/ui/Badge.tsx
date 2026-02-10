import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Rank, BotTier } from "@/types";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-arena-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-arena-accent/20 text-arena-accent border-transparent",
        secondary: "bg-arena-card text-white border-arena-border hover:bg-arena-card/80",
        outline: "border-arena-border text-gray-400 bg-transparent",
        pro: "bg-arena-pro/20 text-arena-pro border-arena-pro/30",
        con: "bg-arena-con/20 text-arena-con border-arena-con/30",
        success: "bg-arena-pro text-white border-transparent hover:bg-arena-pro/80",
        destructive: "bg-arena-con text-white border-transparent hover:bg-arena-con/80",
        live: "bg-red-500/20 text-red-500 border-transparent animate-pulse",
        // Rank badges
        bronze: "bg-amber-700/20 text-amber-600 border-amber-700/50",
        silver: "bg-gray-400/20 text-gray-300 border-gray-400/50",
        gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
        platinum: "bg-cyan-400/20 text-cyan-300 border-cyan-400/50",
        diamond: "bg-blue-400/20 text-blue-300 border-blue-400/50",
        champion: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";

// Rank badge component
const rankColors: Record<Rank, string> = {
  bronze: "bg-amber-700/20 text-amber-600 border-amber-700/50",
  silver: "bg-gray-400/20 text-gray-300 border-gray-400/50",
  gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  platinum: "bg-cyan-400/20 text-cyan-300 border-cyan-400/50",
  diamond: "bg-blue-400/20 text-blue-300 border-blue-400/50",
  champion: "bg-purple-500/20 text-purple-400 border-purple-500/50",
};

export interface RankBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  rank: Rank;
  size?: "sm" | "md" | "lg";
}

const RankBadge = React.forwardRef<HTMLSpanElement, RankBadgeProps>(
  ({ className, rank, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-0.5 text-[10px]",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border font-semibold capitalize",
          rankColors[rank],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {rank}
      </span>
    );
  }
);
RankBadge.displayName = "RankBadge";

// Tier badge component
const tierColors: Record<BotTier, string> = {
  1: "bg-gray-500/20 text-gray-400",
  2: "bg-green-500/20 text-green-400",
  3: "bg-blue-500/20 text-blue-400",
  4: "bg-purple-500/20 text-purple-400",
  5: "bg-yellow-500/20 text-yellow-400",
};

export interface TierBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier: BotTier;
  size?: "sm" | "md" | "lg";
}

const TierBadge = React.forwardRef<HTMLSpanElement, TierBadgeProps>(
  ({ className, tier, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-0.5 text-[10px]",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-semibold",
          tierColors[tier],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        Tier {tier}
      </span>
    );
  }
);
TierBadge.displayName = "TierBadge";

export { Badge, badgeVariants, RankBadge, TierBadge };
