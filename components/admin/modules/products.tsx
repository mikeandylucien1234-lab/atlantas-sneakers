"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2 } from "lucide-react";
import { ProductDrawer } from "@/components/admin/drawers/product-drawer";
import type { Product, Category, Brand } from "@/types";

const PER_PAGE = 10;

type Props = { dark: boolean };

export function AdminProducts({ dark }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [drawerProduct, setDrawerProduct] = useState<Product | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [{ data: prods, error: e1 }, { data: cats, error: e2 }, { data: brs, error: e3 }] = await Promise.all([
        supabase.from("products").select("*, brand:brands(*), category:categories(*), variants:product_variants(*)").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase.from("brands").select("*").order("name"),
      ]);
      if (e1) throw new Error(e1.message);
      setProducts((prods as Product[]) ?? []);
      setCategories((cats as Category[]) ?? []);
      setBrands((brs as Brand[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = products.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeCount = products.filter((p) => p.status === "active").length;
  const draftCount = products.filter((p) => p.status === "draft").length;
  const lowStock = products.filter((p) => (p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0) < 5).length;

  const kpis = [
    { label: "Total Products", value: String(products.length) },
    { label: "Active", value: String(activeCount) },
    { label: "Draft", value: String(draftCount) },
    { label: "Low Stock", value: String(lowStock) },
  ];

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      const supabase = createClient();
      await supabase.from("product_variants").delete().eq("product_id", id);
      const { error: err } = await supabase.from("products").delete().eq("id", id);
      if (err) throw new Error(err.message);
      fetchAll();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete product");
    }
  };

  const totalStock = (p: Product) => p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4", p, brd)}>
            <p className={cn("text-[22px] font-extrabold", txt)}>{k.value}</p>
            <p className={cn("text-[12px] font-semibold mt-1", sub)}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[200px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search products..." className="bg-transparent outline-none w-full text-sm" />
          </div>
          <div className="flex gap-2">
            {["all", "active", "draft"].map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors", statusFilter === s ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f6f8fb] text-[#8a929c]")}>{s}</button>
            ))}
          </div>
          <button onClick={() => setDrawerProduct(null)} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={fetchAll} className="ml-3 underline">Retry</button>
        </div>
      )}

      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={() => selected.size === paginated.length ? setSelected(new Set()) : setSelected(new Set(paginated.map((p) => p.id)))} className="rounded" /></th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Product</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Category</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Price</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Stock</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((prod) => (
                    <tr key={prod.id} className={cn("border-b last:border-0 transition-colors", brd, dark ? "hover:bg-white/[.03]" : "hover:bg-black/[.02]")}>
                      <td className="p-3"><input type="checkbox" checked={selected.has(prod.id)} onChange={() => { const n = new Set(selected); n.has(prod.id) ? n.delete(prod.id) : n.add(prod.id); setSelected(n); }} className="rounded" /></td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-lg shrink-0 overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            {prod.images?.[0] ? <img src={prod.images[0]} alt="" className="w-10 h-10 object-cover" /> : <div className={cn("w-full h-full flex items-center justify-center text-xs", sub)}>IMG</div>}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-semibold truncate", txt)}>{prod.name}</p>
                            <p className={cn("text-xs truncate", sub)}>{prod.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("p-3 text-sm hidden md:table-cell", sub)}>{prod.category?.name ?? "—"}</td>
                      <td className={cn("p-3 text-sm font-bold", txt)}>${prod.price.toFixed(2)}</td>
                      <td className={cn("p-3 text-sm hidden md:table-cell", totalStock(prod) < 5 ? "text-[#ef4444] font-bold" : sub)}>{totalStock(prod)}</td>
                      <td className="p-3">
                        <span className={cn("inline-block px-2.5 py-1 rounded-md text-[11px] font-bold capitalize", prod.status === "active" ? "bg-[#e8f7ee] text-[#16a34a]" : "bg-[#eef1f5] text-[#6b7280]")}>{prod.status}</span>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => setDrawerProduct(prod)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(prod.id)} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors ml-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && <tr><td colSpan={7} className={cn("p-8 text-center text-sm", sub)}>No products found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-xs", sub)}>{filtered.length} product{filtered.length !== 1 ? "s" : ""} · Page {page}/{totalPages}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerProduct !== undefined && (
        <ProductDrawer
          dark={dark}
          product={drawerProduct}
          open
          onClose={() => setDrawerProduct(undefined)}
          onSave={() => { setDrawerProduct(undefined); fetchAll(); }}
          categories={categories}
          brands={brands}
        />
      )}
    </div>
  );
}
