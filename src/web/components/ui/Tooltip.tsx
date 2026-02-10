import * as React from "react";
import { Tooltip as FlowbiteTooltip } from "flowbite-react";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
TooltipProvider.displayName = "TooltipProvider";

interface TooltipContextValue {
  content: React.ReactNode;
  setContent: (content: React.ReactNode) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

interface TooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
}

const Tooltip = ({ children }: TooltipProps) => {
  const [content, setContent] = React.useState<React.ReactNode>(null);

  return (
    <TooltipContext.Provider value={{ content, setContent }}>
      {children}
    </TooltipContext.Provider>
  );
};
Tooltip.displayName = "Tooltip";

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} {...props}>
        {children}
      </span>
    );
  }
);
TooltipTrigger.displayName = "TooltipTrigger";

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className: _className, sideOffset: _sideOffset = 4, side: _side = "top", children }) => {
    const context = React.useContext(TooltipContext);

    React.useEffect(() => {
      context?.setContent(children);
    }, [children, context]);

    return null;
  }
);
TooltipContent.displayName = "TooltipContent";

const TooltipArrow = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("fill-arena-card", className)} {...props} />
  )
);
TooltipArrow.displayName = "TooltipArrow";

// Simple tooltip wrapper that combines trigger and content
interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "right" | "bottom" | "left";
}

const SimpleTooltip = ({ content, children, placement = "top" }: SimpleTooltipProps) => {
  return (
    <FlowbiteTooltip content={content} placement={placement}>
      {children}
    </FlowbiteTooltip>
  );
};
SimpleTooltip.displayName = "SimpleTooltip";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, TooltipProvider, SimpleTooltip };
