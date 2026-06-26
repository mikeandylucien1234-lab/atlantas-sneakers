"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight, ShieldCheck, CircleCheckBig, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCartStore } from "@/lib/store/cart-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const stepLabels = ["Shipping", "Payment", "Review", "Confirmation"];

const shippingOptions = [
  { id: "standard", label: "Standard Shipping", price: 9.99, freeAbove: 100, time: "5-7 business days" },
  { id: "express", label: "Express Shipping", price: 19.99, freeAbove: null, time: "2-3 business days" },
  { id: "overnight", label: "Overnight Shipping", price: 39.99, freeAbove: null, time: "1 business day" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {stepLabels.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-[36px] h-[36px] rounded-full flex items-center justify-center text-[13px] font-bold transition-colors",
              i < current ? "bg-[#16a34a] text-white" : i === current ? "bg-[#2563eb] text-white" : "bg-[#eef0f3] text-[#9aa3ad]"
            )}>
              {i < current ? <Check className="w-[18px] h-[18px]" /> : i + 1}
            </div>
            <span className={cn("text-[11px] font-semibold mt-1.5", i <= current ? "text-[#16181d]" : "text-[#9aa3ad]")}>{step}</span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={cn("w-[40px] sm:w-[60px] h-[2px] mx-1 mb-5", i < current ? "bg-[#16a34a]" : "bg-[#eef0f3]")} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrderSummary() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const discount = useCartStore((s) => s.discount);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5">
      <h3 className="text-[16px] font-extrabold text-[#16181d]">Order Summary</h3>
      <div className="mt-4 space-y-3 max-h-[260px] overflow-y-auto">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-3">
            <div className="w-[52px] h-[52px] rounded-[8px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="52px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#16181d] line-clamp-1">{item.name}</p>
              <p className="text-[11px] text-[#9aa3ad]">
                {item.size && `Size ${item.size}`}{item.size && item.color ? " · " : ""}{item.color ?? ""}{" × "}{item.quantity}
              </p>
            </div>
            <span className="text-[13px] font-bold text-[#16181d] shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[#eef0f3] mt-4 pt-3 space-y-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-[#5b6472]">Subtotal</span>
          <span className="font-semibold">${subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-[13px]">
            <span className="text-[#16a34a]">Discount</span>
            <span className="font-semibold text-[#16a34a]">-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-[#eef0f3]">
          <span className="text-[16px] font-extrabold text-[#16181d]">Total</span>
          <span className="text-[18px] font-extrabold text-[#16181d]">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ onSuccess, onBack, totalAmount }: { onSuccess: (orderNum: string) => void; onBack: () => void; totalAmount: number }) {
  const stripeHook = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeHook || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripeHook.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    const orderNum = `AS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    onSuccess(orderNum);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Payment Information</h2>

      <div className="border border-[#eef0f3] rounded-[14px] p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13px] text-[#ef4444] font-semibold">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 p-3 bg-[#eff6ff] rounded-[10px]">
        <ShieldCheck className="w-[18px] h-[18px] text-[#2563eb] shrink-0" />
        <span className="text-[12px] text-[#1d4ed8] font-semibold">Your payment is secure and encrypted</span>
      </div>

      <div className="flex gap-3 mt-6">
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={processing}>Back</Button>
        <Button type="submit" size="lg" className="flex-1" disabled={!stripeHook || processing}>
          {processing ? (
            <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Processing...</>
          ) : (
            <>Pay ${totalAmount.toFixed(2)}</>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const [step, setStep] = useState(0);
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const discount = useCartStore((s) => s.discount);
  const coupon = useCartStore((s) => s.coupon);
  const clearCart = useCartStore((s) => s.clearCart);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United States");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [intentError, setIntentError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const selectedShipping = shippingOptions.find((o) => o.id === shippingMethod)!;
  const shippingCost = selectedShipping.freeAbove && subtotal >= selectedShipping.freeAbove ? 0 : selectedShipping.price;
  const grandTotal = Math.max(0, subtotal + shippingCost - discount);

  const inputCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none transition-colors duration-150 focus:border-[#2563eb]";

  useEffect(() => {
    if (step === 1 && !clientSecret && items.length > 0) {
      setIntentError(null);
      fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          shippingCost,
          couponCode: coupon?.code,
          userId: user?.id,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          } else {
            setIntentError(data.error ?? "Failed to initialize payment");
          }
        })
        .catch(() => setIntentError("Network error. Please try again."));
    }
  }, [step, clientSecret, items, shippingCost, coupon, user]);

  const handlePaymentSuccess = (orderNum: string) => {
    setOrderNumber(orderNum);
    clearCart();
    setStep(3);
  };

  return (
    <div className="mt-4 mb-10">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Checkout</h1>
      <StepIndicator current={step} />

      {step === 3 ? (
        <div className="max-w-[520px] mx-auto text-center">
          <div className="w-[80px] h-[80px] rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-5 animate-in zoom-in duration-300">
            <CircleCheckBig className="w-[40px] h-[40px] text-[#16a34a]" />
          </div>
          <h2 className="text-[24px] font-extrabold text-[#16181d]">Order Confirmed!</h2>
          <p className="text-[14px] text-[#5b6472] mt-2">Thank you for your purchase. Your order has been placed successfully.</p>
          <div className="bg-[#f7f8fa] rounded-[14px] p-5 mt-6">
            <p className="text-[13px] text-[#5b6472]">Order Number</p>
            <p className="text-[20px] font-extrabold text-[#16181d] mt-1">{orderNumber}</p>
            <p className="text-[13px] text-[#5b6472] mt-3">A confirmation email will be sent to <span className="font-semibold text-[#16181d]">{email}</span></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/track" className="flex-1">
              <Button variant="outline" size="lg" className="w-full">Track My Order</Button>
            </Link>
            <Link href="/shop" className="flex-1">
              <Button size="lg" className="w-full">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="bg-white border border-[#eef0f3] rounded-[16px] p-6">
            {step === 0 && (
              <>
                <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Shipping Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Address</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Atlanta" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Postal Code</label>
                    <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="30301" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Country</label>
                    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
                  </div>
                </div>

                <h3 className="text-[16px] font-extrabold text-[#16181d] mt-7 mb-3">Shipping Method</h3>
                <div className="space-y-2.5">
                  {shippingOptions.map((opt) => {
                    const isFree = opt.freeAbove && subtotal >= opt.freeAbove;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-[12px] border-[1.5px] cursor-pointer transition-colors",
                          shippingMethod === opt.id ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e4e7eb] hover:border-[#2563eb]"
                        )}
                      >
                        <input type="radio" name="shipping" value={opt.id} checked={shippingMethod === opt.id} onChange={() => setShippingMethod(opt.id)} className="accent-[#2563eb] w-[18px] h-[18px]" />
                        <div className="flex-1">
                          <div className="text-[14px] font-bold text-[#16181d]">{opt.label}</div>
                          <div className="text-[12px] text-[#5b6472]">{opt.time}</div>
                        </div>
                        <span className="text-[14px] font-bold text-[#16181d]">{isFree ? "FREE" : `$${opt.price.toFixed(2)}`}</span>
                      </label>
                    );
                  })}
                </div>

                <Button size="lg" className="w-full mt-6" onClick={() => setStep(1)}>
                  Continue to Payment <ChevronRight className="w-[18px] h-[18px]" />
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                {intentError && (
                  <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13px] text-[#ef4444] font-semibold mb-4">
                    {intentError}
                    <button type="button" onClick={() => { setClientSecret(null); setIntentError(null); }} className="ml-2 underline cursor-pointer">Retry</button>
                  </div>
                )}
                {!clientSecret && !intentError && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                    <span className="ml-3 text-[14px] text-[#5b6472]">Initializing secure payment...</span>
                  </div>
                )}
                {clientSecret && (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { borderRadius: "12px", fontFamily: "var(--font-sans)", colorPrimary: "#2563eb" } } }}>
                    <PaymentForm onSuccess={handlePaymentSuccess} onBack={() => setStep(0)} totalAmount={grandTotal} />
                  </Elements>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Review Your Order</h2>
                <div className="space-y-4">
                  <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                    <h4 className="text-[13px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Shipping To</h4>
                    <p className="text-[14px] font-semibold text-[#16181d]">{firstName} {lastName}</p>
                    <p className="text-[13px] text-[#5b6472]">{address}</p>
                    <p className="text-[13px] text-[#5b6472]">{city}, {postalCode}, {country}</p>
                    <p className="text-[13px] text-[#5b6472]">{email} · {phone}</p>
                  </div>
                  <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                    <h4 className="text-[13px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Shipping Method</h4>
                    <p className="text-[14px] font-semibold text-[#16181d]">{selectedShipping.label}</p>
                    <p className="text-[13px] text-[#5b6472]">{selectedShipping.time} — {shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}</p>
                  </div>
                  <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                    <h4 className="text-[13px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Items ({items.length})</h4>
                    {items.map((item) => (
                      <div key={item.variantId} className="flex justify-between text-[13px] py-1">
                        <span className="text-[#16181d]">{item.name} × {item.quantity}</span>
                        <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" size="lg" onClick={() => setStep(1)}>Back</Button>
                  <Button size="lg" className="flex-1" onClick={() => setStep(1)}>
                    Proceed to Payment <ChevronRight className="w-[18px] h-[18px]" />
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-[140px] self-start">
            <OrderSummary />
          </div>
        </div>
      )}
    </div>
  );
}
