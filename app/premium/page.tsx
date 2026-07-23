"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Tag, Truck, ShieldCheck, CreditCard, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardForm } from "@/components/pay/card-form";

type Plan = "monthly" | "annual";
type Method = "card" | "paypal" | "cashapp";

const PLANS = {
  monthly: { label: "Monthly", price: 4.99, per: "/month", note: "Billed monthly · cancel anytime" },
  annual: { label: "Annual", price: 39.99, per: "/year", note: "Save 33% · billed yearly" },
} as const;

const PERKS = [
  { icon: Tag, t: "Exclusive offers", d: "Members-only deals and early drops." },
  { icon: CreditCard, t: "Better prices", d: "Special pricing on your favorite sneakers." },
  { icon: Truck, t: "Free delivery", d: "Free shipping on every order, no minimum." },
  { icon: ShieldCheck, t: "Priority support", d: "Skip the line with dedicated help." },
];

export default function PremiumPage() {
  const [plan, setPlan] = useState<Plan>("annual");
  const [method, setMethod] = useState<Method>("card");
  const [done, setDone] = useState(false);
  const p = PLANS[plan];

  if (done) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#f5c518]/20">
          <Crown className="h-8 w-8 text-[#c99700]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#16181d]">Welcome to Premium! 🎉</h1>
        <p className="mt-2 text-[#6b7280]">Your {p.label.toLowerCase()} membership is active. Enjoy exclusive offers, better prices and free delivery.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-[#2563eb] px-6 py-3 font-bold text-white hover:bg-[#1d4ed8]">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#16181d]"><ArrowLeft className="h-4 w-4" /> Back</Link>

      {/* Hero */}
      <div className="rounded-3xl bg-[linear-gradient(120deg,#0f172a,#1e293b)] px-6 py-8 text-white sm:px-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5c518] px-3 py-1 text-xs font-extrabold text-[#16181d]"><Crown className="h-3.5 w-3.5" /> PREMIUM</span>
        <h1 className="mt-4 text-[28px] font-extrabold leading-tight sm:text-[34px]">Upgrade to Premium and get more, every day</h1>
        <p className="mt-2 max-w-[460px] text-white/75">Exclusive offers, better prices and free delivery on every order.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Perks */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERKS.map((perk) => { const I = perk.icon; return (
            <div key={perk.t} className="rounded-2xl border border-[#eef0f3] bg-white p-4">
              <div className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-[#16181d]"><I className="h-[18px] w-[18px] text-[#f5c518]" /></div>
              <div className="text-[15px] font-extrabold text-[#16181d]">{perk.t}</div>
              <div className="mt-0.5 text-[13px] text-[#6b7280]">{perk.d}</div>
            </div>
          ); })}
        </div>

        {/* Checkout card */}
        <div className="rounded-2xl border border-[#eef0f3] bg-white p-5 shadow-sm">
          {/* Plan toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PLANS) as Plan[]).map((key) => {
              const pl = PLANS[key];
              const active = plan === key;
              return (
                <button key={key} onClick={() => setPlan(key)} className={cn("rounded-xl border-2 p-3 text-left transition", active ? "border-[#2563eb] bg-[#2563eb]/5" : "border-[#eef0f3] hover:border-[#c7ccd4]")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#16181d]">{pl.label}</span>
                    {key === "annual" && <span className="rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-[10px] font-bold text-[#16a34a]">SAVE 33%</span>}
                  </div>
                  <div className="mt-1 text-[20px] font-extrabold text-[#16181d]">${pl.price}<span className="text-[12px] font-semibold text-[#6b7280]">{pl.per}</span></div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-[#6b7280]">{p.note}</p>

          {/* Payment method */}
          <div className="mt-5">
            <div className="mb-2 text-[13px] font-bold text-[#16181d]">Payment method</div>
            <div className="flex flex-col gap-2">
              {([["card", "Credit / Debit card (Stripe)"], ["paypal", "PayPal"], ["cashapp", "Cash App"]] as [Method, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setMethod(m)} className={cn("flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition", method === m ? "border-[#2563eb] bg-[#2563eb]/5" : "border-[#eef0f3] hover:border-[#c7ccd4]")}>
                  <span className={cn("grid h-4 w-4 place-items-center rounded-full border-2", method === m ? "border-[#2563eb]" : "border-[#c7ccd4]")}>{method === m && <span className="h-2 w-2 rounded-full bg-[#2563eb]" />}</span>
                  <span className="text-[14px] font-semibold text-[#16181d]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {method === "card" && <CardForm />}

          <button onClick={() => setDone(true)} className="mt-5 w-full rounded-xl bg-[#f5c518] py-3.5 text-[15px] font-extrabold text-[#16181d] transition hover:brightness-105 active:scale-[.99]">
            Start Premium — ${p.price}{p.per}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#9aa3ad]"><ShieldCheck className="h-3.5 w-3.5" /> Secure payment · cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
