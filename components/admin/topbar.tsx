"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  Menu,
  Search,
  Sun,
  Moon,
  Bell,
  User,
  Settings,
  LogOut,
} from "lucide-react";

type AdminTopbarProps = {
  dark: boolean;
  onToggleDark: () => void;
  onToggleSidebar: () => void;
  breadcrumb: string;
};


export function AdminTopbar({
  dark,
  onToggleDark,
  onToggleSidebar,
  breadcrumb,
}: AdminTopbarProps) {
  const { profile, signOut } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-[60px] flex items-center gap-4 px-4 lg:px-6 border-b",
        dark
          ? "bg-[#171c24] border-[#252c36]"
          : "bg-white border-[#eef0f3]"
      )}
    >
      {/* Left: hamburger + breadcrumb */}
      <button
        onClick={onToggleSidebar}
        className={cn(
          "lg:hidden p-1.5 rounded-md",
          dark ? "text-[#8b95a3] hover:text-white" : "text-[#8a929c] hover:text-[#16181d]"
        )}
      >
        <Menu className="w-5 h-5" />
      </button>
      <span
        className={cn(
          "text-sm font-semibold",
          dark ? "text-[#e7ebf0]" : "text-[#16181d]"
        )}
      >
        {breadcrumb}
      </span>

      {/* Center: search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
              dark ? "text-[#8b95a3]" : "text-[#8a929c]"
            )}
          />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              "w-full h-9 pl-9 pr-4 rounded-[11px] text-sm outline-none border transition-colors",
              dark
                ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0] placeholder:text-[#8b95a3] focus:border-[#2563eb]"
                : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d] placeholder:text-[#8a929c] focus:border-[#2563eb]"
            )}
          />
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          className={cn(
            "p-2 rounded-md transition-colors",
            dark ? "text-[#8b95a3] hover:text-white" : "text-[#8a929c] hover:text-[#16181d]"
          )}
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className={cn(
              "p-2 rounded-md transition-colors relative",
              dark ? "text-[#8b95a3] hover:text-white" : "text-[#8a929c] hover:text-[#16181d]"
            )}
          >
            <Bell className="w-5 h-5" />
          </button>
          {notifOpen && (
            <div
              className={cn(
                "absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-lg overflow-hidden",
                dark
                  ? "bg-[#171c24] border-[#252c36]"
                  : "bg-white border-[#eef0f3]"
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 border-b text-sm font-semibold",
                  dark ? "border-[#252c36] text-[#e7ebf0]" : "border-[#eef0f3] text-[#16181d]"
                )}
              >
                Notifications
              </div>
              <div
                className={cn(
                  "px-4 py-6 text-center text-sm",
                  dark ? "text-[#8b95a3]" : "text-[#8a929c]"
                )}
              >
                No notifications
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ml-1",
              dark
                ? "bg-[#2563eb] text-white"
                : "bg-[#2563eb] text-white"
            )}
          >
            {profile?.full_name?.[0]?.toUpperCase() || "A"}
          </button>
          {profileOpen && (
            <div
              className={cn(
                "absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-lg overflow-hidden",
                dark
                  ? "bg-[#171c24] border-[#252c36]"
                  : "bg-white border-[#eef0f3]"
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 border-b",
                  dark ? "border-[#252c36]" : "border-[#eef0f3]"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold",
                    dark ? "text-[#e7ebf0]" : "text-[#16181d]"
                  )}
                >
                  {profile?.full_name || "Admin"}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    dark ? "text-[#8b95a3]" : "text-[#8a929c]"
                  )}
                >
                  {profile?.role || "admin"}
                </p>
              </div>
              {[
                { icon: User, label: "View Profile", action: () => { setProfileOpen(false); } },
                { icon: Settings, label: "Settings", action: () => { setProfileOpen(false); } },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                      dark
                        ? "text-[#e7ebf0] hover:bg-white/5"
                        : "text-[#16181d] hover:bg-black/5"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
              <div
                className={cn(
                  "border-t",
                  dark ? "border-[#252c36]" : "border-[#eef0f3]"
                )}
              >
                <button
                  onClick={() => signOut()}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors",
                    dark ? "hover:bg-white/5" : "hover:bg-black/5"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
