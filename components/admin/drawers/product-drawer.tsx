"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { Product, Category, Brand, ProductVariant } from "@/types";

type VariantRow = { id?: string; size: string; color: string; stock: number; sku: string };

type Props = {
  dark: boolean;
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  categories: Category[];
  brands: Brand[];
};

export function ProductDrawer({ dark, product, open, onClose, onSave, categories, brands }: Props) {
  const isEdit = !!product;
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const inpCls = cn("w-full h-[46px] rounded-[11px] border-[1.5px] px-4 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [images, setImages] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"active" | "draft">("active");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description ?? "");
      setCategoryId(product.category_id ?? "");
      setBrandId(product.brand_id ?? "");
      setPrice(String(product.price));
      setComparePrice(product.compare_price ? String(product.compare_price) : "");
      setImages(product.images?.join(", ") ?? "");
      setTags(product.tags?.join(", ") ?? "");
      setStatus(product.status === "archived" ? "draft" : product.status);
      setIsFeatured(product.is_featured);
      setIsNew(product.is_new);
      setVariants((product.variants ?? []).map((v) => ({ id: v.id, size: v.size, color: v.color ?? "", stock: v.stock, sku: v.sku ?? "" })));
    } else {
      setName(""); setDescription(""); setCategoryId(""); setBrandId("");
      setPrice(""); setComparePrice(""); setImages(""); setTags("");
      setStatus("active"); setIsFeatured(false); setIsNew(false);
      setVariants([{ size: "", color: "", stock: 0, sku: "" }]);
    }
  }, [product]);

  const handleSave = async () => {
    if (!name || !price) return;
    setSaving(true);
    const supabase = createClient();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const payload = {
      name, slug, description: description || null,
      category_id: categoryId || null, brand_id: brandId || null,
      price: Number(price), compare_price: comparePrice ? Number(comparePrice) : null,
      images: images ? images.split(",").map((s) => s.trim()).filter(Boolean) : [],
      tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      status, is_featured: isFeatured, is_new: isNew,
    };

    let productId = product?.id;
    if (isEdit && productId) {
      await supabase.from("products").update(payload).eq("id", productId);
    } else {
      const { data } = await supabase.from("products").insert(payload).select("id").single();
      productId = data?.id;
    }

    if (productId) {
      if (isEdit) await supabase.from("product_variants").delete().eq("product_id", productId);
      const validVariants = variants.filter((v) => v.size);
      if (validVariants.length > 0) {
        await supabase.from("product_variants").insert(
          validVariants.map((v) => ({ product_id: productId, size: v.size, color: v.color || null, stock: v.stock, sku: v.sku || null }))
        );
      }
    }

    setSaving(false);
    onSave();
  };

  const addVariant = () => setVariants([...variants, { size: "", color: "", stock: 0, sku: "" }]);
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof VariantRow, value: string | number) => {
    const updated = [...variants];
    (updated[i] as Record<string, string | number>)[field] = value;
    setVariants(updated);
  };

  return (
    <Drawer open={open} onClose={onClose} title={isEdit ? "Edit Product" : "Add Product"} className="max-w-xl">
      <div className="space-y-4 pb-20">
        <div>
          <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Product Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inpCls} placeholder="Air Max 90" />
        </div>
        <div>
          <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(inpCls, "h-auto py-3")} placeholder="Product description..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inpCls}>
              <option value="">Select...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Brand</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inpCls}>
              <option value="">Select...</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Price *</label>
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inpCls} placeholder="0.00" />
          </div>
          <div>
            <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Compare-at Price</label>
            <input type="number" step="0.01" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} className={inpCls} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Image URLs (comma separated)</label>
          <input value={images} onChange={(e) => setImages(e.target.value)} className={inpCls} placeholder="https://..." />
        </div>
        <div>
          <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={inpCls} placeholder="running, lifestyle" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={status === "active"} onChange={(e) => setStatus(e.target.checked ? "active" : "draft")} className="rounded" />
            <span className={cn("text-sm font-semibold", txt)}>Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
            <span className={cn("text-sm font-semibold", txt)}>Featured</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="rounded" />
            <span className={cn("text-sm font-semibold", txt)}>New</span>
          </label>
        </div>

        {/* Variants */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={cn("text-sm font-bold", txt)}>Variants</label>
            <button onClick={addVariant} className="text-[#2563eb] text-xs font-semibold flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className={cn("border rounded-[12px] overflow-hidden", brd)}>
            <table className="w-full text-sm">
              <thead><tr className={cn("border-b", brd)}>
                <th className={cn("text-left p-2 text-[11px] font-bold uppercase", sub)}>Size</th>
                <th className={cn("text-left p-2 text-[11px] font-bold uppercase", sub)}>Color</th>
                <th className={cn("text-left p-2 text-[11px] font-bold uppercase", sub)}>Stock</th>
                <th className={cn("text-left p-2 text-[11px] font-bold uppercase", sub)}>SKU</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} className={cn("border-b last:border-0", brd)}>
                    <td className="p-2"><input value={v.size} onChange={(e) => updateVariant(i, "size", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-xs", inp)} placeholder="US 10" /></td>
                    <td className="p-2"><input value={v.color} onChange={(e) => updateVariant(i, "color", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-xs", inp)} placeholder="Black" /></td>
                    <td className="p-2"><input type="number" value={v.stock} onChange={(e) => updateVariant(i, "stock", Number(e.target.value))} className={cn("w-full h-8 rounded-lg border px-2 text-xs", inp)} /></td>
                    <td className="p-2"><input value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-xs", inp)} placeholder="SKU-001" /></td>
                    <td className="p-2"><button onClick={() => removeVariant(i)} className="text-[#ef4444] hover:bg-[#ef4444]/10 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className={cn("absolute bottom-0 left-0 right-0 p-4 border-t", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
        <button onClick={handleSave} disabled={saving || !name || !price} className="w-full h-[46px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">
          {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
        </button>
      </div>
    </Drawer>
  );
}
