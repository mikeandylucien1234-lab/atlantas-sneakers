"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  width?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const WIDTH_MAP = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" };

export function Drawer({ open, onClose, side = "right", title, children, className, dark, width = "sm" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={onClose} />
      <div
        className={cn(
          "absolute top-0 h-full w-full shadow-[0_14px_30px_rgba(16,24,40,.2)] flex flex-col",
          WIDTH_MAP[width],
          dark ? "bg-[#171c24]" : "bg-white",
          side === "right" ? "right-0 animate-in slide-in-from-right duration-200" : "left-0 animate-in slide-in-from-left duration-200",
          className
        )}
      >
        <div className={cn("flex items-center justify-between p-4 border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
          {title && <h2 className={cn("text-[18px] font-extrabold tracking-[-.01em]", dark ? "text-[#e7ebf0]" : "text-[#0a0b0d]")}>{title}</h2>}
          <button onClick={onClose} className={cn("ml-auto h-8 w-8 flex items-center justify-center rounded-full transition-colors cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f7f8fa]")}>
            <X className={cn("h-5 w-5", dark ? "text-[#8b95a3]" : "text-[#9aa3ad]")} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
