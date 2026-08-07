"use client";

import { useState, useEffect } from "react";
import { User, Package, Heart, MapPin, CreditCard, Trophy, Settings, LogOut, ChevronRight, Edit3, Star, Loader2, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProfileInformation } from "@/components/account/profile-information";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

const sidebarItems = [
  { id: "profile", label: "Profile", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "payment", label: "Payment Methods", icon: CreditCard },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  tracking_number?: string | null;
  carrier?: string | null;
  items: Array<{ id: string; quantity: number; price: number; product: { name: string; slug: string; images: string[] } | null }>;
}

// TODO: Replace with real address data from user profile / Supabase
const mockAddresses = [
  { id: "1", label: "Home", name: "Jane Doe", line1: "123 Peachtree St NE", city: "Atlanta", state: "GA", zip: "30301", country: "US", isDefault: true },
  { id: "2", label: "Office", name: "Jane Doe", line1: "456 Midtown Ave", city: "Atlanta", state: "GA", zip: "30308", country: "US", isDefault: false },
];

const statusColor: Record<string, string> = {
  Delivered: "bg-[#f0fdf4] text-[#16a34a]",
  Shipped: "bg-[#eff6ff] text-[#2563eb]",
  Processing: "bg-[#fef3c7] text-[#d97706]",
  Cancelled: "bg-[#fef2f2] text-[#ef4444]",
};

type Section = typeof sidebarItems[number]["id"];

function getTierInfo(points: number) {
  if (points >= 5000) return { tier: "Platinum", next: null, nextThreshold: null };
  if (points >= 2000) return { tier: "Gold", next: "Platinum", nextThreshold: 5000 };
  if (points >= 500) return { tier: "Silver", next: "Gold", nextThreshold: 2000 };
  return { tier: "Bronze", next: "Silver", nextThreshold: 500 };
}

