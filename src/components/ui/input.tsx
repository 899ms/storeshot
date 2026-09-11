import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-7 w-full rounded border border-figma-divider bg-figma-panel px-2 py-1 text-[12px] text-figma-text shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-figma-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
