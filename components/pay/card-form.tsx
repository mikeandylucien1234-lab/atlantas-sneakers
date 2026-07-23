import { CreditCard } from "lucide-react";

// Stripe-style card form (visual only) shared by /pay and /premium.
export function CardForm() {
  return (
    <div className="mt-4 space-y-3 rounded-xl bg-[#f7f8fa] p-3.5">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[#6b7280]">Card number</span>
        <div className="flex items-center gap-2 rounded-lg border border-[#e4e7eb] bg-white px-3">
          <CreditCard className="h-4 w-4 text-[#9aa3ad]" />
          <input inputMode="numeric" placeholder="1234 5678 9012 3456" className="h-11 flex-1 bg-transparent text-[14px] outline-none" />
        </div>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#6b7280]">Expiry</span>
          <input placeholder="MM / YY" className="h-11 w-full rounded-lg border border-[#e4e7eb] bg-white px-3 text-[14px] outline-none" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#6b7280]">CVC</span>
          <input inputMode="numeric" placeholder="123" className="h-11 w-full rounded-lg border border-[#e4e7eb] bg-white px-3 text-[14px] outline-none" />
        </label>
      </div>
    </div>
  );
}
