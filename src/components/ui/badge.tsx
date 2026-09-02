import * as React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#2C2825] text-[#FAF8F5]",
    secondary: "bg-[#F0EBE3] text-[#6B6560]",
    success: "bg-[#E8F0E8] text-[#3D5C3D]",
    warning: "bg-[#FDF6E8] text-[#8B6914]",
    danger: "bg-[#FCEAEA] text-[#8B3A3A]",
    outline: "border border-[#E0DAD2] text-[#6B6560] bg-transparent",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
