"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ShieldCheck, CircleCheckBig, Loader2, CreditCard, Smartphone, Banknote, Building2, Truck } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCartStore } from "@/lib/store/cart-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Stripe } from "@stripe/stripe-js";

// Cache loadStripe promises per publishable key so we only initialize once.
const _stripePromises: Record<string, Promise<Stripe | null>> = {};
function getStripePromise(pk: string | null | undefined) {
  const key = pk || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  if (!key) return null;
  if (!_stripePromises[key]) _stripePromises[key] = loadStripe(key);
  return _stripePromises[key];
}

const stepLabels = ["Address", "Shipping", "Payment", "Review", "Confirm"];

const shippingOptions = [
  { id: "standard", label: "Standard Shipping", price: 9.99, freeAbove: 100, time: "5-7 business days" },
  { id: "express", label: "Express Shipping", price: 19.99, freeAbove: null, time: "2-3 business days" },
  { id: "overnight", label: "Overnight Shipping", price: 39.99, freeAbove: null, time: "1 business day" },
];

type PaymentMethodId = string;

const paymentMethods: { id: PaymentMethodId; label: string; description: string; icon: typeof CreditCard; processing: string }[] = [
  { id: "stripe", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex — powered by Stripe", icon: CreditCard, processing: "Instant" },
  { id: "moncash", label: "MonCash", description: "Pay with your Digicel MonCash wallet", icon: Smartphone, processing: "Instant" },
  { id: "natcash", label: "NatCash", description: "Pay with your Natcom NatCash wallet", icon: Smartphone, processing: "Instant" },
  { id: "cod", label: "Cash on Delivery", description: "Pay when you receive your order", icon: Banknote, processing: "On delivery" },
  { id: "bank_transfer", label: "Bank Transfer", description: "Direct bank transfer — manual verification", icon: Building2, processing: "1-2 business days" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {stepLabels.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold transition-colors",
              i < current ? "bg-[#16a34a] text-white" : i === current ? "bg-[#2563eb] text-white" : "bg-[#eef0f3] text-[#9aa3ad]"
            )}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-[10px] font-semibold mt-1", i <= current ? "text-[#16181d]" : "text-[#9aa3ad]")}>{step}</span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={cn("w-[28px] sm:w-[48px] h-[2px] mx-0.5 mb-5", i < current ? "bg-[#16a34a]" : "bg-[#eef0f3]")} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrderSummary({ shippingCost, grandTotal, tax = 0 }: { shippingCost: number; grandTotal: number; tax?: number }) {
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5">
      <h3 className="text-[16px] font-extrabold text-[#16181d]">Order Summary</h3>
      <div className="mt-4 space-y-3 max-h-[220px] overflow-y-auto">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-3">
            <div className="w-[48px] h-[48px] rounded-[8px] bg-[#f4f5f7] overflow-hidden relative shrink-0">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#16181d] line-clamp-1">{item.name}</p>
              <p className="text-[11px] text-[#9aa3ad]">{item.size && `Size ${item.size}`} × {item.quantity}</p>
            </div>
            <span className="text-[13px] font-bold text-[#16181d] shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[#eef0f3] mt-4 pt-3 space-y-2 text-[13px]">
        <div className="flex justify-between"><span className="text-[#5b6472]">Subtotal</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-[#5b6472]">Shipping</span><span className="font-semibold">{shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}</span></div>
        {discount > 0 && <div className="flex justify-between"><span className="text-[#16a34a]">Discount</span><span className="font-semibold text-[#16a34a]">-${discount.toFixed(2)}</span></div>}
        {tax > 0 && <div className="flex justify-between"><span className="text-[#5b6472]">Tax</span><span className="font-semibold">${tax.toFixed(2)}</span></div>}
        <div className="flex justify-between pt-2 border-t border-[#eef0f3]">
          <span className="text-[16px] font-extrabold text-[#16181d]">Total</span>
          <span className="text-[18px] font-extrabold text-[#16181d]">${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function StripePaymentForm({ onSuccess, onBack, totalAmount }: { onSuccess: (orderNum: string) => void; onBack: () => void; totalAmount: number }) {
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
    if (submitError) { setError(submitError.message ?? "Payment failed"); setProcessing(false); return; }
    const { error: confirmError, paymentIntent: confirmedIntent } = await stripeHook.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/payment/success?gateway=stripe` }, redirect: "if_required" });
    if (confirmError) { setError(confirmError.message ?? "Payment failed. Please try again."); setProcessing(false); return; }
    // The webhook creates the order for Stripe payments; show a generic confirmation
    onSuccess(confirmedIntent?.id ?? "stripe-pending");
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="border border-[#eef0f3] rounded-[14px] p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13px] text-[#ef4444] font-semibold">{error}</div>}
      <div className="flex gap-3 mt-6">
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={processing}>Back</Button>
        <Button type="submit" size="lg" className="flex-1" disabled={!stripeHook || processing}>
          {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Pay ${totalAmount.toFixed(2)}</>}
        </Button>
      </div>
    </form>
  );
}

function MobilePaymentCard({ gateway, phone, setPhone, amount, processing, onSubmit, onBack }: {
  gateway: "moncash" | "natcash"; phone: string; setPhone: (v: string) => void; amount: number; processing: boolean; onSubmit: () => void; onBack: () => void;
}) {
  const isMoncash = gateway === "moncash";
  return (
    <div className="border border-[#eef0f3] rounded-[16px] p-6">
      <div className="flex items-center gap-3 mb-1">
        <Smartphone className="w-6 h-6 text-[#2563eb]" />
        <div>
          <h3 className="text-[16px] font-bold text-[#16181d]">{isMoncash ? "MonCash" : "NatCash"}</h3>
          <p className="text-[12px] text-[#5b6472]">Secure {isMoncash ? "Digicel" : "Natcom"} Payment</p>
        </div>
      </div>
      <div className="mt-5">
        <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Phone Number</label>
        <div className="flex gap-2">
          <span className="h-[46px] px-3 rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#f7f8fa] flex items-center text-[14px] font-semibold text-[#5b6472]">+509</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXX XXXX" className="flex-1 h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]" />
        </div>
      </div>
      <div className="mt-4 p-3 bg-[#f7f8fa] rounded-[12px]">
        <div className="flex justify-between">
          <span className="text-[13px] text-[#5b6472]">Amount</span>
          <span className="text-[16px] font-extrabold text-[#16181d]">HTG {(amount * 135).toFixed(2)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
        <span className="text-[11px] text-[#5b6472]">You will authenticate via your {isMoncash ? "MonCash" : "NatCash"} app. We never collect your PIN.</span>
      </div>
      <div className="flex gap-3 mt-5">
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={processing}>Back</Button>
        <Button size="lg" className="flex-1" onClick={onSubmit} disabled={processing || !phone}>
          {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Continue with {isMoncash ? "MonCash" : "NatCash"}</>}
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const items = useCartStore((s) => s.items);
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
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Haiti");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("stripe");
  const [mobilePhone, setMobilePhone] = useState("");
  const [bankRef, setBankRef] = useState("");

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [intentError, setIntentError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const selectedShipping = shippingOptions.find((o) => o.id === shippingMethod)!;
  const shippingCost = selectedShipping.freeAbove && subtotal >= selectedShipping.freeAbove ? 0 : selectedShipping.price;

  // Real-time tax preview via the shared engine
  const [taxPreview, setTaxPreview] = useState(0);
  useEffect(() => {
    if (items.length === 0 || !country) { setTaxPreview(0); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/tax/calculate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country, state, city, postal_code: postalCode,
            customer_type: user ? "registered" : "guest",
            items: items.map((i) => ({ product_id: i.productId, price: i.price, quantity: i.quantity })),
            subtotal,
          }),
        });
        if (res.ok) { const d = await res.json(); setTaxPreview(Number(d.totalTax) || 0); }
      } catch { setTaxPreview(0); }
    }, 400);
    return () => clearTimeout(t);
  }, [country, state, city, postalCode, subtotal, items, user]);

  const grandTotal = Math.max(0, subtotal + shippingCost - discount + taxPreview);

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [createdOrderTotal, setCreatedOrderTotal] = useState<number | null>(null);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // Payment methods enabled by admin (payment_settings table). null = loading, fall back to all.
  const [enabledGateways, setEnabledGateways] = useState<Set<string> | null>(null);
  // Wizard-created manual gateways appear automatically with a generic flow
  const [customMethods, setCustomMethods] = useState<{ id: string; label: string; description: string }[]>([]);
  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.methods?.length) {
          const enabled = new Set<string>(d.methods.map((m: { gateway: string }) => m.gateway));
          setEnabledGateways(enabled);
          const known = new Set(paymentMethods.map((pm) => pm.id));
          setCustomMethods(
            d.methods
              .filter((m: { gateway: string }) => !known.has(m.gateway))
              .map((m: { gateway: string; display_name: string; description: string }) => ({
                id: m.gateway, label: m.display_name, description: m.description || "Manual payment",
              }))
          );
          // If current selection is disabled, switch to first enabled method
          if (!enabled.has("stripe")) {
            const first = paymentMethods.find((pm) => enabled.has(pm.id));
            if (first) setPaymentMethod(first.id);
          }
        }
      })
      .catch(() => {});
  }, []);
  const visiblePaymentMethods = [
    ...(enabledGateways ? paymentMethods.filter((pm) => enabledGateways.has(pm.id)) : paymentMethods),
    ...customMethods.map((m) => ({ id: m.id, label: m.label, description: m.description, icon: Banknote, processing: "Manual confirmation" })),
  ];
  const isCustomMethod = customMethods.some((m) => m.id === paymentMethod);

  const handleCustomManual = async () => {
    setProcessing(true);
    setIntentError(null);
    const order = await createOrder();
    if (!order) { setProcessing(false); return; }
    try {
      const res = await fetch(`/api/payments/${paymentMethod}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, amount: order.total, reference: bankRef || undefined }),
      });
      const data = await res.json();
      if (data.paymentId) handlePaymentSuccess(order.orderNumber);
      else setIntentError(data.error ?? "Failed");
    } catch { setIntentError("Network error"); }
    setProcessing(false);
  };

  const validateAddress = (): boolean => {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email";
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";
    if (!address.trim()) errors.address = "Address is required";
    if (!city.trim()) errors.city = "City is required";
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const inputCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none transition-colors focus:border-[#2563eb]";
  const inputErrorCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#ef4444] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none transition-colors focus:border-[#ef4444]";

  useEffect(() => {
    if (step === 4 && paymentMethod === "stripe" && !clientSecret && items.length > 0) {
      setIntentError(null);
      fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, price: i.price, quantity: i.quantity })),
          shippingMethod,
          couponCode: coupon?.code,
          userId: user?.id,
        }),
      })
        .then((res) => res.json())
        .then((data) => { if (data.clientSecret) { setClientSecret(data.clientSecret); setPublishableKey(data.publishableKey ?? null); } else setIntentError(data.error ?? "Failed to initialize payment"); })
        .catch(() => setIntentError("Network error. Please try again."));
    }
  }, [step, clientSecret, items, shippingCost, coupon, user, paymentMethod]);

  const createOrder = async (): Promise<{ orderId: string; orderNumber: string; total: number } | null> => {
    if (createdOrderId && createdOrderNumber) {
      return { orderId: createdOrderId, orderNumber: createdOrderNumber, total: createdOrderTotal ?? grandTotal };
    }
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, price: i.price, quantity: i.quantity })),
          shippingAddress: { email, phone, firstName, lastName, address, city, state, country, postalCode },
          shippingMethod,
          couponCode: coupon?.code,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (data.orderId) {
        setCreatedOrderId(data.orderId);
        setCreatedOrderNumber(data.orderNumber);
        // Server total is authoritative (includes tax) — used for the payment amount
        const authoritativeTotal = typeof data.total === "number" ? data.total : grandTotal;
        setCreatedOrderTotal(authoritativeTotal);
        return { orderId: data.orderId, orderNumber: data.orderNumber, total: authoritativeTotal };
      }
      setIntentError(data.error ?? "Failed to create order");
      return null;
    } catch {
      setIntentError("Network error creating order");
      return null;
    }
  };

  const handlePaymentSuccess = (orderNum: string) => {
    setOrderNumber(orderNum);
    clearCart();
    setStep(5);
  };

  const handleMobilePayment = async (gateway: "moncash" | "natcash") => {
    setProcessing(true);
    setIntentError(null);
    const order = await createOrder();
    if (!order) { setProcessing(false); return; }
    try {
      const res = await fetch(`/api/payments/${gateway}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, userId: user?.id ?? null, amount: order.total, phone: mobilePhone }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.paymentId) {
        router.push(`/payment/processing?gateway=${gateway}&paymentId=${data.paymentId}&order=${order.orderNumber}`);
      } else {
        setIntentError(data.error ?? "Payment initiation failed");
      }
    } catch { setIntentError("Network error"); }
    setProcessing(false);
  };

  const handleCodOrBank = async () => {
    setProcessing(true);
    setIntentError(null);
    const order = await createOrder();
    if (!order) { setProcessing(false); return; }
    const endpoint = paymentMethod === "cod" ? "/api/payments/cod/confirm" : "/api/payments/bank/confirm";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, userId: user?.id ?? null, amount: order.total, referenceNumber: bankRef }),
      });
      const data = await res.json();
      if (data.paymentId) {
        handlePaymentSuccess(order.orderNumber);
      } else {
        setIntentError(data.error ?? "Failed");
      }
    } catch { setIntentError("Network error"); }
    setProcessing(false);
  };

  // Empty cart guard
  if (items.length === 0 && step !== 5) {
    return (
      <div className="mt-4 mb-10 text-center">
        <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">Your Cart is Empty</h1>
        <p className="text-[14px] text-[#5b6472] mt-2">Add some items before checking out.</p>
        <Link href="/shop">
          <Button size="lg" className="mt-6">Browse Shop</Button>
        </Link>
      </div>
    );
  }

  // Step 5 = confirmation
  if (step === 5) {
    return (
      <div className="mt-4 mb-10">
        <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Checkout</h1>
        <StepIndicator current={5} />
        <div className="max-w-[520px] mx-auto text-center">
          <div className="w-[80px] h-[80px] rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-5 animate-in zoom-in duration-300">
            <CircleCheckBig className="w-[40px] h-[40px] text-[#16a34a]" />
          </div>
          <h2 className="text-[24px] font-extrabold text-[#16181d]">Order Confirmed!</h2>
          <p className="text-[14px] text-[#5b6472] mt-2">Thank you for your purchase.</p>
          <div className="bg-[#f7f8fa] rounded-[14px] p-5 mt-6">
            <p className="text-[13px] text-[#5b6472]">Order Number</p>
            <p className="text-[20px] font-extrabold text-[#16181d] mt-1">{orderNumber}</p>
            <p className="text-[13px] text-[#5b6472] mt-3">Confirmation sent to <span className="font-semibold text-[#16181d]">{email}</span></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/track" className="flex-1"><Button variant="outline" size="lg" className="w-full">Track My Order</Button></Link>
            <Link href="/shop" className="flex-1"><Button size="lg" className="w-full">Continue Shopping</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 mb-10">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em] text-center">Checkout</h1>
      <StepIndicator current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-white border border-[#eef0f3] rounded-[16px] p-6">

          {/* Step 0: Shipping Address */}
          {step === 0 && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Shipping Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Email <span className="text-[#ef4444]">*</span></label>
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAddressErrors((prev) => { const { email: _, ...rest } = prev; return rest; }); }} placeholder="your@email.com" className={addressErrors.email ? inputErrorCls : inputCls} />
                  {addressErrors.email && <p className="text-[12px] text-[#ef4444] mt-1">{addressErrors.email}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX XXXX" className={inputCls} />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">First Name <span className="text-[#ef4444]">*</span></label>
                  <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); setAddressErrors((prev) => { const { firstName: _, ...rest } = prev; return rest; }); }} placeholder="John" className={addressErrors.firstName ? inputErrorCls : inputCls} />
                  {addressErrors.firstName && <p className="text-[12px] text-[#ef4444] mt-1">{addressErrors.firstName}</p>}
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Last Name <span className="text-[#ef4444]">*</span></label>
                  <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); setAddressErrors((prev) => { const { lastName: _, ...rest } = prev; return rest; }); }} placeholder="Doe" className={addressErrors.lastName ? inputErrorCls : inputCls} />
                  {addressErrors.lastName && <p className="text-[12px] text-[#ef4444] mt-1">{addressErrors.lastName}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Address <span className="text-[#ef4444]">*</span></label>
                  <input type="text" value={address} onChange={(e) => { setAddress(e.target.value); setAddressErrors((prev) => { const { address: _, ...rest } = prev; return rest; }); }} placeholder="123 Main Street" className={addressErrors.address ? inputErrorCls : inputCls} />
                  {addressErrors.address && <p className="text-[12px] text-[#ef4444] mt-1">{addressErrors.address}</p>}
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">City <span className="text-[#ef4444]">*</span></label>
                  <input type="text" value={city} onChange={(e) => { setCity(e.target.value); setAddressErrors((prev) => { const { city: _, ...rest } = prev; return rest; }); }} placeholder="Port-au-Prince" className={addressErrors.city ? inputErrorCls : inputCls} />
                  {addressErrors.city && <p className="text-[12px] text-[#ef4444] mt-1">{addressErrors.city}</p>}
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">State / Province</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="Ouest" className={inputCls} />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Postal Code</label>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="HT6110" className={inputCls} />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
                </div>
              </div>
              <Button size="lg" className="w-full mt-6" onClick={() => { if (validateAddress()) setStep(1); }}>
                Continue to Shipping <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Step 1: Shipping Method */}
          {step === 1 && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Shipping Method</h2>
              <div className="space-y-2.5">
                {shippingOptions.map((opt) => {
                  const isFree = opt.freeAbove && subtotal >= opt.freeAbove;
                  return (
                    <label key={opt.id} className={cn("flex items-center gap-3 p-4 rounded-[12px] border-[1.5px] cursor-pointer transition-colors", shippingMethod === opt.id ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e4e7eb] hover:border-[#2563eb]")}>
                      <input type="radio" name="shipping" value={opt.id} checked={shippingMethod === opt.id} onChange={() => setShippingMethod(opt.id)} className="accent-[#2563eb] w-[18px] h-[18px]" />
                      <Truck className="w-5 h-5 text-[#5b6472] shrink-0" />
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#16181d]">{opt.label}</div>
                        <div className="text-[12px] text-[#5b6472]">{opt.time}</div>
                      </div>
                      <span className="text-[14px] font-bold text-[#16181d]">{isFree ? "FREE" : `$${opt.price.toFixed(2)}`}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" size="lg" onClick={() => setStep(0)}>Back</Button>
                <Button size="lg" className="flex-1" onClick={() => setStep(2)}>
                  Continue to Payment <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Payment Method Selection */}
          {step === 2 && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Payment Method</h2>
              <div className="space-y-2.5">
                {visiblePaymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <label key={pm.id} className={cn("flex items-center gap-4 p-4 rounded-[14px] border-[1.5px] cursor-pointer transition-colors", paymentMethod === pm.id ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e4e7eb] hover:border-[#2563eb]")}>
                      <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id)} className="accent-[#2563eb] w-[18px] h-[18px]" />
                      <div className={cn("w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0", paymentMethod === pm.id ? "bg-[#2563eb] text-white" : "bg-[#f4f5f7] text-[#5b6472]")}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#16181d]">{pm.label}</div>
                        <div className="text-[12px] text-[#5b6472]">{pm.description}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <ShieldCheck className="w-4 h-4 text-[#16a34a] ml-auto" />
                        <span className="text-[10px] text-[#5b6472]">{pm.processing}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" className="flex-1" onClick={() => setStep(3)}>
                  Review Order <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <>
              <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Review Your Order</h2>
              <div className="space-y-4">
                <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                  <h4 className="text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Shipping To</h4>
                  <p className="text-[14px] font-semibold text-[#16181d]">{firstName} {lastName}</p>
                  <p className="text-[13px] text-[#5b6472]">{address}, {city} {postalCode}, {country}</p>
                  <p className="text-[13px] text-[#5b6472]">{email} · {phone}</p>
                </div>
                <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                  <h4 className="text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Shipping Method</h4>
                  <p className="text-[14px] font-semibold text-[#16181d]">{selectedShipping.label} — {shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}</p>
                </div>
                <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                  <h4 className="text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Payment Method</h4>
                  <p className="text-[14px] font-semibold text-[#16181d]">{paymentMethods.find((p) => p.id === paymentMethod)?.label}</p>
                </div>
                <div className="bg-[#f7f8fa] rounded-[12px] p-4">
                  <h4 className="text-[12px] font-bold text-[#9aa3ad] uppercase tracking-[.04em] mb-2">Items ({items.length})</h4>
                  {items.map((item) => (
                    <div key={item.variantId} className="flex justify-between text-[13px] py-1">
                      <span className="text-[#16181d]">{item.name} × {item.quantity}</span>
                      <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" size="lg" onClick={() => setStep(2)}>Back</Button>
                <Button size="lg" className="flex-1" onClick={() => setStep(4)}>
                  Confirm & Pay ${grandTotal.toFixed(2)} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 4: Confirm & Pay */}
          {step === 4 && (
            <>
              {intentError && (
                <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13px] text-[#ef4444] font-semibold mb-4">
                  {intentError}
                  <button type="button" onClick={() => { setClientSecret(null); setIntentError(null); }} className="ml-2 underline cursor-pointer">Retry</button>
                </div>
              )}

              {paymentMethod === "stripe" && (
                <>
                  {!clientSecret && !intentError && (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                      <span className="ml-3 text-[14px] text-[#5b6472]">Initializing secure payment...</span>
                    </div>
                  )}
                  {clientSecret && getStripePromise(publishableKey) && (
                    <Elements
                      key={clientSecret}
                      stripe={getStripePromise(publishableKey)!}
                      options={{ clientSecret, appearance: { theme: "stripe", variables: { borderRadius: "12px", fontFamily: "system-ui, sans-serif", colorPrimary: "#2563eb" } } }}
                    >
                      <StripePaymentForm onSuccess={handlePaymentSuccess} onBack={() => setStep(3)} totalAmount={grandTotal} />
                    </Elements>
                  )}
                  {clientSecret && !getStripePromise(publishableKey) && (
                    <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13px] text-[#ef4444] font-semibold">
                      Stripe publishable key is missing. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY on the server and restart.
                    </div>
                  )}
                </>
              )}

              {(paymentMethod === "moncash" || paymentMethod === "natcash") && (
                <MobilePaymentCard
                  gateway={paymentMethod}
                  phone={mobilePhone}
                  setPhone={setMobilePhone}
                  amount={grandTotal}
                  processing={processing}
                  onSubmit={() => handleMobilePayment(paymentMethod)}
                  onBack={() => setStep(3)}
                />
              )}

              {paymentMethod === "cod" && (
                <div className="space-y-5">
                  <h2 className="text-[18px] font-extrabold text-[#16181d]">Cash on Delivery</h2>
                  <div className="border border-[#eef0f3] rounded-[14px] p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Banknote className="w-6 h-6 text-[#16a34a]" />
                      <p className="text-[14px] font-semibold text-[#16181d]">Pay when you receive your order</p>
                    </div>
                    <p className="text-[13px] text-[#5b6472]">Our delivery agent will collect <span className="font-bold text-[#16181d]">${grandTotal.toFixed(2)}</span> upon delivery. Please have the exact amount ready.</p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-[#eff6ff] rounded-[10px]">
                    <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
                    <span className="text-[12px] text-[#1d4ed8] font-semibold">Inspect your order before paying</span>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="lg" onClick={() => setStep(3)} disabled={processing}>Back</Button>
                    <Button size="lg" className="flex-1" onClick={handleCodOrBank} disabled={processing}>
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : "Confirm Order"}
                    </Button>
                  </div>
                </div>
              )}

              {isCustomMethod && (
                <div className="space-y-5">
                  <h2 className="text-[18px] font-extrabold text-[#16181d]">{customMethods.find((m) => m.id === paymentMethod)?.label}</h2>
                  <div className="border border-[#eef0f3] rounded-[14px] p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Banknote className="w-6 h-6 text-[#16a34a]" />
                      <p className="text-[14px] font-semibold text-[#16181d]">{customMethods.find((m) => m.id === paymentMethod)?.description}</p>
                    </div>
                    <p className="text-[13px] text-[#5b6472]">
                      Your order of <span className="font-bold text-[#16181d]">${grandTotal.toFixed(2)}</span> will be placed and marked pending. Our team will confirm your payment and process the order.
                    </p>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#5b6472] block mb-1.5">Payment reference (optional)</label>
                    <input type="text" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="Transaction or receipt number" className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-[#eff6ff] rounded-[10px]">
                    <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
                    <span className="text-[12px] text-[#1d4ed8] font-semibold">Your order is confirmed only after payment verification</span>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="lg" onClick={() => setStep(3)} disabled={processing}>Back</Button>
                    <Button size="lg" className="flex-1" onClick={handleCustomManual} disabled={processing}>
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : "Place Order"}
                    </Button>
                  </div>
                </div>
              )}

              {paymentMethod === "bank_transfer" && (
                <div className="space-y-5">
                  <h2 className="text-[18px] font-extrabold text-[#16181d]">Bank Transfer</h2>
                  <div className="border border-[#eef0f3] rounded-[14px] p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-6 h-6 text-[#2563eb]" />
                      <p className="text-[14px] font-semibold text-[#16181d]">Transfer to our bank account</p>
                    </div>
                    <div className="bg-[#f7f8fa] rounded-[10px] p-3 space-y-1 text-[13px]">
                      <div className="flex justify-between"><span className="text-[#5b6472]">Bank</span><span className="font-semibold text-[#16181d]">Sogebank</span></div>
                      <div className="flex justify-between"><span className="text-[#5b6472]">Account</span><span className="font-semibold text-[#16181d]">XXXX-XXXX-XXXX</span></div>
                      <div className="flex justify-between"><span className="text-[#5b6472]">Amount</span><span className="font-bold text-[#16181d]">${grandTotal.toFixed(2)}</span></div>
                    </div>
                    <div>
                      <label className="text-[13px] font-semibold text-[#16181d] mb-1.5 block">Transfer Reference (optional)</label>
                      <input type="text" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="Your bank reference number" className={inputCls} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-[#fef3c7] rounded-[10px]">
                    <span className="text-[12px] text-[#92400e] font-semibold">Your order will be confirmed after we verify the transfer (1-2 business days).</span>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="lg" onClick={() => setStep(3)} disabled={processing}>Back</Button>
                    <Button size="lg" className="flex-1" onClick={handleCodOrBank} disabled={processing}>
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Order"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-[140px] self-start">
          <OrderSummary shippingCost={shippingCost} grandTotal={grandTotal} tax={taxPreview} />
        </div>
      </div>
    </div>
  );
}
