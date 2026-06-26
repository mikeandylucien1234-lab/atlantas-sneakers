import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-4 mb-6">
      <Skeleton variant="card" className="h-[200px] mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
