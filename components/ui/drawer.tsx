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
};

export function Drawer({ open, onClose, side = "right", title, children, className }: DrawerProps) {
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
          "absolute top-0 h-full w-full max-w-sm bg-white shadow-[0_14px_30px_rgba(16,24,40,.2)] flex flex-col",
          side === "right" ? "right-0 animate-in slide-in-from-right duration-200" : "left-0 animate-in slide-in-from-left duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#eef0f3]">
          {title && <h2 className="text-[18px] font-extrabold text-[#0a0b0d] tracking-[-.01em]">{title}</h2>}
          <button onClick={onClose} className="ml-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f7f8fa] transition-colors cursor-pointer">
            <X className="h-5 w-5 text-[#9aa3ad]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
