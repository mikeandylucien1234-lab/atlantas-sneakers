"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mt-4 text-center py-16">
      <h2 className="text-[22px] font-extrabold text-[#16181d]">Checkout Error</h2>
      <p className="text-[14px] text-[#5b6472] mt-2">Something went wrong during checkout. Your payment was not processed.</p>
      <div className="flex items-center justify-center gap-3 mt-5">
        <Button size="md" onClick={() => reset()}>Try Again</Button>
        <Link href="/cart">
          <Button size="md" variant="outline">Back to Cart</Button>
        </Link>
      </div>
    </div>
  );
}
