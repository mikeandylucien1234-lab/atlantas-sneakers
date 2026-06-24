"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the terms and conditions");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const inputCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]";

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-300px)] py-10">
      <div className="w-full max-w-[420px] bg-white border border-[#eef0f3] rounded-[18px] p-7">
        <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Create Account</h1>
        <p className="text-[14px] text-[#5b6472] text-center mt-1">Join Atlanta Sneakers today</p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required className={inputCls} />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className={inputCls} />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa3ad] hover:text-[#16181d] transition-colors cursor-pointer">
                {showPwd ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa3ad] hover:text-[#16181d] transition-colors cursor-pointer">
                {showConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] border-[#e4e7eb] accent-[#2563eb] mt-0.5 cursor-pointer"
            />
            <span className="text-[13px] text-[#5b6472]">
              I agree to the <span className="font-semibold text-[#2563eb]">Terms of Service</span> and <span className="font-semibold text-[#2563eb]">Privacy Policy</span>
            </span>
          </label>

          {error && <p className="text-[13px] font-medium text-[#ef4444]">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Create Account
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#eef0f3]" />
          <span className="text-[12px] text-[#9aa3ad] font-semibold">OR</span>
          <div className="flex-1 h-px bg-[#eef0f3]" />
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={handleGoogle}>
          Continue with Google
        </Button>

        <p className="text-[13px] text-[#5b6472] text-center mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-bold text-[#2563eb] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
