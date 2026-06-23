import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type SpinnerProps = {
  size?: number;
  className?: string;
};

export function Spinner({ size = 24, className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-[#2563eb]", className)}
      style={{ width: size, height: size }}
    />
  );
}
