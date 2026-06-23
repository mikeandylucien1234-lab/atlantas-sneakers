"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg mx-4 bg-white rounded-[18px] shadow-[0_14px_30px_rgba(16,24,40,.2)] animate-in zoom-in-95 fade-in duration-200 p-[22px]",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-[18px] font-extrabold text-[#0a0b0d] tracking-[-.01em]">{title}</h2>}
          <button onClick={onClose} className="ml-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f7f8fa] transition-colors cursor-pointer">
            <X className="h-5 w-5 text-[#9aa3ad]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
