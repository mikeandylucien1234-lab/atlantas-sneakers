"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Search, Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "text" | "search" | "password";
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "text", error, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = variant === "password";
    const isSearch = variant === "search";

    return (
      <div className="relative w-full">
        {isSearch && (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[#9aa3ad]" />
        )}
        <input
          ref={ref}
          type={isPassword ? (showPassword ? "text" : "password") : type}
          className={cn(
            "w-full h-[46px] rounded-[999px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none transition-colors duration-150 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20",
            isSearch && "pl-11",
            isPassword && "pr-11",
            error && "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa3ad] hover:text-[#16181d] transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        )}
        {error && <p className="mt-1.5 text-[12px] font-medium text-[#ef4444]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input, type InputProps };
