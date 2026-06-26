"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Package, Check, Truck, MapPin, CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const timelineSteps = [
  { label: "Order Placed", date: "Jun 20, 2026 · 10:30 AM", icon: Package, done: true },
  { label: "Confirmed", date: "Jun 20, 2026 · 11:15 AM", icon: Check, done: true },
  { label: "Shipped", date: "Jun 21, 2026 · 2:00 PM", icon: Package, done: true },
  { label: "In Transit", date: "Jun 23, 2026 · 8:45 AM", icon: Truck, done: true, current: true },
  { label: "Delivered", date: "Estimated Jun 25, 2026", icon: MapPin, done: false },
];

const mockItems = [
  { name: "Air Jordan 1 Retro High OG", size: "10", color: "Chicago", qty: 1, price: 159.99, image: "/placeholder.svg" },
  { name: "Nike Dunk Low Retro", size: "9.5", color: "Panda", qty: 1, price: 109.99, image: "/placeholder.svg" },
];

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [tracking, setTracking] = useState(false);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumber.trim()) setTracking(true);
  };

  return (
    <div className="mt-4 mb-10">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Track Your Order</h1>
      <p className="text-[14px] text-[#5b6472] text-center mt-1">Enter your order number to see the latest status</p>

      <form onSubmit={handleTrack} className="max-w-[500px] mx-auto mt-6 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa3ad]" />
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. ATL-K8F3M2"
            className="w-full h-[48px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] pl-11 pr-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]"
          />
        </div>
        <Button type="submit" size="md">Track</Button>
      </form>

      {tracking && (
        <div className="max-w-[700px] mx-auto mt-8 animate-in fade-in duration-300">
          {/* Order header */}
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-[#9aa3ad] font-semibold">ORDER NUMBER</p>
                <p className="text-[18px] font-extrabold text-[#16181d]">{orderNumber.toUpperCase() || "ATL-K8F3M2"}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#9aa3ad] font-semibold">ESTIMATED DELIVERY</p>
                <p className="text-[16px] font-bold text-[#2563eb]">Jun 25, 2026</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
            <h2 className="text-[16px] font-extrabold text-[#16181d] mb-5">Shipment Progress</h2>
            <div className="space-y-0">
              {timelineSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 transition-colors",
                        step.done
                          ? step.current ? "bg-[#2563eb] text-white" : "bg-[#16a34a] text-white"
                          : "bg-[#eef0f3] text-[#9aa3ad]"
                      )}>
                        {step.done && !step.current ? (
                          <CircleCheckBig className="w-[18px] h-[18px]" />
                        ) : (
                          <Icon className="w-[18px] h-[18px]" />
                        )}
                      </div>
                      {i < timelineSteps.length - 1 && (
                        <div className={cn("w-[2px] h-[40px]", step.done ? "bg-[#16a34a]" : "bg-[#eef0f3]")} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={cn("text-[14px] font-bold", step.done ? "text-[#16181d]" : "text-[#9aa3ad]")}>{step.label}</p>
                      <p className="text-[12px] text-[#5b6472] mt-0.5">{step.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carrier info */}
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 mb-4">
            <h2 className="text-[16px] font-extrabold text-[#16181d] mb-3">Carrier Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] text-[#9aa3ad] font-semibold">CARRIER</p>
                <p className="text-[14px] font-bold text-[#16181d] mt-0.5">FedEx</p>
              </div>
              <div>
                <p className="text-[12px] text-[#9aa3ad] font-semibold">TRACKING NUMBER</p>
                <p className="text-[14px] font-bold text-[#2563eb] mt-0.5 cursor-pointer hover:underline">7942 0012 3456 8</p>
              </div>
            </div>
          </div>

          {/* Order items */}
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5">
            <h2 className="text-[16px] font-extrabold text-[#16181d] mb-3">Order Items</h2>
            <div className="space-y-3">
              {mockItems.map((item) => (
                <div key={item.name} className="flex gap-3">
                  <div className="w-[60px] h-[60px] rounded-[10px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="60px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#16181d] line-clamp-1">{item.name}</p>
                    <p className="text-[12px] text-[#5b6472]">Size {item.size} · {item.color} · Qty {item.qty}</p>
                  </div>
                  <span className="text-[13px] font-bold text-[#16181d] shrink-0">${item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
