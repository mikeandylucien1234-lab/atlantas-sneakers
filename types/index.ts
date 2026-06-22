export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  brand: string;
  sizes: number[];
  stock: number;
  created_at: string;
};

export type CartItem = {
  product: Product;
  size: number;
  quantity: number;
};
