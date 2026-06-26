"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mt-4 text-center py-16">
      <h2 className="text-[22px] font-extrabold text-[#16181d]">Something went wrong</h2>
      <p className="text-[14px] text-[#5b6472] mt-2">We couldn&apos;t load your account. Please try again.</p>
      <Button size="md" className="mt-5" onClick={() => reset()}>Try Again</Button>
    </div>
  );
}
