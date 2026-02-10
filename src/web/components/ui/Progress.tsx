import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type HTMLAttributes,
} from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva("relative w-full overflow-hidden rounded-full bg-arena-border", {
  variants: {
    size: {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
      xl: "h-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const indicatorVariants = cva("h-full w-full flex-1 transition-all duration-300 ease-in-out", {
  variants: {
    variant: {
      default: "bg-gray-400",
      accent: "bg-arena-accent",
      pro: "bg-arena-pro",
      con: "bg-arena-con",
      gradient: "bg-gradient-to-r from-arena-accent to-purple-500",
    },
  },
  defaultVariants: {
    variant: "accent",
  },
});

export interface ProgressProps
  extends
    ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {
  indicatorClassName?: string;
}

const Progress = forwardRef<ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, size, variant, indicatorClassName, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(indicatorVariants({ variant }), indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
);
Progress.displayName = ProgressPrimitive.Root.displayName;

// Dual progress for debates (pro vs con)
export interface DualProgressProps extends HTMLAttributes<HTMLDivElement> {
  proValue: number;
  conValue: number;
  size?: "sm" | "md" | "lg" | "xl";
}

const DualProgress = forwardRef<HTMLDivElement, DualProgressProps>(
  ({ className, proValue, conValue, size = "lg", ...props }, ref) => {
    const total = proValue + conValue;
    // Show 50/50 when no votes yet
    const proPercentage = total === 0 ? 50 : (proValue / total) * 100;

    const sizeClasses = {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
      xl: "h-4",
    };

    return (
      <div
        ref={ref}
        className={cn("flex w-full overflow-hidden rounded-full", sizeClasses[size], className)}
        {...props}
      >
        <div
          className="bg-arena-pro/50 transition-all duration-300"
          style={{ width: `${proPercentage}%` }}
        />
        <div
          className="bg-arena-con/50 transition-all duration-300"
          style={{ width: `${100 - proPercentage}%` }}
        />
      </div>
    );
  }
);
DualProgress.displayName = "DualProgress";

export { Progress, DualProgress };
