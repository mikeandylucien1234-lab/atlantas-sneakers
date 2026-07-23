import Link from "next/link";

// Minimalist legal/info note (replaces the TrustBadges row).
export function InfoDisclosure() {
  return (
    <section className="mt-10 mb-2">
      <p className="max-w-[680px] text-[14px] leading-[1.65] text-[#6b7280]">
        Atlanta Sneakers only sells 100% authentic products sourced from authorized
        suppliers and brand partners. Prices, availability, taxes and delivery times may
        vary by region and are always confirmed at checkout. All payments are processed
        securely through our certified payment partners — Atlanta Sneakers never stores
        your full card details.
      </p>
      <Link
        href="/about"
        className="mt-4 inline-block text-[15px] font-bold text-[#2563eb] underline underline-offset-4 decoration-2 hover:text-[#1d4ed8]"
      >
        Terms &amp; Conditions
      </Link>
    </section>
  );
}
