"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Suspense } from "react";

function ProcessingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const gateway = params.get("gateway") ?? "moncash";
  const paymentId = params.get("paymentId") ?? "";
  const orderId = params.get("order") ?? "";
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!paymentId) return;
    const interval = setInterval(async () => {
      try {
        const endpoint = gateway === "moncash"
          ? `/api/payments/moncash/verify?transactionId=${paymentId}`
          : `/api/payments/natcash/verify?reference=${paymentId}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        const txn = data.transaction;
        if (txn?.payment?.message === "successful" || txn?.status === "completed") {
          router.replace(`/payment/success?order=${orderId}&gateway=${gateway}&txn=${paymentId}`);
        }
      } catch {}
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      router.replace(`/payment/failed?reason=Payment+timed+out.+Please+check+your+${gateway}+app.&order=${orderId}`);
    }, 300_000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [paymentId, gateway, orderId, router]);

  const gatewayLabel: Record<string, string> = {
    moncash: "MonCash",
    natcash: "NatCash",
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-[420px] w-full text-center">
        <div className="w-[88px] h-[88px] rounded-full bg-[#eff6ff] flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-[40px] h-[40px] text-[#2563eb] animate-spin" />
        </div>
        <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em]">Processing Your Payment</h1>
        <p className="text-[14px] text-[#5b6472] mt-2">
          Please complete the payment in your <span className="font-semibold text-[#16181d]">{gatewayLabel[gateway] ?? gateway}</span> app.
        </p>

        <div className="bg-[#f7f8fa] rounded-[14px] p-5 mt-6 space-y-3">
          <div className="flex justify-center">
            <span className="text-[32px] font-extrabold text-[#16181d] tabular-nums">
              {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <p className="text-[12px] text-[#5b6472]">Waiting for confirmation...</p>
          <div className="w-full h-1.5 bg-[#eef0f3] rounded-full overflow-hidden">
            <div className="h-full bg-[#2563eb] rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 justify-center">
          <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
          <span className="text-[12px] text-[#5b6472] font-semibold">Do not close this page</span>
        </div>
      </div>
    </div>
  );
}

export default function PaymentProcessingPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" /></div>}>
      <ProcessingContent />
    </Suspense>
  );
}
