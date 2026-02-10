import { forwardRef, useState, type HTMLAttributes, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type AvatarRing = "none" | "default" | "accent" | "pro" | "con";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  size?: AvatarSize;
  ring?: AvatarRing;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
  "2xl": "h-24 w-24 text-3xl",
};

const ringClasses: Record<AvatarRing, string> = {
  none: "",
  default: "ring-2 ring-arena-border",
  accent: "ring-2 ring-arena-accent",
  pro: "ring-2 ring-arena-pro",
  con: "ring-2 ring-arena-con",
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", ring = "none", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full",
        sizeClasses[size],
        ringClasses[ring],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Avatar.displayName = "Avatar";

export interface AvatarImageProps extends ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    const [hasError, setHasError] = useState(false);

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

export interface AvatarFallbackProps extends HTMLAttributes<HTMLDivElement> {}

const AvatarFallback = forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-arena-border font-medium text-arena-text-muted",
        className
      )}
      {...props}
    />
  )
);
AvatarFallback.displayName = "AvatarFallback";

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

const BotAvatar = forwardRef<HTMLDivElement, BotAvatarProps>(
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
          {src ? <AvatarImage src={src} alt={alt} /> : <AvatarFallback>{initials}</AvatarFallback>}
          {children}
        </Avatar>
        {tier && (
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
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

export { Avatar, AvatarImage, AvatarFallback, BotAvatar };
