"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ShoppingBag, Gift, Trophy, ArrowLeft, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const EARN = [
  { icon: ShoppingBag, t: "Shop & earn", d: "1 point for every $1 spent." },
  { icon: Star, t: "Write reviews", d: "50 points per verified review." },
  { icon: Sparkles, t: "Refer a friend", d: "500 points per successful referral." },
];

const REWARDS = [
  { pts: 500, label: "$5 off your next order" },
  { pts: 1000, label: "$12 off + free shipping" },
  { pts: 2000, label: "$30 off any purchase" },
  { pts: 3500, label: "Exclusive early-access drop" },
];

const CURRENT = 640; // demo balance
const NEXT_TIER = 1000;

export default function RewardsPage() {
  const [joined, setJoined] = useState(false);
  const pct = Math.min(100, Math.round((CURRENT / NEXT_TIER) * 100));

  return (
    <div className="py-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#16181d]"><ArrowLeft className="h-4 w-4" /> Back</Link>

      {/* Hero */}
      <div className="rounded-3xl bg-[linear-gradient(120deg,#1d4ed8,#2563eb)] px-6 py-8 text-white sm:px-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold"><Trophy className="h-3.5 w-3.5" /> REWARDS</span>
        <h1 className="mt-4 text-[28px] font-extrabold leading-tight sm:text-[34px]">Earn points every time you shop</h1>
        <p className="mt-2 max-w-[440px] text-white/80">Collect, level up and unlock exclusive rewards.</p>
      </div>

      {/* Balance + progress */}
      <div className="mt-6 rounded-2xl border border-[#eef0f3] bg-white p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[13px] font-semibold text-[#6b7280]">Your points</div>
            <div className="text-[34px] font-extrabold leading-none text-[#16181d]">{joined ? CURRENT.toLocaleString() : "0"}</div>
          </div>
          <div className="text-right text-[12px] text-[#6b7280]">{joined ? `${NEXT_TIER - CURRENT} pts to your next reward` : "Join to start earning"}</div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#eef0f3]">
          <div className="h-full rounded-full bg-[#2563eb] transition-all" style={{ width: `${joined ? pct : 0}%` }} />
        </div>
      </div>

      {/* Ways to earn */}
      <h2 className="mt-8 mb-3 text-[17px] font-extrabold text-[#16181d]">Ways to earn</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EARN.map((e) => { const I = e.icon; return (
          <div key={e.t} className="rounded-2xl border border-[#eef0f3] bg-white p-4">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-[#2563eb]/10"><I className="h-5 w-5 text-[#2563eb]" /></div>
            <div className="text-[15px] font-extrabold text-[#16181d]">{e.t}</div>
            <div className="mt-0.5 text-[13px] text-[#6b7280]">{e.d}</div>
          </div>
        ); })}
      </div>

      {/* Redeem */}
      <h2 className="mt-8 mb-3 text-[17px] font-extrabold text-[#16181d]">Redeem your points</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REWARDS.map((r) => {
          const reachable = joined && CURRENT >= r.pts;
          return (
            <div key={r.pts} className="flex items-center gap-3 rounded-2xl border border-[#eef0f3] bg-white p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5c518]/20"><Gift className="h-5 w-5 text-[#c99700]" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[#16181d]">{r.label}</div>
                <div className="text-[12px] text-[#6b7280]">{r.pts.toLocaleString()} points</div>
              </div>
              <button disabled={!reachable} className={cn("rounded-full px-4 py-2 text-[12px] font-bold transition", reachable ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]" : "bg-[#eef0f3] text-[#9aa3ad]")}>
                {reachable ? "Redeem" : "Locked"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Join CTA */}
      {!joined ? (
        <button onClick={() => setJoined(true)} className="mt-8 w-full rounded-xl bg-[#2563eb] py-3.5 text-[15px] font-extrabold text-white transition hover:bg-[#1d4ed8] active:scale-[.99]">
          Join now — it's free
        </button>
      ) : (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-[#16a34a]/10 py-3.5 text-[14px] font-bold text-[#16a34a]">
          <Check className="h-5 w-5" /> You're in the Rewards program!
        </div>
      )}
    </div>
  );
}
