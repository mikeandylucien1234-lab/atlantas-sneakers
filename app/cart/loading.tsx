import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-4">
      <Skeleton variant="text" className="w-40 h-7 mb-5" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[14px] border border-[#eef0f3] p-4 flex gap-4">
              <Skeleton variant="image" className="w-[100px] h-[100px] shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-3/5 h-4" />
                <Skeleton variant="text" className="w-2/5 h-3" />
                <Skeleton variant="text" className="w-1/4 h-5" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton variant="card" className="h-[300px]" />
      </div>
    </div>
  );
}
