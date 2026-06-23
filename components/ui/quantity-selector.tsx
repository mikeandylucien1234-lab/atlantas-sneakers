"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
};

export function QuantitySelector({ value, onChange, min = 1, max = 99, className }: QuantitySelectorProps) {
  return (
    <div className={cn("inline-flex items-center border-[1.5px] border-[#e4e7eb] rounded-[12px] overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        className="w-[44px] h-[48px] flex items-center justify-center text-[#5b6472] hover:bg-[#f7f8fa] transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        <Minus className="h-[18px] w-[18px]" />
      </button>
      <span className="min-w-[40px] text-center text-[16px] font-extrabold text-[#16181d] tabular-nums select-none">
        {value}
      </span>
      <button
        type="button"
        onClick={() => value < max && onChange(value + 1)}
        disabled={value >= max}
        className="w-[44px] h-[48px] flex items-center justify-center text-[#5b6472] hover:bg-[#f7f8fa] transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
