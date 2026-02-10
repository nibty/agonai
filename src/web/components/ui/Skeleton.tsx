import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva("animate-pulse rounded-md bg-arena-border/50", {
  variants: {
    variant: {
      default: "",
      text: "h-4 w-full",
      title: "h-6 w-3/4",
      avatar: "h-10 w-10 rounded-full",
      button: "h-10 w-24",
      card: "h-32 w-full",
      image: "aspect-video w-full",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(skeletonVariants({ variant }), className)} {...props} />;
  }
);
Skeleton.displayName = "Skeleton";

// Pre-composed skeleton components for common use cases
const SkeletonText = React.forwardRef<HTMLDivElement, Omit<SkeletonProps, "variant">>(
  ({ className, ...props }, ref) => (
    <Skeleton ref={ref} variant="text" className={className} {...props} />
  )
);
SkeletonText.displayName = "SkeletonText";

const SkeletonTitle = React.forwardRef<HTMLDivElement, Omit<SkeletonProps, "variant">>(
  ({ className, ...props }, ref) => (
    <Skeleton ref={ref} variant="title" className={className} {...props} />
  )
);
SkeletonTitle.displayName = "SkeletonTitle";

const SkeletonAvatar = React.forwardRef<HTMLDivElement, Omit<SkeletonProps, "variant">>(
  ({ className, ...props }, ref) => (
    <Skeleton ref={ref} variant="avatar" className={className} {...props} />
  )
);
SkeletonAvatar.displayName = "SkeletonAvatar";

const SkeletonButton = React.forwardRef<HTMLDivElement, Omit<SkeletonProps, "variant">>(
  ({ className, ...props }, ref) => (
    <Skeleton ref={ref} variant="button" className={className} {...props} />
  )
);
SkeletonButton.displayName = "SkeletonButton";

const SkeletonCard = React.forwardRef<HTMLDivElement, Omit<SkeletonProps, "variant">>(
  ({ className, ...props }, ref) => (
    <Skeleton ref={ref} variant="card" className={className} {...props} />
  )
);
SkeletonCard.displayName = "SkeletonCard";

// Skeleton for a card with content
export interface SkeletonCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  showAvatar?: boolean;
  showTitle?: boolean;
}

const SkeletonCardContent = React.forwardRef<HTMLDivElement, SkeletonCardContentProps>(
  ({ className, lines = 3, showAvatar = true, showTitle = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border border-arena-border bg-arena-card p-6", className)}
      {...props}
    >
      {showAvatar && (
        <div className="mb-4 flex items-center gap-3">
          <SkeletonAvatar />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}
      {showTitle && <SkeletonTitle className="mb-4" />}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText key={i} className={i === lines - 1 ? "w-4/5" : undefined} />
        ))}
      </div>
    </div>
  )
);
SkeletonCardContent.displayName = "SkeletonCardContent";

export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonCardContent,
};
