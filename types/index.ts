export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "customer" | "admin";
  points: number;
  created_at: string;
};

export type Address = {
  full_name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  price: number;
  compare_price: number | null;
  images: string[];
  tags: string[];
  is_featured: boolean;
  is_new: boolean;
  status: "active" | "draft" | "archived";
  created_at: string;
  brand?: Brand;
  category?: Category;
  variants?: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  product_id: string;
  size: string;
  color: string | null;
  color_hex: string | null;
  stock: number;
  sku: string | null;
  created_at: string;
};

export type CartItem = {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  image: string;
  price: number;
  comparePrice: number | null;
  size: string;
  color: string | null;
  quantity: number;
};

export type WishlistItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  subtotal: number;
  shipping_cost: number;
  discount: number;
  total: number;
  shipping_address: Address | null;
  created_at: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price: number;
  created_at: string;
  product?: Product;
  variant?: ProductVariant;
};

export type Review = {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  profile?: Profile;
};

export type Coupon = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_order: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type FlashDeal = {
  id: string;
  product_id: string;
  deal_price: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  product?: Product;
};
