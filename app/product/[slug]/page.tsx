"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart, Share2, ShoppingCart, ChevronDown, Truck, Shield, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { PriceDisplay } from "@/components/ui/price-display";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { ProductCard } from "@/components/ui/product-card";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";

const productData = {
  id: "p1",
  name: "Air Jordan 1 Retro High OG",
  brand: "Jordan",
  price: 159.99,
  comparePrice: 189.99,
  description: "The Air Jordan 1 Retro High OG delivers the classic silhouette that started it all. With premium leather, iconic Wings logo, and the original colorway, this shoe is a must-have for any sneakerhead.",
  images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
  sizes: ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
  colors: [
    { name: "Chicago", hex: "#ef4444" },
    { name: "Royal Blue", hex: "#2563eb" },
    { name: "Shadow", hex: "#6b7280" },
    { name: "Bred", hex: "#000000" },
  ],
  rating: 4.8,
  reviewCount: 247,
  isNew: true,
};

const reviews = [
  { id: "r1", author: "Michael T.", avatar: "M", rating: 5, date: "2 weeks ago", title: "Perfect fit and quality!", comment: "These are hands down the best Jordans I've ever owned. The leather quality is top-notch, and they fit perfectly true to size. The Chicago colorway is iconic and looks even better in person." },
  { id: "r2", author: "Sarah K.", avatar: "S", rating: 4, date: "1 month ago", title: "Great shoes, sizing runs slightly big", comment: "Love the design and comfort. Only gripe is they run about half a size big. Would recommend sizing down." },
  { id: "r3", author: "James L.", avatar: "J", rating: 5, date: "1 month ago", title: "Classic never goes out of style", comment: "You can never go wrong with AJ1 Highs. Build quality is excellent and they break in nicely." },
];

const ratingDistribution = [
  { stars: 5, percentage: 72 },
  { stars: 4, percentage: 18 },
  { stars: 3, percentage: 6 },
  { stars: 2, percentage: 3 },
  { stars: 1, percentage: 1 },
];

const alsoLike = [
  { id: "a1", slug: "nike-dunk-low", name: "Nike Dunk Low Retro", brand: "Nike", price: 109.99, image: "/placeholder.svg", isNew: true },
  { id: "a2", slug: "jordan-4-retro", name: "Jordan 4 Retro", brand: "Jordan", price: 199.99, comparePrice: 219.99, image: "/placeholder.svg" },
  { id: "a3", slug: "nike-air-max-90", name: "Nike Air Max 90", brand: "Nike", price: 129.99, image: "/placeholder.svg", isFeatured: true },
  { id: "a4", slug: "jordan-3-retro", name: "Jordan 3 Retro", brand: "Jordan", price: 179.99, image: "/placeholder.svg" },
  { id: "a5", slug: "nike-air-force-1", name: "Nike Air Force 1 '07", brand: "Nike", price: 109.99, image: "/placeholder.svg" },
];

type AccordionItemProps = { title: string; children: React.ReactNode; defaultOpen?: boolean };

