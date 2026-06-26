import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-4">
      <Skeleton variant="text" className="w-40 h-7 mb-5 mx-auto" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 max-w-[960px] mx-auto">
        <div className="bg-white rounded-[16px] border border-[#eef0f3] p-6 space-y-4">
          <Skeleton variant="text" className="w-1/3 h-5" />
          <Skeleton variant="text" className="w-full h-12" />
          <Skeleton variant="text" className="w-full h-12" />
          <Skeleton variant="text" className="w-full h-12" />
        </div>
        <Skeleton variant="card" className="h-[280px]" />
      </div>
    </div>
  );
}
