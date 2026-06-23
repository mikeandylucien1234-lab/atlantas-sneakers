"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingProps = {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
};

export function Rating({ value, max = 5, onChange, size = 19, className }: RatingProps) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;

  return (
    <div className={cn("inline-flex items-center gap-[2px]", className)}>
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        const filled = star <= (hover || value);
        return (
          <Star
            key={i}
            className={cn(
              "transition-colors duration-150",
              filled ? "fill-[#f59e0b] text-[#f59e0b]" : "fill-none text-[#e4e7eb]",
              interactive && "cursor-pointer"
            )}
            style={{ width: size, height: size }}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
          />
        );
      })}
    </div>
  );
}
