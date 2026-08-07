"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Search, Package, Check, Truck, MapPin, CircleCheckBig, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TrackedOrder = {
  order_number: string;
  status: string;
  fulfillment_status: string | null;
  tracking_number: string | null;
  carrier: string | null;
  tracking_status: string | null;
  tracking_history: { time?: string; date?: string; status?: string; location?: string }[] | null;
  shipped_at: string | null;
  total: number;
  created_at: string;
  items: { quantity: number; price: number; product: { name: string; images: string[] } | null }[];
};

// Build the 5-step timeline from the real order status.
function steps(order: TrackedOrder) {
  const s = String(order.status || "").toLowerCase();
  const cur =
    s === "delivered" ? 4 :
    s === "shipped" || order.tracking_number ? 3 :
    s === "processing" || s === "confirmed" ? 1 : 0;
  const order5 = ["placed", "confirmed", "shipped", "transit", "delivered"];
  const reached = (k: string) => order5.indexOf(k) <= cur;
  return [
    { key: "placed", label: "Order Placed", icon: Package, done: true, current: false },
    { key: "confirmed", label: "Confirmed", icon: Check, done: reached("confirmed"), current: false },
    { key: "shipped", label: "Shipped", icon: Package, done: reached("shipped"), current: false },
    { key: "transit", label: "In Transit", icon: Truck, done: reached("transit"), current: reached("shipped") && s !== "delivered" },
    { key: "delivered", label: "Delivered", icon: MapPin, done: reached("delivered"), current: false },
  ];
}

function TrackInner() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (number: string, mail: string) => {
    setLoading(true); setError(null); setOrder(null);
    try {
      const qs = new URLSearchParams({ number: number.trim(), ...(mail ? { email: mail.trim() } : {}) });
      const res = await fetch(`/api/orders/track?${qs}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || "Order not found");
      else setOrder(data.order);
    } catch { setError("Network error. Please try again."); }
    setLoading(false);
  };

  // Deep link from My Orders: /track?order=AS-...
  useEffect(() => {
    const o = params.get("order");
    if (o) { setOrderNumber(o); lookup(o, ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrack = (e: React.FormEvent) => { e.preventDefault(); if (orderNumber.trim()) lookup(orderNumber, email); };

  return (
    <div className="mt-4 mb-10">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Track Your Order</h1>
      <p className="text-[14px] text-[#5b6472] text-center mt-1">Enter your order number to see the latest status</p>

      <form onSubmit={handleTrack} className="max-w-[560px] mx-auto mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa3ad]" />
          <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. AS-K8F3M2-AB12"
            className="w-full h-[48px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] pl-11 pr-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]" />
        </div>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on the order"
          className="sm:w-[220px] h-[48px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]" />
        <Button type="submit" size="md" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}</Button>
      </form>

      {error && <p className="text-center text-[13px] text-[#ef4444] font-semibold mt-5">{error}</p>}

      {order && (
        <div className="max-w-[700px] mx-auto mt-8 animate-in fade-in duration-300">
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-[#9aa3ad] font-semibold">ORDER NUMBER</p>
                <p className="text-[18px] font-extrabold text-[#16181d]">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#9aa3ad] font-semibold">STATUS</p>
                <p className="text-[16px] font-bold text-[#2563eb] capitalize">{order.status}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
            <h2 className="text-[16px] font-extrabold text-[#16181d] mb-5">Shipment Progress</h2>
            <div className="space-y-0">
              {steps(order).map((step, i, arr) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 transition-colors",
                        step.done ? (step.current ? "bg-[#2563eb] text-white" : "bg-[#16a34a] text-white") : "bg-[#eef0f3] text-[#9aa3ad]")}>
                        {step.done && !step.current ? <CircleCheckBig className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" />}
                      </div>
                      {i < arr.length - 1 && <div className={cn("w-[2px] h-[40px]", step.done ? "bg-[#16a34a]" : "bg-[#eef0f3]")} />}
                    </div>
                    <div className="pb-6">
                      <p className={cn("text-[14px] font-bold", step.done ? "text-[#16181d]" : "text-[#9aa3ad]")}>{step.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {order.tracking_number ? (
            <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
              <h2 className="text-[16px] font-extrabold text-[#16181d] mb-3">Carrier Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] text-[#9aa3ad] font-semibold">CARRIER</p>
                  <p className="text-[14px] font-bold text-[#16181d] mt-0.5">{order.carrier || "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#9aa3ad] font-semibold">TRACKING NUMBER</p>
                  <p className="text-[14px] font-bold text-[#2563eb] mt-0.5 break-all">{order.tracking_number}</p>
                </div>
              </div>
              {Array.isArray(order.tracking_history) && order.tracking_history.length > 0 && (
                <div className="mt-4 border-t border-[#eef0f3] pt-3 space-y-2">
                  {order.tracking_history.slice(0, 8).map((h, idx) => (
                    <div key={idx} className="text-[12px] text-[#5b6472]"><span className="font-semibold text-[#16181d]">{h.status || ""}</span> {h.location ? `· ${h.location}` : ""} {h.time || h.date ? `· ${h.time || h.date}` : ""}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#f7f8fa] border border-[#eef0f3] rounded-[16px] p-5 mb-4 text-center text-[13px] text-[#5b6472]">
              A tracking number will appear here as soon as your order ships.
            </div>
          )}

          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5">
            <h2 className="text-[16px] font-extrabold text-[#16181d] mb-3">Order Items</h2>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-[60px] h-[60px] rounded-[10px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
                    <Image src={item.product?.images?.[0] || "/placeholder.svg"} alt={item.product?.name || ""} fill className="object-cover" sizes="60px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#16181d] line-clamp-1">{item.product?.name || "Item"}</p>
                    <p className="text-[12px] text-[#5b6472]">Qty {item.quantity}</p>
                  </div>
                  <span className="text-[13px] font-bold text-[#16181d] shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>}>
      <TrackInner />
    </Suspense>
  );
}
