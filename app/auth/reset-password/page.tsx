"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/auth/login"), 3000);
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-300px)] py-10">
        <div className="w-full max-w-[420px] bg-white border border-[#eef0f3] rounded-[18px] p-7 text-center">
          <div className="w-[64px] h-[64px] rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-[28px] h-[28px] text-[#16a34a]" />
          </div>
          <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em]">Password Updated</h1>
          <p className="text-[14px] text-[#5b6472] mt-2 leading-[1.6]">
            Your password has been reset successfully. Redirecting to login...
          </p>
          <Link href="/auth/login">
            <Button variant="outline" size="lg" className="w-full mt-6">
              <ArrowLeft className="w-[16px] h-[16px]" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-300px)] py-10">
      <div className="w-full max-w-[420px] bg-white border border-[#eef0f3] rounded-[18px] p-7">
        <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Reset Password</h1>
        <p className="text-[14px] text-[#5b6472] text-center mt-1">Enter your new password</p>

        {!ready && (
          <p className="text-[13px] text-[#ca8a04] bg-[#fef9c3] rounded-[10px] px-4 py-3 mt-4">
            Verifying your reset link... If this persists, request a new reset link.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 pr-11 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa3ad] hover:text-[#16181d] transition-colors cursor-pointer"
              >
                {showPwd ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                className="w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 pr-11 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa3ad] hover:text-[#16181d] transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          {error && <p className="text-[13px] font-medium text-[#ef4444]">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!ready}>
            Update Password
          </Button>
        </form>

        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-2 text-[13px] font-bold text-[#2563eb] hover:underline mt-5"
        >
          <ArrowLeft className="w-[14px] h-[14px]" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
