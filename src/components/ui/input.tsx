import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-[#E0DAD2] bg-white px-3 py-1 text-sm text-[#2C2825] shadow-sm transition-colors placeholder:text-[#A39E98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A882]/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
