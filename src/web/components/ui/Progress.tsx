import { forwardRef, type HTMLAttributes } from "react";
import { Progress as FlowbiteProgress } from "flowbite-react";
import { cn } from "@/lib/utils";

type ProgressSize = "sm" | "md" | "lg" | "xl";
type ProgressVariant = "default" | "accent" | "pro" | "con" | "gradient";

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  value?: number;
  size?: ProgressSize;
  variant?: ProgressVariant;
  indicatorClassName?: string;
}

const variantToFlowbiteColor = {
  default: "dark",
  accent: "blue",
  pro: "green",
  con: "red",
  gradient: "indigo",
} as const;

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, size = "md", variant = "accent", ...props }, ref) => (
    <FlowbiteProgress
      ref={ref}
      progress={value}
      size={size}
      color={variantToFlowbiteColor[variant]}
      className={cn(
        variant === "gradient" &&
          "[&_div]:bg-gradient-to-r [&_div]:from-arena-accent [&_div]:to-purple-500",
        className
      )}
      {...props}
    />
  )
);
Progress.displayName = "Progress";

// Dual progress for debates (pro vs con)
export interface DualProgressProps extends HTMLAttributes<HTMLDivElement> {
  proValue: number;
  conValue: number;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
  xl: "h-4",
};

const DualProgress = forwardRef<HTMLDivElement, DualProgressProps>(
  ({ className, proValue, conValue, size = "lg", ...props }, ref) => {
    const total = proValue + conValue;
    // Show 50/50 when no votes yet
    const proPercentage = total === 0 ? 50 : (proValue / total) * 100;

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