function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#eef0f3] rounded-[18px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-[15px] font-bold text-[#16181d]">{title}</span>
        <ChevronDown className={cn("w-[18px] h-[18px] text-[#9aa3ad] transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="px-5 pb-4 text-[13px] text-[#5b6472] leading-[1.7]">{children}</div>}
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const product = productData;

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(product.colors[0].name);
  const [quantity, setQuantity] = useState(1);

  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const isWishlisted = useWishlistStore((s) => s.isInWishlist(product.id));

  const handleAddToCart = () => {
    if (!selectedSize) return;
    addItem({
      productId: product.id,
      variantId: `${product.id}-${selectedSize}-${selectedColor}`,
      name: product.name,
      image: product.images[0],
      price: product.price,
      comparePrice: product.comparePrice ?? null,
      size: selectedSize,
      color: selectedColor,
      quantity,
    });
  };

  return (
    <div className="mt-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-5">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#2563eb] transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">{product.name}</span>
      </div>

      {/* Product Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-[#f4f5f7] rounded-[18px] overflow-hidden relative">
            <Image
              src={product.images[selectedImage]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 50vw"
              priority
            />
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.isNew && <Badge variant="new">New</Badge>}
              {product.comparePrice && (
                <Badge variant="sale">-{Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-[10px] mt-3">
            {product.images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedImage(i)}
                className={cn(
                  "w-[72px] h-[72px] rounded-[12px] overflow-hidden border-2 transition-all duration-150 cursor-pointer bg-[#f4f5f7] relative",
                  i === selectedImage ? "border-[#2563eb]" : "border-transparent hover:border-[#e4e7eb]"
                )}
              >
                <Image src={img} alt="" fill className="object-cover" sizes="72px" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="text-[13px] font-semibold text-[#2563eb] uppercase tracking-[.06em]">{product.brand}</p>
          <h1 className="text-[30px] font-extrabold text-[#16181d] tracking-[-.02em] mt-1 leading-[1.15]">{product.name}</h1>

          <div className="flex items-center gap-3 mt-3">
            <Rating value={product.rating} />
            <span className="text-[13px] font-semibold text-[#16181d]">{product.rating}</span>
            <span className="text-[13px] text-[#9aa3ad]">({product.reviewCount} reviews)</span>
          </div>

          <div className="mt-4">
            <PriceDisplay price={product.price} comparePrice={product.comparePrice} size="lg" />
          </div>

          <p className="text-[14px] text-[#5b6472] leading-[1.7] mt-4">{product.description}</p>

          {/* Color */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold text-[#16181d]">Color</span>
              <span className="text-[13px] text-[#9aa3ad]">{selectedColor}</span>
            </div>
            <div className="flex gap-[10px]">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onClick={() => setSelectedColor(c.name)}
                  className={cn(
                    "w-[52px] h-[52px] rounded-[13px] border-2 transition-all duration-150 cursor-pointer",
                    selectedColor === c.name ? "border-[#2563eb] scale-105" : "border-[#e4e7eb] hover:border-[#9aa3ad]"
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold text-[#16181d]">Size</span>
              <button type="button" className="text-[13px] text-[#2563eb] font-semibold cursor-pointer hover:underline">Size Guide</button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-[8px]">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={cn(
                    "h-[48px] rounded-[12px] border text-[14px] font-semibold transition-all duration-150 cursor-pointer",
                    selectedSize === s
                      ? "border-[#2563eb] bg-[#2563eb] text-white"
                      : "border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Actions */}
          <div className="mt-6 flex items-center gap-3">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <Button size="lg" className="flex-1" onClick={handleAddToCart} disabled={!selectedSize}>
              <ShoppingCart className="w-[18px] h-[18px]" />
              Add to Cart
            </Button>
          </div>

          <Button variant="secondary" size="lg" className="w-full mt-3 shadow-[0_10px_22px_rgba(37,99,235,.3)]" onClick={handleAddToCart} disabled={!selectedSize}>
            Buy Now
          </Button>

          <div className="flex items-center gap-4 mt-4">
            <button
              type="button"
              onClick={() => toggleWishlist({ id: crypto.randomUUID(), productId: product.id, name: product.name, image: product.images[0], price: product.price })}
              className={cn(
                "flex items-center gap-2 text-[13px] font-semibold cursor-pointer transition-colors",
                isWishlisted ? "text-[#ef4444]" : "text-[#5b6472] hover:text-[#ef4444]"
              )}
            >
              <Heart className={cn("w-[18px] h-[18px]", isWishlisted && "fill-current")} />
              {isWishlisted ? "In Wishlist" : "Add to Wishlist"}
            </button>
            <button type="button" className="flex items-center gap-2 text-[13px] font-semibold text-[#5b6472] hover:text-[#16181d] cursor-pointer transition-colors">
              <Share2 className="w-[18px] h-[18px]" />
              Share
            </button>
          </div>

          {/* Trust icons */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#eef0f3]">
            <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
              <Truck className="w-[18px] h-[18px] text-[#2563eb] shrink-0" />
              Free Shipping
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
              <Shield className="w-[18px] h-[18px] text-[#2563eb] shrink-0" />
              100% Authentic
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#5b6472]">
              <RefreshCw className="w-[18px] h-[18px] text-[#2563eb] shrink-0" />
              Easy Returns
            </div>
          </div>
        </div>
      </div>

      {/* Accordion */}
      <div className="grid gap-3 mt-10">
        <AccordionItem title="Product Details" defaultOpen>
          <ul className="list-disc pl-4 space-y-1">
            <li>Premium leather upper for durability and support</li>
            <li>Air-Sole unit in the heel for cushioning</li>
            <li>Rubber outsole with pivot circle pattern for traction</li>
            <li>Perforated toe box for breathability</li>
            <li>Wings logo on the collar</li>
            <li>Style: 555088-170</li>
          </ul>
        </AccordionItem>
        <AccordionItem title="Shipping & Returns">
          <p>Free standard shipping on orders over $100. Express shipping available at checkout.</p>
          <p className="mt-2">30-day return policy. Items must be unworn and in original packaging.</p>
        </AccordionItem>
        <AccordionItem title="Size Guide">
          <p>This shoe fits true to size. If you&apos;re between sizes, we recommend going half a size up for a more comfortable fit.</p>
        </AccordionItem>
      </div>

      {/* Reviews */}
      <div className="mt-10">
        <h2 className="text-[21px] font-extrabold text-[#16181d] tracking-[-.01em]">Customer Reviews</h2>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 mt-5">
          {/* Summary */}
          <div className="bg-[#f7f8fa] rounded-[16px] p-5 text-center">
            <div className="text-[48px] font-extrabold text-[#16181d] leading-none">{product.rating}</div>
            <Rating value={product.rating} className="justify-center mt-2" />
            <p className="text-[13px] text-[#9aa3ad] mt-1">Based on {product.reviewCount} reviews</p>
            <div className="mt-4 space-y-2">
              {ratingDistribution.map((r) => (
                <div key={r.stars} className="flex items-center gap-2">
                  <span className="text-[12px] text-[#5b6472] w-3">{r.stars}</span>
                  <Star className="w-[12px] h-[12px] fill-[#f59e0b] text-[#f59e0b]" />
                  <div className="flex-1 h-[6px] bg-[#eef0f3] rounded-full overflow-hidden">
                    <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="text-[12px] text-[#9aa3ad] w-8 text-right">{r.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review list */}
          <div className="space-y-5">
            {reviews.map((r) => (
              <div key={r.id} className="border border-[#eef0f3] rounded-[14px] p-5">
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[14px] font-bold">
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-[#16181d]">{r.author}</div>
                    <div className="text-[12px] text-[#9aa3ad]">{r.date}</div>
                  </div>
                  <Rating value={r.rating} size={14} />
                </div>
                <h4 className="text-[14px] font-bold text-[#16181d] mt-3">{r.title}</h4>
                <p className="text-[13px] text-[#5b6472] leading-[1.6] mt-1">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* You May Also Like */}
      <div className="mt-10 mb-6">
        <h2 className="text-[21px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">You May Also Like</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[14px]">
          {alsoLike.map((p) => (
            <ProductCard key={p.id} {...p} />
          ))}
        </div>
      </div>
    </div>
  );
}
