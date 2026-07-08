"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleCheckBig, Download, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "—";
  const transactionId = params.get("txn") ?? "—";
  const amount = params.get("amount") ?? "0.00";
  const currency = params.get("currency") ?? "USD";
  const gateway = params.get("gateway") ?? "stripe";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const gatewayLabel: Record<string, string> = {
    stripe: "Credit/Debit Card",
    moncash: "MonCash",
    natcash: "NatCash",
    cod: "Cash on Delivery",
    bank_transfer: "Bank Transfer",
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-[520px] w-full text-center">
        <div className="w-[88px] h-[88px] rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
          <CircleCheckBig className="w-[44px] h-[44px] text-[#16a34a]" />
        </div>
        <h1 className="text-[28px] font-extrabold text-[#16181d] tracking-[-.02em]">Payment Successful</h1>
        <p className="text-[14px] text-[#5b6472] mt-2">Thank you for your purchase! Your order has been confirmed.</p>

        <div className="bg-white border border-[#eef0f3] rounded-[16px] p-6 mt-6 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-[13px] text-[#5b6472]">Order Number</span>
            <span className="text-[14px] font-bold text-[#2563eb]">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-[#5b6472]">Transaction ID</span>
            <span className="text-[13px] font-semibold text-[#16181d]">{transactionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-[#5b6472]">Amount</span>
            <span className="text-[16px] font-extrabold text-[#16181d]">{currency} {amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-[#5b6472]">Payment Method</span>
            <span className="text-[13px] font-semibold text-[#16181d]">{gatewayLabel[gateway] ?? gateway}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-[#5b6472]">Date</span>
            <span className="text-[13px] font-semibold text-[#16181d]">{date}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            variant="outline" size="lg" className="flex-1 gap-2"
            onClick={() => window.open(`/api/invoice?order=${encodeURIComponent(orderNumber)}`, "_blank")}
            disabled={orderNumber === "—"}
          >
            <Download className="w-4 h-4" /> Download Invoice
          </Button>
          <Link href={`/track?order=${orderNumber}`} className="flex-1">
            <Button variant="outline" size="lg" className="w-full gap-2">
              <MapPin className="w-4 h-4" /> Track Order
            </Button>
          </Link>
          <Link href="/shop" className="flex-1">
            <Button size="lg" className="w-full gap-2">
              <ShoppingBag className="w-4 h-4" /> Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
