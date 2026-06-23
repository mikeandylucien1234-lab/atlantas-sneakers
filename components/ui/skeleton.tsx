import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "text" | "card" | "image" | "circle";
  width?: string;
  height?: string;
};

function Skeleton({ className, variant = "text", width, height, ...props }: SkeletonProps) {
  const base = "animate-pulse bg-[#eef0f3]";
  const variantClasses = {
    text: "h-4 rounded-[9px]",
    card: "h-80 rounded-[18px]",
    image: "aspect-square rounded-[14px]",
    circle: "rounded-full",
  };

  return (
    <div
      className={cn(base, variantClasses[variant], className)}
      style={{ width, height }}
      {...props}
    />
  );
}

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-[14px] border border-[#eef0f3] overflow-hidden">
      <Skeleton variant="image" className="rounded-none" />
      <div className="p-[13px] space-y-2.5">
        <Skeleton variant="text" className="w-2/5 h-3" />
        <Skeleton variant="text" className="w-4/5 h-[14px]" />
        <Skeleton variant="text" className="w-1/3 h-[15px]" />
      </div>
    </div>
  );
}

export { Skeleton, ProductCardSkeleton, type SkeletonProps };
