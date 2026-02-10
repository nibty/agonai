import { forwardRef, type HTMLAttributes } from "react";
import { Badge as FlowbiteBadge } from "flowbite-react";
import { cn } from "@/lib/utils";
import type { Rank, BotTier } from "@/types";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "pro"
  | "con"
  | "success"
  | "destructive"
  | "live"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "champion";

type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantToFlowbiteColor = {
  default: "info",
  secondary: "gray",
  outline: "dark",
  pro: "success",
  con: "failure",
  success: "success",
  destructive: "failure",
  live: "pink",
  bronze: "warning",
  silver: "gray",
  gold: "warning",
  platinum: "info",
  diamond: "info",
  champion: "purple",
} as const;

const variantCustomClasses: Record<BadgeVariant, string> = {
  default: "",
  secondary: "",
  outline: "!bg-transparent border border-arena-border",
  pro: "!bg-arena-pro/20 !text-arena-pro border border-arena-pro/30",
  con: "!bg-arena-con/20 !text-arena-con border border-arena-con/30",
  success: "!bg-arena-pro !text-white",
  destructive: "!bg-arena-con !text-white",
  live: "!bg-red-500/20 !text-red-500 animate-pulse",
  bronze: "!bg-amber-700/20 !text-amber-600 border border-amber-700/50",
  silver: "!bg-gray-400/20 !text-gray-300 border border-gray-400/50",
  gold: "!bg-yellow-500/20 !text-yellow-400 border border-yellow-500/50",
  platinum: "!bg-cyan-400/20 !text-cyan-300 border border-cyan-400/50",
  diamond: "!bg-blue-400/20 !text-blue-300 border border-blue-400/50",
  champion: "!bg-purple-500/20 !text-purple-400 border border-purple-500/50",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "!px-2 !py-0.5 !text-[10px]",
  md: "!px-2.5 !py-0.5 !text-xs",
  lg: "!px-3 !py-1 !text-sm",
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    return (
      <FlowbiteBadge
        ref={ref}
        color={variantToFlowbiteColor[variant]}
        className={cn(
          variantCustomClasses[variant],
          sizeClasses[size],
          "font-semibold",
          className
        )}
        {...props}
      >
        {children}
      </FlowbiteBadge>
    );
  }
);
Badge.displayName = "Badge";

// Rank badge component
const rankVariants: Record<Rank, BadgeVariant> = {
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "platinum",
  diamond: "diamond",
  champion: "champion",
};

export interface RankBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  rank: Rank;
  size?: "sm" | "md" | "lg";
}

const RankBadge = forwardRef<HTMLSpanElement, RankBadgeProps>(
  ({ className, rank, size = "md", ...props }, ref) => {
    return (
      <Badge ref={ref} variant={rankVariants[rank]} size={size} className={cn("capitalize", className)} {...props}>
        {rank}
      </Badge>
    );
  }
);
RankBadge.displayName = "RankBadge";

// Tier badge component
const tierColors: Record<BotTier, string> = {
  1: "!bg-gray-500/20 !text-gray-400",
  2: "!bg-green-500/20 !text-green-400",
  3: "!bg-blue-500/20 !text-blue-400",
  4: "!bg-purple-500/20 !text-purple-400",
  5: "!bg-yellow-500/20 !text-yellow-400",
};

export interface TierBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tier: BotTier;
  size?: "sm" | "md" | "lg";
}

const TierBadge = forwardRef<HTMLSpanElement, TierBadgeProps>(
  ({ className, tier, size = "md", ...props }, ref) => {
    return (
      <Badge
        ref={ref}
        variant="default"
        size={size}
        className={cn(tierColors[tier], className)}
        {...props}
      >
        Tier {tier}
      </Badge>
    );
  }
);
TierBadge.displayName = "TierBadge";

export { Badge, RankBadge, TierBadge };
