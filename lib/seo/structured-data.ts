// Schema.org structured-data builders. Pure functions — reused by any page.

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantasneaker.com").replace(/\/$/, "");
}

export function buildBreadcrumb(items: { name: string; url: string }[]) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${base}${it.url}`,
    })),
  };
}

export function buildProductSchema(product: {
  name: string;
  slug: string;
  description?: string | null;
  price?: number | null;
  compare_price?: number | null;
  images?: string[] | null;
  brand?: { name?: string } | string | null;
  sku?: string | null;
  status?: string | null;
  averageRating?: number;
  reviewCount?: number;
  currency?: string;
}) {
  const base = siteBase();
  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.name;
  const inStock = product.status ? product.status === "active" : true;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: `${base}/product/${product.slug}`,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images && product.images.length ? { image: product.images } : {}),
    ...(brandName ? { brand: { "@type": "Brand", name: brandName } } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    offers: {
      "@type": "Offer",
      url: `${base}/product/${product.slug}`,
      priceCurrency: product.currency || "USD",
      price: Number(product.price || 0).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  if (product.reviewCount && product.reviewCount > 0 && product.averageRating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(product.averageRating).toFixed(1),
      reviewCount: product.reviewCount,
    };
  }

  return schema;
}

export function buildCollectionSchema(opts: { name: string; slug: string; kind: "category" | "brand"; description?: string | null }) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: `${base}/${opts.kind === "category" ? "category" : "brand"}/${opts.slug}`,
    ...(opts.description ? { description: opts.description } : {}),
    isPartOf: { "@type": "WebSite", name: "Atlanta Sneakers", url: base },
  };
}

export function buildBrandSchema(opts: { name: string; slug: string; description?: string | null; logo?: string | null }) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: opts.name,
    url: `${base}/brand/${opts.slug}`,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.logo ? { logo: opts.logo } : {}),
  };
}

export function buildArticleSchema(post: {
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  author?: string | null;
}) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    url: `${base}/blog/${post.slug}`,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.cover_image ? { image: [post.cover_image] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(post.updated_at ? { dateModified: post.updated_at } : {}),
    ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
    publisher: { "@type": "Organization", name: "Atlanta Sneakers", url: base },
  };
}
