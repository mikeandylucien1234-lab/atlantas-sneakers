"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ShoppingBag, ArrowLeft, Shield, Truck, CreditCard } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Button } from "@/components/ui/button";

const FREE_SHIPPING_THRESHOLD = 100;

const paymentLogos = [
  { name: "Visa", label: "VISA" },
  { name: "Mastercard", label: "MC" },
  { name: "PayPal", label: "PayPal" },
  { name: "Apple Pay", label: "Pay" },
];

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const count = useCartStore((s) => s.count);
  const discount = useCartStore((s) => s.discount);
  const coupon = useCartStore((s) => s.coupon);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const applyCoupon = useCartStore((s) => s.applyCoupon);

  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 9.99;
  const amountToFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const finalTotal = total + shipping;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const result = await applyCoupon(couponCode.trim());
    setCouponMsg(result.message);
    setCouponLoading(false);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-[120px] h-[120px] rounded-full bg-[#f7f8fa] flex items-center justify-center mb-6">
          <ShoppingBag className="w-[48px] h-[48px] text-[#9aa3ad]" />
        </div>
        <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em]">Your cart is empty</h1>
        <p className="text-[14px] text-[#5b6472] mt-2">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/shop">
          <Button size="lg" className="mt-6">
            Shop Now
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">Cart</span>
      </div>

      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">
        Your Cart ({count} {count === 1 ? "item" : "items"})
      </h1>

      {/* Free shipping bar */}
      {amountToFree > 0 ? (
        <div className="mt-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-[12px] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#1d4ed8]">
            You&apos;re ${amountToFree.toFixed(2)} away from free shipping!
          </p>
          <div className="mt-2 h-[6px] bg-[#dbeafe] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[12px] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#16a34a]">You qualify for free shipping!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mt-6">
        {/* Cart Items */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="bg-white border border-[#eef0f3] rounded-[16px] p-4 flex gap-4"
            >
              <div className="w-[100px] h-[100px] rounded-[12px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="100px" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-[#16181d] line-clamp-1">{item.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {item.size && (
                    <span className="text-[12px] text-[#5b6472]">Size: <span className="font-semibold">{item.size}</span></span>
                  )}
                  {item.color && (
                    <span className="text-[12px] text-[#5b6472]">Color: <span className="font-semibold">{item.color}</span></span>
                  )}
                </div>
                <div className="text-[16px] font-extrabold text-[#16181d] mt-2">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <QuantitySelector
                    value={item.quantity}
                    onChange={(q) => updateQuantity(item.variantId, q)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="w-[38px] h-[38px] flex items-center justify-center rounded-[10px] border border-[#eef0f3] text-[#9aa3ad] hover:text-[#ef4444] hover:border-[#ef4444] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-[16px] h-[16px]" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#2563eb] hover:underline mt-2"
          >
            <ArrowLeft className="w-[16px] h-[16px]" />
            Continue Shopping
          </Link>
        </div>

        {/* Order Summary */}
        <div className="lg:sticky lg:top-[140px] self-start">
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5">
            <h2 className="text-[18px] font-extrabold text-[#16181d] tracking-[-.01em]">Order Summary</h2>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#5b6472]">Subtotal</span>
                <span className="font-semibold text-[#16181d]">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#5b6472]">Shipping</span>
                <span className="font-semibold text-[#16181d]">
                  {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#16a34a]">Discount {coupon && `(${coupon.code})`}</span>
                  <span className="font-semibold text-[#16a34a]">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#eef0f3] pt-3 flex justify-between">
                <span className="text-[16px] font-extrabold text-[#16181d]">Total</span>
                <span className="text-[20px] font-extrabold text-[#16181d]">${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Coupon */}
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 h-[42px] rounded-[10px] border border-[#e4e7eb] bg-[#fbfbfc] px-3 text-[13px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading}
                  className="h-[42px] px-4 bg-[#f7f8fa] border border-[#e4e7eb] rounded-[10px] text-[13px] font-bold text-[#16181d] hover:bg-[#eef0f3] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              {couponMsg && (
                <p className={`text-[12px] mt-1.5 font-medium ${discount > 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                  {couponMsg}
                </p>
              )}
            </div>

            <Link href="/checkout">
              <Button size="lg" className="w-full mt-5">
                CHECKOUT
              </Button>
            </Link>

            {/* Payment logos */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {paymentLogos.map((p) => (
                <div
                  key={p.name}
                  className="w-[48px] h-[30px] rounded-[6px] border border-[#e4e7eb] bg-[#f7f8fa] flex items-center justify-center"
                >
                  <span className="text-[9px] font-bold text-[#5b6472]">{p.label}</span>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div className="mt-4 pt-4 border-t border-[#eef0f3] space-y-2.5">
              <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
                <Shield className="w-[16px] h-[16px] text-[#2563eb] shrink-0" />
                30-Day Returns Guarantee
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
                <Truck className="w-[16px] h-[16px] text-[#2563eb] shrink-0" />
                Secure & Insured Shipping
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
                <CreditCard className="w-[16px] h-[16px] text-[#2563eb] shrink-0" />
                Safe & Encrypted Payments
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
