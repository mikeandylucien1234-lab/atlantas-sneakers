"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, RotateCcw, ArrowLeft, CreditCard, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function FailedContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "Your payment could not be processed. Please try again.";
  const orderId = params.get("order") ?? "";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-[480px] w-full text-center">
        <div className="w-[88px] h-[88px] rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
          <XCircle className="w-[44px] h-[44px] text-[#ef4444]" />
        </div>
        <h1 className="text-[28px] font-extrabold text-[#16181d] tracking-[-.02em]">Payment Failed</h1>
        <p className="text-[14px] text-[#5b6472] mt-2 max-w-[360px] mx-auto">{reason}</p>

        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[14px] p-4 mt-6">
          <p className="text-[13px] text-[#ef4444] font-semibold">
            No charges have been made to your account. You can safely retry your payment.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <Link href={orderId ? `/checkout?retry=${orderId}` : "/checkout"}>
            <Button size="lg" className="w-full gap-2">
              <RotateCcw className="w-4 h-4" /> Retry Payment
            </Button>
          </Link>
          <Link href="/checkout">
            <Button variant="outline" size="lg" className="w-full gap-2">
              <CreditCard className="w-4 h-4" /> Choose Another Method
            </Button>
          </Link>
          <div className="flex gap-3">
            <Link href="/checkout" className="flex-1">
              <Button variant="outline" size="lg" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Checkout
              </Button>
            </Link>
            <Link href="/about" className="flex-1">
              <Button variant="outline" size="lg" className="w-full gap-2">
                <MessageSquare className="w-4 h-4" /> Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#ef4444] border-t-transparent rounded-full animate-spin" /></div>}>
      <FailedContent />
    </Suspense>
  );
}
