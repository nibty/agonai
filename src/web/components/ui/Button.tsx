import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-arena-accent focus:ring-offset-2 focus:ring-offset-arena-bg disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-arena-accent text-white hover:bg-arena-accent/90 shadow-lg shadow-arena-accent/25",
        secondary: "bg-arena-card text-white hover:bg-arena-card/80 border border-arena-border",
        outline: "border border-arena-border bg-transparent text-white hover:bg-arena-border/50",
        ghost: "bg-transparent text-white hover:bg-arena-border/50",
        destructive: "bg-arena-con text-white hover:bg-arena-con/90 shadow-lg shadow-arena-con/25",
        success: "bg-arena-pro text-white hover:bg-arena-pro/90 shadow-lg shadow-arena-pro/25",
        link: "text-arena-accent underline-offset-4 hover:underline",
        // Legacy variants for backwards compatibility
        default:
          "bg-arena-accent text-white hover:bg-arena-accent/90 shadow-lg shadow-arena-accent/25",
        pro: "bg-arena-pro text-white hover:bg-arena-pro/90 shadow-lg shadow-arena-pro/25",
        con: "bg-arena-con text-white hover:bg-arena-con/90 shadow-lg shadow-arena-con/25",
      },
      size: {
        sm: "h-8 px-3 py-1.5 text-sm",
        md: "h-10 px-4 py-2 text-base",
        lg: "h-12 px-6 py-3 text-lg",
        xl: "h-14 px-8 py-4 text-xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button };
