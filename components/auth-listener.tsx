"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { recordLoginEvent } from "@/lib/login-history/client";

export function AuthListener() {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    const supabase = createClient();

    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setProfile(data);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          // Record a successful login once per browser session (covers email,
          // OAuth and magic-link flows). Server binds it to the auth session.
          if (event === "SIGNED_IN" && typeof sessionStorage !== "undefined" && !sessionStorage.getItem("atl_login_recorded")) {
            sessionStorage.setItem("atl_login_recorded", "1");
            const method = sessionStorage.getItem("atl_login_method") || "email";
            recordLoginEvent("success", method);
          }
        } else {
          setProfile(null);
          try { sessionStorage.removeItem("atl_login_recorded"); } catch {}
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setUser, setProfile]);

  return null;
}
