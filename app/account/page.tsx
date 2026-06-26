"use client";

import { useState } from "react";
import { User, Package, Heart, MapPin, CreditCard, Trophy, Settings, LogOut, ChevronRight, Edit3, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth-store";

const sidebarItems = [
  { id: "profile", label: "Profile", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "payment", label: "Payment Methods", icon: CreditCard },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const mockOrders = [
  { id: "ATL-K8F3M2", date: "Jun 15, 2026", status: "Delivered", total: 329.97, items: 3 },
  { id: "ATL-P9X7N1", date: "Jun 8, 2026", status: "Shipped", total: 159.99, items: 1 },
  { id: "ATL-R2W5Q4", date: "May 22, 2026", status: "Delivered", total: 249.98, items: 2 },
  { id: "ATL-T6Y1J8", date: "May 10, 2026", status: "Cancelled", total: 89.99, items: 1 },
];

const mockAddresses = [
  { id: "1", label: "Home", name: "John Doe", line1: "123 Peachtree St NE", city: "Atlanta", state: "GA", zip: "30301", country: "US", isDefault: true },
  { id: "2", label: "Office", name: "John Doe", line1: "456 Midtown Ave", city: "Atlanta", state: "GA", zip: "30308", country: "US", isDefault: false },
];

const statusColor: Record<string, string> = {
  Delivered: "bg-[#f0fdf4] text-[#16a34a]",
  Shipped: "bg-[#eff6ff] text-[#2563eb]",
  Processing: "bg-[#fef3c7] text-[#d97706]",
  Cancelled: "bg-[#fef2f2] text-[#ef4444]",
};

type Section = typeof sidebarItems[number]["id"];

export default function AccountPage() {
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const signOut = useAuthStore((s) => s.signOut);

  const [fullName, setFullName] = useState("John Doe");
  const [email] = useState("john@example.com");
  const [phone, setPhone] = useState("+1 (555) 123-4567");

  const inputCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]";

  return (
    <div className="mt-4">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">My Account</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 mt-5">
        {/* Sidebar */}
        <aside className="bg-white border border-[#eef0f3] rounded-[16px] p-4 self-start lg:sticky lg:top-[140px]">
          <div className="flex items-center gap-3 pb-4 border-b border-[#eef0f3] mb-2">
            <div className="w-[44px] h-[44px] rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[18px] font-bold">
              J
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[#16181d]">{fullName}</p>
              <p className="text-[12px] text-[#9aa3ad] truncate">{email}</p>
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
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#ef4444] hover:bg-[#fef2f2] transition-colors cursor-pointer"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Logout
            </button>
          </nav>
        </aside>

        {/* Content */}
        <div className="bg-white border border-[#eef0f3] rounded-[16px] p-6">
          {activeSection === "profile" && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-[72px] h-[72px] rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[28px] font-bold">
                  J
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#16181d]">{fullName}</p>
                  <p className="text-[13px] text-[#5b6472]">Member since May 2025</p>
                </div>
                <button type="button" className="ml-auto w-[36px] h-[36px] flex items-center justify-center rounded-[10px] border border-[#e4e7eb] text-[#5b6472] hover:text-[#2563eb] hover:border-[#2563eb] transition-colors cursor-pointer">
                  <Edit3 className="w-[16px] h-[16px]" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Full Name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Email</label>
                  <input type="email" value={email} readOnly className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </div>
              </div>
              <Button size="md" className="mt-5">Save Changes</Button>
            </>
          )}

          {activeSection === "orders" && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">My Orders</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#eef0f3]">
                      <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Order</th>
                      <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Date</th>
                      <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Status</th>
                      <th className="text-left text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Total</th>
                      <th className="text-right text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] py-3 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockOrders.map((o) => (
                      <tr key={o.id} className="border-b border-[#eef0f3] last:border-0">
                        <td className="py-3 px-2 text-[13px] font-bold text-[#2563eb]">{o.id}</td>
                        <td className="py-3 px-2 text-[13px] text-[#5b6472]">{o.date}</td>
                        <td className="py-3 px-2">
                          <span className={cn("inline-block px-2.5 py-1 rounded-[6px] text-[11px] font-bold", statusColor[o.status])}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[13px] font-bold text-[#16181d]">${o.total.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">
                          <button type="button" className="text-[12px] font-bold text-[#2563eb] hover:underline cursor-pointer">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  <span className="text-[14px] font-bold text-white/80">Gold Member</span>
                </div>
                <p className="text-[36px] font-extrabold leading-none mt-2">2,450</p>
                <p className="text-[13px] text-white/70 mt-1">Points Available</p>
                <div className="mt-4">
                  <div className="flex justify-between text-[12px] text-white/70 mb-1.5">
                    <span>Gold (2,000)</span>
                    <span>Platinum (5,000)</span>
                  </div>
                  <div className="h-[8px] bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: "49%" }} />
                  </div>
                  <p className="text-[12px] text-white/70 mt-1.5">2,550 points to Platinum</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border border-[#eef0f3] rounded-[14px]">
                  <p className="text-[24px] font-extrabold text-[#16181d]">12</p>
                  <p className="text-[12px] text-[#5b6472]">Total Orders</p>
                </div>
                <div className="text-center p-4 border border-[#eef0f3] rounded-[14px]">
                  <p className="text-[24px] font-extrabold text-[#16181d]">$2,847</p>
                  <p className="text-[12px] text-[#5b6472]">Total Spent</p>
                </div>
                <div className="text-center p-4 border border-[#eef0f3] rounded-[14px]">
                  <p className="text-[24px] font-extrabold text-[#2563eb]">$24.50</p>
                  <p className="text-[12px] text-[#5b6472]">Rewards Value</p>
                </div>
              </div>
            </>
          )}

          {(activeSection === "wishlist" || activeSection === "payment" || activeSection === "settings") && (
            <div className="text-center py-12">
              <p className="text-[14px] text-[#5b6472]">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
