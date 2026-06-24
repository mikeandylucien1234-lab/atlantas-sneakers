"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-300px)] py-10">
      <div className="w-full max-w-[420px] bg-white border border-[#eef0f3] rounded-[18px] p-7">
        {sent ? (
          <div className="text-center">
            <div className="w-[64px] h-[64px] rounded-full bg-[#eff6ff] flex items-center justify-center mx-auto mb-4">
              <Mail className="w-[28px] h-[28px] text-[#2563eb]" />
            </div>
            <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em]">Check your email</h1>
            <p className="text-[14px] text-[#5b6472] mt-2 leading-[1.6]">
              We&apos;ve sent a password reset link to <span className="font-semibold text-[#16181d]">{email}</span>
            </p>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full mt-6">
                <ArrowLeft className="w-[16px] h-[16px]" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Forgot Password</h1>
            <p className="text-[14px] text-[#5b6472] text-center mt-1 leading-[1.6]">
              Enter your email and we&apos;ll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]"
                />
              </div>

              {error && <p className="text-[13px] font-medium text-[#ef4444]">{error}</p>}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Send Reset Link
              </Button>
            </form>

            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-[13px] font-bold text-[#2563eb] hover:underline mt-5"
            >
              <ArrowLeft className="w-[14px] h-[14px]" />
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
