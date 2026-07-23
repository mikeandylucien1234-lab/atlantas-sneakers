"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, ArrowLeft, ShieldCheck, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardForm } from "@/components/pay/card-form";

type Method = "mycash" | "natcash" | "paypal" | "cashapp" | "card";

const METHODS: { id: Method; name: string; desc: string; badge: string; color: string }[] = [
  { id: "mycash", name: "My Cash", desc: "Pay with your My Cash balance", badge: "MC", color: "#16a34a" },
  { id: "natcash", name: "Natcash", desc: "Pay with your Natcash balance", badge: "N", color: "#dc2626" },
  { id: "paypal", name: "PayPal", desc: "Pay securely with PayPal", badge: "P", color: "#2563eb" },
  { id: "cashapp", name: "Cash App", desc: "Pay easily with Cash App", badge: "$", color: "#16a34a" },
  { id: "card", name: "Card Payment", desc: "Debit or credit card · via Stripe", badge: "▭", color: "#16181d" },
];

export default function PayPage() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#16a34a]/15"><Check className="h-8 w-8 text-[#16a34a]" /></div>
        <h1 className="text-2xl font-extrabold text-[#16181d]">Payment successful</h1>
        <p className="mt-2 text-[#6b7280]">You paid ${Number(amount || 0).toFixed(2)} with {METHODS.find((m) => m.id === method)?.name}.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-[#2563eb] px-6 py-3 font-bold text-white hover:bg-[#1d4ed8]">Done</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] py-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#16181d]"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <div className="flex items-center gap-2.5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#2563eb]/10"><Wallet className="h-6 w-6 text-[#2563eb]" /></div>
        <div>
          <h1 className="text-[22px] font-extrabold text-[#16181d]">Pay all your accounts in one place</h1>
          <p className="text-[13px] text-[#6b7280]">Fast. Secure. Simple.</p>
        </div>
      </div>

      {/* Amount */}
      <div className="mt-6 rounded-2xl border border-[#eef0f3] bg-white p-5">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#16181d]">Amount to pay</span>
          <div className="flex items-center rounded-xl border border-[#e4e7eb] bg-[#f7f8fa] px-4">
            <span className="text-[22px] font-extrabold text-[#16181d]">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="h-14 flex-1 bg-transparent pl-1 text-[22px] font-extrabold text-[#16181d] outline-none placeholder:text-[#c7ccd4]" />
          </div>
        </label>
      </div>

      {/* Methods */}
      <div className="mt-4">
        <div className="mb-2 px-1 text-[13px] font-bold text-[#16181d]">Choose your preferred payment method</div>
        <div className="overflow-hidden rounded-2xl border border-[#eef0f3] bg-white">
          {METHODS.map((m, i) => {
            const active = method === m.id;
            return (
              <button key={m.id} onClick={() => setMethod(m.id)} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition", i > 0 && "border-t border-[#eef0f3]", active && "bg-[#2563eb]/5")}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-white" style={{ background: m.color }}>{m.badge}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-[#16181d]">{m.name}</span>
                  <span className="block truncate text-[12px] text-[#6b7280]">{m.desc}</span>
                </span>
                {active ? <Check className="h-5 w-5 text-[#2563eb]" /> : <ChevronRight className="h-5 w-5 text-[#c7ccd4]" />}
              </button>
            );
          })}
        </div>
      </div>

      {method === "card" && <CardForm />}

      <button
        disabled={!method || !Number(amount)}
        onClick={() => setDone(true)}
        className="mt-5 w-full rounded-xl bg-[#2563eb] py-3.5 text-[15px] font-extrabold text-white transition enabled:hover:bg-[#1d4ed8] enabled:active:scale-[.99] disabled:opacity-50"
      >
        Pay {Number(amount) ? `$${Number(amount).toFixed(2)}` : "now"}
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#9aa3ad]"><ShieldCheck className="h-3.5 w-3.5" /> Payments are encrypted and secure</p>
    </div>
  );
}
