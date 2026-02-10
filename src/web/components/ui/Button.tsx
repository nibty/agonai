import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button as FlowbiteButton } from "flowbite-react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "link"
  | "default"
  | "pro"
  | "con";

type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children?: ReactNode;
}

const variantToFlowbiteColor = {
  primary: "primary",
  secondary: "secondary",
  outline: "gray",
  ghost: "dark",
  destructive: "failure",
  success: "success",
  link: "light",
  default: "primary",
  pro: "success",
  con: "failure",
} as const;

const sizeToFlowbiteSize = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
  icon: "md",
} as const;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", asChild: _asChild = false, children, ...props },
    ref
  ) => {
    const isIconSize = size === "icon";
    const flowbiteColor = variantToFlowbiteColor[variant];
    const flowbiteSize = sizeToFlowbiteSize[size];

    return (
      <FlowbiteButton
        ref={ref}
        color={flowbiteColor}
        size={flowbiteSize}
        className={cn(
          isIconSize && "h-10 w-10 !p-0",
          variant === "link" && "!bg-transparent !shadow-none",
          variant === "ghost" && "!shadow-none",
          variant === "outline" && "!shadow-none",
          className
        )}
        {...props}
      >
        {children}
      </FlowbiteButton>
    );
  }
);
Button.displayName = "Button";

export { Button };
