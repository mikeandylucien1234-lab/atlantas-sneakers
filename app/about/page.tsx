import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="max-w-[720px] mx-auto py-12 px-4">
      <h1 className="text-[32px] font-extrabold text-[#16181d] tracking-[-.02em]">About Atlanta Sneakers</h1>
      <p className="text-[15px] text-[#5b6472] mt-4 leading-[1.8]">
        Atlanta Sneakers is Haiti&apos;s premier destination for authentic sneakers, clothing, electronics, and lifestyle products. We bring the latest trends from global brands directly to you with fast, reliable shipping and 100% authentic guarantee.
      </p>
      <p className="text-[15px] text-[#5b6472] mt-4 leading-[1.8]">
        Founded with a mission to make premium products accessible across Haiti, we offer convenient payment options including MonCash, NatCash, bank transfer, and cash on delivery — designed for how Haitians shop.
      </p>
      <p className="text-[15px] text-[#5b6472] mt-4 leading-[1.8]">
        Our commitment: authentic products, fair prices, and exceptional customer service.
      </p>
      <div className="mt-8">
        <Link href="/shop" className="inline-flex h-[46px] items-center px-6 bg-[#2563eb] text-white font-bold text-[14px] rounded-[12px] hover:brightness-105 transition-all">
          Shop Now
        </Link>
      </div>
    </div>
  );
}
