import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type PriceDisplayProps = {
  price: number;
  comparePrice?: number;
  currency?: string;
  size?: "sm" | "lg";
  className?: string;
};

export function PriceDisplay({ price, comparePrice, currency = "€", size = "sm", className }: PriceDisplayProps) {
  const discount = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const isLg = size === "lg";

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span
        className={cn(
          "font-extrabold tracking-[-.01em]",
          isLg ? "text-[30px] text-[#2563eb]" : "text-[15px] text-[#16181d]"
        )}
      >
        {price.toFixed(2)} {currency}
      </span>
      {comparePrice && comparePrice > price && (
        <>
          <span
            className={cn(
              "text-[#9aa3ad] line-through",
              isLg ? "text-[18px]" : "text-[13px]"
            )}
          >
            {comparePrice.toFixed(2)} {currency}
          </span>
          <Badge variant="sale">-{discount}%</Badge>
        </>
      )}
    </div>
  );
}
