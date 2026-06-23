import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const variants = {
  new: "bg-[#2563eb] text-white",
  sale: "bg-[#ef4444] text-white",
  hot: "bg-[#f97316] text-white",
  bestseller: "bg-[#ffce3d] text-[#16181d]",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
  color?: string;
};

function Badge({ className, variant = "new", color, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-[11px] py-[5px] text-[13px] font-extrabold rounded-[9px] uppercase tracking-[.04em] leading-none",
        !color && variants[variant],
        className
      )}
      style={color ? { backgroundColor: color, color: "#fff" } : undefined}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, type BadgeProps };
