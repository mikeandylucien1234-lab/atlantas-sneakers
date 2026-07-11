"use client";

import { useState, useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { getProductBySlug, getRelatedProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { JsonLd } from "@/components/seo/json-ld";
import { buildProductSchema, buildBreadcrumb } from "@/lib/seo/structured-data";

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

  const { data: product, loading } = useQuery(() => getProductBySlug(slug), [slug]);
  const { data: related } = useQuery(
    () => product ? getRelatedProducts(product.id, product.category_id) : Promise.resolve([]),
    [product?.id]
  );

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const isWishlisted = useWishlistStore((s) => product ? s.isInWishlist(product.id) : false);

  const sizes = useMemo(() => {
    if (!product?.variants) return [];
    return [...new Set(product.variants.map((v) => v.size))].sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [product?.variants]);

  const colors = useMemo(() => {
    if (!product?.variants) return [];
    const seen = new Map<string, string>();
    for (const v of product.variants) {
      if (v.color && !seen.has(v.color)) seen.set(v.color, v.color_hex ?? "#333");
    }
    return Array.from(seen, ([name, hex]) => ({ name, hex }));
  }, [product?.variants]);

  const images = product?.images?.length ? product.images : ["/placeholder.svg"];

  const avgRating = useMemo(() => {
    if (!product?.reviews?.length) return 0;
    return product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
  }, [product?.reviews]);

  if (loading) {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton variant="image" className="aspect-square rounded-[18px]" />
          <div className="space-y-4">
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton variant="text" className="w-3/4 h-8" />
            <Skeleton variant="text" className="w-1/3 h-6" />
            <Skeleton variant="text" className="w-full h-20" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mt-4 text-center py-16">
        <h2 className="text-[22px] font-extrabold text-[#16181d]">Product not found</h2>
        <Link href="/shop" className="text-[14px] font-bold text-[#2563eb] hover:underline mt-2 inline-block">Back to Shop</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) return;
    const variant = product.variants?.find((v) => v.size === selectedSize && (!selectedColor || v.color === selectedColor));
    addItem({
      productId: product.id,
      variantId: variant?.id ?? `${product.id}-${selectedSize}`,
      name: product.name,
      image: images[0],
      price: Number(product.price),
      comparePrice: product.compare_price ? Number(product.compare_price) : null,
      size: selectedSize,
      color: selectedColor,
      quantity,
    });
  };

  return (
    <div className="mt-4">
      <JsonLd data={[
        buildProductSchema({
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: Number(product.price),
          compare_price: product.compare_price ? Number(product.compare_price) : null,
          images: product.images,
          brand: product.brand,
          sku: (product as { sku?: string }).sku ?? null,
          status: product.status,
          averageRating: (product as { averageRating?: number }).averageRating,
          reviewCount: (product as { reviewCount?: number }).reviewCount,
        }),
        buildBreadcrumb([
          { name: "Home", url: "/" },
          { name: "Shop", url: "/shop" },
          { name: product.name, url: `/product/${product.slug}` },
        ]),
      ]} />
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-5">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#2563eb] transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-[#f4f5f7] rounded-[18px] overflow-hidden relative">
            <Image src={images[selectedImage]} alt={product.name} fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" priority />
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.is_new && <Badge variant="new">New</Badge>}
              {product.compare_price && (
                <Badge variant="sale">-{Math.round(((Number(product.compare_price) - Number(product.price)) / Number(product.compare_price)) * 100)}%</Badge>
              )}
            </div>
          </div>
          {images.length > 1 && (
            <div className="flex gap-[10px] mt-3">
              {images.map((img, i) => (
                <button key={i} type="button" onClick={() => setSelectedImage(i)}
                  className={cn("w-[72px] h-[72px] rounded-[12px] overflow-hidden border-2 transition-all duration-150 cursor-pointer bg-[#f4f5f7] relative",
                    i === selectedImage ? "border-[#2563eb]" : "border-transparent hover:border-[#e4e7eb]"
                  )}
                >
                  <Image src={img} alt="" fill className="object-cover" sizes="72px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-[13px] font-semibold text-[#2563eb] uppercase tracking-[.06em]">{product.brand?.name}</p>
          <h1 className="text-[30px] font-extrabold text-[#16181d] tracking-[-.02em] mt-1 leading-[1.15]">{product.name}</h1>

          {product.reviews && product.reviews.length > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <Rating value={avgRating} />
              <span className="text-[13px] font-semibold text-[#16181d]">{avgRating.toFixed(1)}</span>
              <span className="text-[13px] text-[#9aa3ad]">({product.reviews.length} reviews)</span>
            </div>
          )}

          <div className="mt-4">
            <PriceDisplay price={Number(product.price)} comparePrice={product.compare_price ? Number(product.compare_price) : undefined} size="lg" />
          </div>

          {product.description && (
            <p className="text-[14px] text-[#5b6472] leading-[1.7] mt-4">{product.description}</p>
          )}

          {/* Color */}
          {colors.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-bold text-[#16181d]">Color</span>
                <span className="text-[13px] text-[#9aa3ad]">{selectedColor ?? colors[0].name}</span>
              </div>
              <div className="flex gap-[10px]">
                {colors.map((c) => (
                  <button key={c.name} type="button" title={c.name} onClick={() => setSelectedColor(c.name)}
                    className={cn("w-[52px] h-[52px] rounded-[13px] border-2 transition-all duration-150 cursor-pointer",
                      (selectedColor ?? colors[0].name) === c.name ? "border-[#2563eb] scale-105" : "border-[#e4e7eb] hover:border-[#9aa3ad]"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-bold text-[#16181d]">Size</span>
                <button type="button" className="text-[13px] text-[#2563eb] font-semibold cursor-pointer hover:underline">Size Guide</button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-[8px]">
                {sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setSelectedSize(s)}
                    className={cn("h-[48px] rounded-[12px] border text-[14px] font-semibold transition-all duration-150 cursor-pointer",
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
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <Button size="lg" className="flex-1" onClick={handleAddToCart} disabled={!selectedSize}>
              <ShoppingCart className="w-[18px] h-[18px]" />
              Add to Cart
            </Button>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button type="button"
              onClick={() => toggleWishlist({ id: crypto.randomUUID(), productId: product.id, name: product.name, image: images[0], price: Number(product.price) })}
              className={cn("flex items-center gap-2 text-[13px] font-semibold cursor-pointer transition-colors",
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
          <p>{product.description}</p>
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {product.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-[#f4f5f7] rounded-full text-[12px] font-semibold text-[#5b6472]">{tag}</span>
              ))}
            </div>
          )}
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
      {product.reviews && product.reviews.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[21px] font-extrabold text-[#16181d] tracking-[-.01em]">Customer Reviews</h2>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 mt-5">
            <div className="bg-[#f7f8fa] rounded-[16px] p-5 text-center">
              <div className="text-[48px] font-extrabold text-[#16181d] leading-none">{avgRating.toFixed(1)}</div>
              <Rating value={avgRating} className="justify-center mt-2" />
              <p className="text-[13px] text-[#9aa3ad] mt-1">Based on {product.reviews.length} reviews</p>
            </div>
            <div className="space-y-5">
              {product.reviews.map((r) => (
                <div key={r.id} className="border border-[#eef0f3] rounded-[14px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-[36px] h-[36px] rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[14px] font-bold">
                      {(r.profile?.full_name ?? "U")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-[#16181d]">{r.profile?.full_name ?? "User"}</div>
                      <div className="text-[12px] text-[#9aa3ad]">{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <Rating value={r.rating} size={14} />
                  </div>
                  {r.title && <h4 className="text-[14px] font-bold text-[#16181d] mt-3">{r.title}</h4>}
                  {r.comment && <p className="text-[13px] text-[#5b6472] leading-[1.6] mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Related Products */}
      {related && related.length > 0 && (
        <div className="mt-10 mb-6">
          <h2 className="text-[21px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[14px]">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                brand={p.brand?.name ?? ""}
                price={Number(p.price)}
                comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                image={p.images?.[0] ?? "/placeholder.svg"}
                isNew={p.is_new}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
