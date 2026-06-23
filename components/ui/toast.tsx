"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "info" | "warn";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

const icons = { success: CheckCircle, info: Info, warn: AlertTriangle };

const colors = {
  success: "bg-white border-[#16a34a] text-[#16a34a]",
  info: "bg-white border-[#2563eb] text-[#2563eb]",
  warn: "bg-white border-[#f59e0b] text-[#f59e0b]",
};

let addToastGlobal: ((type: ToastType, message: string) => void) | null = null;

export function toast(type: ToastType, message: string) {
  addToastGlobal?.(type, message);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 w-[340px]">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-[14px] border-[1.5px] shadow-[0_12px_26px_rgba(16,24,40,.12)] animate-in slide-in-from-right duration-200",
                colors[t.type]
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <p className="text-[14px] font-semibold text-[#16181d] flex-1">{t.message}</p>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 cursor-pointer text-[#9aa3ad] hover:text-[#16181d]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
