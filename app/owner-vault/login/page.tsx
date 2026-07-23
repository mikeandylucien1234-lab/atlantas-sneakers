"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function OwnerVaultLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/owner-vault/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setError("Accès refusé."); setLoading(false); return; }
      router.replace("/owner-vault");
    } catch {
      setError("Accès refusé.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[400px] flex-col justify-center py-10">
      <div className="rounded-3xl border border-[#eef0f3] bg-white p-7 shadow-xl shadow-black/5">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f172a]"><Lock className="h-5 w-5 text-white" /></div>
          <div>
            <div className="text-[17px] font-extrabold tracking-[-.01em] text-[#16181d]">Owner Vault</div>
            <div className="text-[12px] text-[#6b7280]">Private access</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="off" className="h-12 w-full rounded-xl border border-[#e4e7eb] bg-[#f7f8fa] px-4 text-[14px] outline-none focus:border-[#2563eb]" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="off" className="h-12 w-full rounded-xl border border-[#e4e7eb] bg-[#f7f8fa] px-4 text-[14px] outline-none focus:border-[#2563eb]" />
          {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] font-semibold text-[#dc2626]">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] text-[15px] font-bold text-white transition hover:bg-[#1e293b] disabled:opacity-60">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
