"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      const user = data?.user;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile?.role === "admin") {
          window.location.href = "/admin";
          return;
        }
      }
      window.location.href = redirectTo ?? "/";
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}` },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-300px)] py-10">
      <div className="w-full max-w-[420px] bg-white border border-[#eef0f3] rounded-[18px] p-7">
        <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Welcome Back</h1>
        <p className="text-[14px] text-[#5b6472] text-center mt-1">Sign in to your account</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
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
          <div>
            <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
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

          <div className="flex justify-end">
            <Link href="/auth/forgot-password" className="text-[13px] font-semibold text-[#2563eb] hover:underline">
              Forgot password?
            </Link>
          </div>

          {error && <p className="text-[13px] font-medium text-[#ef4444]">{typeof error === "string" ? error : error?.message || "Email ou mot de passe incorrect"}</p>}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Sign In
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
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-bold text-[#2563eb] hover:underline">Create account</Link>
        </p>
      </div>
    </div>
  );
}
