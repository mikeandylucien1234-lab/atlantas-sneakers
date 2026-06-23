"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-[#2563eb] text-white shadow-[0_10px_22px_rgba(37,99,235,.3)] hover:brightness-105 active:scale-[.98]",
  secondary:
    "border-[1.5px] border-[#2563eb] bg-white text-[#2563eb] hover:bg-[#2563eb] hover:text-white active:scale-[.98]",
  ghost:
    "bg-transparent text-[#16181d] hover:bg-[#f7f8fa] active:scale-[.98]",
  outline:
    "border-[1.5px] border-[#e4e7eb] bg-white text-[#16181d] hover:border-[#2563eb] hover:text-[#2563eb] active:scale-[.98]",
  danger:
    "bg-[#ef4444] text-white shadow-[0_10px_22px_rgba(239,68,68,.3)] hover:brightness-105 active:scale-[.98]",
} as const;

const sizes = {
  sm: "h-10 px-4 text-[13px]",
  md: "h-[48px] px-6 text-[14.5px]",
  lg: "h-[54px] px-8 text-[15px]",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "lg", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold rounded-[13px] transition-[filter,transform,background] duration-150 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);

Button.displayName = "Button";
export { Button, type ButtonProps };
