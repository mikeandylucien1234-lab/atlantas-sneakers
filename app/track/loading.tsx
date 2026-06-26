import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-4 mb-10">
      <Skeleton variant="text" className="w-52 h-7 mx-auto mb-2" />
      <Skeleton variant="text" className="w-72 h-4 mx-auto mb-6" />
      <div className="max-w-[500px] mx-auto">
        <Skeleton variant="text" className="w-full h-12 rounded-[12px]" />
      </div>
    </div>
  );
}