export default function AccountPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const wishlistItems = useWishlistStore((s) => s.items);
  const removeFromWishlist = useWishlistStore((s) => s.removeItem);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "";
  const displayEmail = user?.email || "";
  const nameInitial = displayName ? displayName.charAt(0).toUpperCase() : displayEmail ? displayEmail.charAt(0).toUpperCase() : "?";

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (activeSection === "orders" && user) {
      setOrdersLoading(true);
      fetch("/api/orders")
        .then((r) => r.json())
        .then((d) => setOrders(d.orders ?? []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false));
    }
  }, [activeSection, user]);

  const points = profile?.points ?? 0;
  const tierInfo = getTierInfo(points);
  const rewardsValue = (points * 0.01).toFixed(2);
  const progressPercent = tierInfo.nextThreshold
    ? Math.min(100, Math.round((points / tierInfo.nextThreshold) * 100))
    : 100;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="mt-4">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">My Account</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 mt-5">
        {/* Sidebar */}
        <aside className="bg-white border border-[#eef0f3] rounded-[16px] p-4 self-start lg:sticky lg:top-[140px]">
          <div className="flex items-center gap-3 pb-4 border-b border-[#eef0f3] mb-2">
            <div className="w-[44px] h-[44px] rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[18px] font-bold">
              {nameInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[#16181d]">{displayName || "User"}</p>
              <p className="text-[12px] text-[#9aa3ad] truncate">{displayEmail}</p>
            </div>
          </div>
          <nav className="space-y-0.5">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer",
                  activeSection === id
                    ? "bg-[#eff6ff] text-[#2563eb]"
                    : "text-[#5b6472] hover:bg-[#f7f8fa]"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {label}
                <ChevronRight className="w-[14px] h-[14px] ml-auto opacity-40" />
              </button>
            ))}
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#5b6472] hover:bg-[#f7f8fa] transition-colors"
              >
                <Shield className="w-[18px] h-[18px]" />
                Admin Panel
                <ChevronRight className="w-[14px] h-[14px] ml-auto opacity-40" />
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#ef4444] hover:bg-[#fef2f2] transition-colors cursor-pointer"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Logout
            </button>
          </nav>
        </aside>

        {/* Content */}
        <div className="bg-white border border-[#eef0f3] rounded-[16px] p-6">
          {activeSection === "profile" && <ProfileInformation />}

          {activeSection === "orders" && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">My Orders</h2>
              {ordersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-10 h-10 text-[#d1d5db] mx-auto mb-3" />
                  <p className="text-[14px] text-[#5b6472]">No orders yet.</p>
                  <Link href="/shop" className="text-[13px] font-bold text-[#2563eb] hover:underline mt-2 inline-block">Start Shopping</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#eef0f3]">
                        <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Order</th>
                        <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Date</th>
                        <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Status</th>
                        <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Total</th>
                        <th className="text-right text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-b border-[#eef0f3] last:border-0">
                          <td className="py-3 px-2 text-[13px] font-bold text-[#2563eb]">{o.order_number}</td>
                          <td className="py-3 px-2 text-[13px] text-[#5b6472]">{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td className="py-3 px-2">
                            <span className={cn("inline-block px-2.5 py-1 rounded-[6px] text-[11px] font-bold capitalize", statusColor[o.status] ?? "bg-[#f7f8fa] text-[#5b6472]")}>
                              {o.status}
                            </span>
                            {o.tracking_number && (
                              <span className="block text-[11px] text-[#5b6472] mt-1">{o.carrier ? `${o.carrier} · ` : ""}{o.tracking_number}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-[13px] font-bold text-[#16181d]">${o.total.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right space-x-3">
                            <Link href={`/track?order=${o.order_number}`} className="text-[12px] font-bold text-[#2563eb] hover:underline">Track</Link>
                            <button type="button" className="text-[12px] font-bold text-[#5b6472] hover:underline cursor-pointer">Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeSection === "wishlist" && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Wishlist</h2>
              {wishlistItems.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-10 h-10 text-[#d1d5db] mx-auto mb-3" />
                  <p className="text-[14px] text-[#5b6472]">Your wishlist is empty.</p>
                  <Link href="/shop" className="text-[13px] font-bold text-[#2563eb] hover:underline mt-2 inline-block">Browse Products</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlistItems.map((item) => (
                    <div key={item.productId} className="border border-[#eef0f3] rounded-[14px] p-4 flex gap-3">
                      <div className="w-[64px] h-[64px] rounded-[10px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#16181d] line-clamp-1">{item.name}</p>
                        <p className="text-[14px] font-bold text-[#16181d] mt-1">${item.price.toFixed(2)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromWishlist(item.productId)}
                        className="self-start p-2 text-[#9aa3ad] hover:text-[#ef4444] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeSection === "addresses" && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-extrabold text-[#16181d]">Saved Addresses</h2>
                <Button size="sm" variant="outline">Add Address</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mockAddresses.map((a) => (
                  <div key={a.id} className="border border-[#eef0f3] rounded-[14px] p-4 relative">
                    {a.isDefault && (
                      <Badge variant="new" className="absolute top-3 right-3 text-[10px] px-2 py-1">Default</Badge>
                    )}
                    <p className="text-[13px] font-bold text-[#9aa3ad] uppercase tracking-[.04em]">{a.label}</p>
                    <p className="text-[14px] font-semibold text-[#16181d] mt-1">{a.name}</p>
                    <p className="text-[13px] text-[#5b6472] mt-0.5">{a.line1}</p>
                    <p className="text-[13px] text-[#5b6472]">{a.city}, {a.state} {a.zip}</p>
                    <div className="flex gap-3 mt-3">
                      <button type="button" className="text-[12px] font-bold text-[#2563eb] hover:underline cursor-pointer">Edit</button>
                      <button type="button" className="text-[12px] font-bold text-[#ef4444] hover:underline cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === "rewards" && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Rewards Program</h2>
              <div className="bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] rounded-[16px] p-6 text-white mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-[20px] h-[20px] fill-[#fbbf24] text-[#fbbf24]" />
                  <span className="text-[14px] font-bold text-white/80">{tierInfo.tier} Member</span>
                </div>
                <p className="text-[36px] font-extrabold leading-none mt-2">{points.toLocaleString()}</p>
                <p className="text-[13px] text-white/70 mt-1">Points Available</p>
                {tierInfo.nextThreshold && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[12px] text-white/70 mb-1.5">
                      <span>{tierInfo.tier} ({tierInfo.nextThreshold === 5000 ? "2,000" : tierInfo.nextThreshold === 2000 ? "500" : "0"})</span>
                      <span>{tierInfo.next} ({tierInfo.nextThreshold.toLocaleString()})</span>
                    </div>
                    <div className="h-[8px] bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="text-[12px] text-white/70 mt-1.5">{(tierInfo.nextThreshold - points).toLocaleString()} points to {tierInfo.next}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border border-[#eef0f3] rounded-[14px]">
                  <p className="text-[24px] font-extrabold text-[#16181d]">{points.toLocaleString()}</p>
                  <p className="text-[12px] text-[#5b6472]">Total Points</p>
                </div>
                <div className="text-center p-4 border border-[#eef0f3] rounded-[14px]">
                  <p className="text-[24px] font-extrabold text-[#2563eb]">${rewardsValue}</p>
                  <p className="text-[12px] text-[#5b6472]">Rewards Value</p>
                </div>
              </div>
            </>
          )}

          {(activeSection === "payment" || activeSection === "settings") && (
            <div className="text-center py-12">
              <p className="text-[14px] text-[#5b6472]">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
