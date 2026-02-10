import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-lg",
        xl: "h-20 w-20 text-2xl",
        "2xl": "h-24 w-24 text-3xl",
      },
      ring: {
        none: "",
        default: "ring-2 ring-arena-border",
        accent: "ring-2 ring-arena-accent",
        pro: "ring-2 ring-arena-pro",
        con: "ring-2 ring-arena-con",
      },
    },
    defaultVariants: {
      size: "md",
      ring: "none",
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, ring, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(avatarVariants({ size, ring }), className)}
      {...props}
    />
  )
);
Avatar.displayName = "Avatar";

export interface AvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (hasError) {
      return null;
    }

    return (
      <img
        ref={ref}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage";

export interface AvatarFallbackProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-arena-border text-gray-400 font-medium",
        className
      )}
      {...props}
    />
  )
);
AvatarFallback.displayName = "AvatarFallback";

// Helper function to generate initials from a name
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  return (firstWord.charAt(0) + (lastWord?.charAt(0) ?? "")).toUpperCase();
}

// Helper function to generate a consistent color from a string
export function getAvatarColor(str: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index] ?? "bg-gray-500";
}

// Bot avatar with tier indicator
const tierColors = {
  1: "ring-gray-500",
  2: "ring-green-500",
  3: "ring-blue-500",
  4: "ring-purple-500",
  5: "ring-yellow-500",
};

const tierBgColors = {
  1: "bg-gray-500",
  2: "bg-green-500",
  3: "bg-blue-500",
  4: "bg-purple-500",
  5: "bg-yellow-500",
};

export interface BotAvatarProps extends Omit<AvatarProps, "ring"> {
  tier?: 1 | 2 | 3 | 4 | 5;
  src?: string;
  alt?: string;
  fallback?: string;
}

const BotAvatar = React.forwardRef<HTMLDivElement, BotAvatarProps>(
  ({ tier, className, size = "md", src, alt, fallback, children, ...props }, ref) => {
    const initials = fallback || alt?.charAt(0).toUpperCase() || "?";

    return (
      <div className="relative inline-block">
        <Avatar
          ref={ref}
          size={size}
          className={cn(tier && `ring-2 ${tierColors[tier]}`, className)}
          {...props}
        >
          {src ? (
            <AvatarImage src={src} alt={alt} />
          ) : (
            <AvatarFallback>{initials}</AvatarFallback>
          )}
          {children}
        </Avatar>
        {tier && (
          <span
            className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
              tierBgColors[tier]
            )}
          >
            {tier}
          </span>
        )}
      </div>
    );
  }
);
BotAvatar.displayName = "BotAvatar";

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  BotAvatar,
  avatarVariants,
};
