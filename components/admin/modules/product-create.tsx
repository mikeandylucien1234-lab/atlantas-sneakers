"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronDown, ChevronUp, Save, Send, ArrowLeft, Loader2, Plus, X,
  Package, Image as ImageIcon, DollarSign, Tag, Search, FileText,
  Truck, Shield, Zap, Eye, Globe, Layers, AlertTriangle, CheckCircle2,
  Star, BarChart3, Link2, Hash, Percent, Clock, Box, Palette,
  Upload, ChevronLeft, ChevronRight, Link as LinkIcon
} from "lucide-react";

type Props = { dark: boolean; onBack: () => void; editProductId?: string | null };

type VariantRow = {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  sku: string;
};

interface FormState {
  name: string;
  slug: string;
  description: string;
  brand_id: string;
  category_id: string;
  price: number;
  compare_price: number;
  images: string[];
  tags: string[];
  is_featured: boolean;
  is_new: boolean;
  status: "active" | "draft" | "archived";
  variants: VariantRow[];
  // SEO
  meta_title: string;
  meta_description: string;
  // Shipping
  free_shipping: boolean;
  shipping_cost: number;
  weight: number;
  // Flash deal
  flash_deal: boolean;
  flash_deal_price: number;
  flash_deal_ends: string;
}

const defaultForm: FormState = {
  name: "", slug: "", description: "", brand_id: "", category_id: "",
  price: 0, compare_price: 0, images: [], tags: [], is_featured: false,
  is_new: false, status: "draft", variants: [],
  meta_title: "", meta_description: "",
  free_shipping: false, shipping_cost: 0, weight: 0,
  flash_deal: false, flash_deal_price: 0, flash_deal_ends: "",
};

function slugify(t: string) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}

export function ProductCreate({ dark, onBack, editProductId }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-xs font-semibold block mb-1.5", sub);
  const cardCls = cn("rounded-[16px] border overflow-hidden", p, brd);

  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const [sections, setSections] = useState<Record<string, boolean>>({
    info: true, media: true, pricing: true, variants: true,
    seo: false, shipping: false, flash: false, visibility: true,
  });

  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [existingDealId, setExistingDealId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  // Auto slug
  useEffect(() => {
    if (!editProductId && form.name) set("slug", slugify(form.name));
  }, [form.name]);

  // Load filter options
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetch("/api/admin/categories?section=list&per_page=200"),
          fetch("/api/admin/brands?section=list&per_page=200"),
        ]);
        if (catRes.ok) {
          const d = await catRes.json();
          setCategories((d.categories || []).map((c: Record<string, string>) => ({ id: c.id, name: c.name })));
        }
        if (brandRes.ok) {
          const d = await brandRes.json();
          setBrands((d.brands || []).map((b: Record<string, string>) => ({ id: b.id, name: b.name })));
        }
      } catch { /* silent */ }
    };
    load();
  }, []);

  // Load product for edit
  useEffect(() => {
    if (!editProductId) return;
    setLoadingEdit(true);
    fetch(`/api/admin/products?section=detail&id=${editProductId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.error || !data.id) return;
        const pr = data;
        const activeDeal = (pr.flash_deals || []).find((d: { is_active: boolean; ends_at: string }) => d.is_active && new Date(d.ends_at) > new Date());
        setExistingDealId(activeDeal?.id || null);
        setForm({
          name: pr.name || "",
          slug: pr.slug || "",
          description: pr.description || "",
          brand_id: pr.brand_id || "",
          category_id: pr.category_id || "",
          price: pr.price || 0,
          compare_price: pr.compare_price || 0,
          images: pr.images || [],
          tags: pr.tags || [],
          is_featured: pr.is_featured || false,
          is_new: pr.is_new || false,
          status: pr.status || "draft",
          variants: (pr.variants || []).map((v: VariantRow) => ({
            id: v.id, size: v.size || "", color: v.color || "",
            color_hex: v.color_hex || "#000000", stock: v.stock || 0, sku: v.sku || "",
          })),
          meta_title: pr.meta_title || "",
          meta_description: pr.meta_description || "",
          free_shipping: pr.free_shipping || false,
          shipping_cost: Number(pr.shipping_cost) || 0,
          weight: Number(pr.weight) || 0,
          flash_deal: !!activeDeal,
          flash_deal_price: activeDeal ? Number(activeDeal.deal_price) || 0 : 0,
          flash_deal_ends: activeDeal?.ends_at ? new Date(activeDeal.ends_at).toISOString().slice(0, 16) : "",
        });
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false));
  }, [editProductId]);

  // Validation
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Product name is required";
    if (form.price <= 0) errs.price = "Price must be greater than 0";
    if (!form.category_id) errs.category_id = "Category is required";
    if (form.images.length === 0) errs.images = "At least one image is required";
    if (form.variants.length > 0) {
      const emptySkus = form.variants.some(v => !v.sku.trim());
      if (emptySkus) errs.variants = "All variants must have a SKU";
    }
    if (form.flash_deal) {
      if (form.flash_deal_price <= 0) errs.flash_deal_price = "Flash deal price required";
      if (form.flash_deal_price >= form.price) errs.flash_deal_price = "Must be less than regular price";
      if (!form.flash_deal_ends) errs.flash_deal_ends = "End date required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Progress
  const progress = useMemo(() => {
    let filled = 0;
    let total = 6;
    if (form.name.trim()) filled++;
    if (form.price > 0) filled++;
    if (form.category_id) filled++;
    if (form.images.length > 0) filled++;
    if (form.description.trim()) filled++;
    if (form.variants.length > 0) filled++;
    return Math.round((filled / total) * 100);
  }, [form]);

  // Save
  const handleSave = async (publish: boolean) => {
    if (publish && !validate()) {
      showToast("Please fix the errors before publishing", "error");
      return;
    }

    setSaving(true);
    try {
      const productData: Record<string, unknown> = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        price: form.price,
        compare_price: form.compare_price || null,
        images: form.images,
        tags: form.tags,
        is_featured: form.is_featured,
        is_new: form.is_new,
        status: publish ? "active" : form.status,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        weight: form.weight || 0,
        free_shipping: form.free_shipping,
        shipping_cost: form.free_shipping ? 0 : form.shipping_cost || 0,
      };

      const body: Record<string, unknown> = { ...productData, variants: form.variants.map(v => ({ size: v.size, color: v.color, color_hex: v.color_hex, stock: v.stock, sku: v.sku })) };

      let res: Response;
      if (editProductId) {
        body.id = editProductId;
        res = await fetch("/api/admin/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save product");
      }

      const result = await res.json();

      // Create or update flash deal if enabled
      if (form.flash_deal && form.flash_deal_price > 0 && form.flash_deal_ends) {
        const productId = editProductId || result.id;
        if (productId) {
          const dealPayload = {
            deal_price: form.flash_deal_price,
            original_price: form.price,
            ends_at: new Date(form.flash_deal_ends).toISOString(),
            is_active: publish,
          };
          if (existingDealId) {
            await fetch("/api/admin/flash-deals", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: existingDealId, ...dealPayload }),
            });
          } else {
            await fetch("/api/admin/flash-deals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId, ...dealPayload }),
            });
          }
        }
      } else if (!form.flash_deal && existingDealId) {
        // Deal was turned off — deactivate it
        await fetch("/api/admin/flash-deals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existingDealId, is_active: false }),
        });
      }

      showToast(editProductId ? "Product updated" : publish ? "Product published" : "Draft saved");
      setTimeout(() => onBack(), 800);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error saving product", "error");
    } finally { setSaving(false); }
  };

  // Variant management
  const addVariant = () => {
    set("variants", [...form.variants, { size: "", color: "", color_hex: "#000000", stock: 0, sku: "" }]);
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    const updated = [...form.variants];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    set("variants", updated);
  };

  const removeVariant = (index: number) => {
    set("variants", form.variants.filter((_, i) => i !== index));
  };

  // Tag management
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      set("tags", [...form.tags, tag]);
      setTagInput("");
    }
  };

  // Image management
  const addImage = () => {
    const url = imageInput.trim();
    if (url && !form.images.includes(url)) {
      set("images", [...form.images, url]);
      setImageInput("");
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (list.length === 0) {
      showToast("Please select image files only", "error");
      return;
    }
    const tooBig = list.find(f => f.size > 8 * 1024 * 1024);
    if (tooBig) { showToast(`${tooBig.name} exceeds the 8MB limit`, "error"); return; }

    setUploading(true);
    setUploadProgress(`Uploading ${list.length} image${list.length > 1 ? "s" : ""}...`);

    const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

    // Primary path: upload straight to Supabase Storage from the browser.
    // This bypasses the hosting layer that returns HTML for multipart POSTs
    // (the "Server act… is not valid JSON" error).
    const uploadDirect = async (): Promise<string[]> => {
      const supabase = createClient();
      const urls: string[] = [];
      for (const file of list) {
        const ext = EXT[file.type] || "bin";
        const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      return urls;
    };

    // Fallback: the server upload route
    const uploadViaServer = async (): Promise<string[]> => {
      const fd = new FormData();
      list.forEach(f => fd.append("files", f));
      fd.append("folder", "products");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const text = await res.text();
      let data: { files?: { url: string }[]; error?: string };
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error("Upload was blocked by the server"); }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return (data.files || []).map(f => f.url);
    };

    try {
      let urls: string[] = [];
      try { urls = await uploadDirect(); }
      catch { urls = await uploadViaServer(); }
      if (urls.length > 0) {
        setForm(f => ({ ...f, images: [...f.images, ...urls.filter(u => !f.images.includes(u))] }));
        setErrors(e => { const n = { ...e }; delete n.images; return n; });
        showToast(`${urls.length} image${urls.length > 1 ? "s" : ""} uploaded`);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = async (index: number) => {
    const url = form.images[index];
    set("images", form.images.filter((_, j) => j !== index));
    // Remove from storage if hosted in our bucket (fire and forget, direct)
    const marker = "/object/public/product-images/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(url.slice(idx + marker.length));
      createClient().storage.from("product-images").remove([path]).catch(() => {});
    }
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= form.images.length) return;
    const imgs = [...form.images];
    [imgs[index], imgs[target]] = [imgs[target], imgs[index]];
    set("images", imgs);
  };

  const setMainImage = (index: number) => {
    if (index === 0) return;
    const imgs = [...form.images];
    const [img] = imgs.splice(index, 1);
    imgs.unshift(img);
    set("images", imgs);
  };

  const toggleSection = (key: string) => {
    setSections(s => ({ ...s, [key]: !s[key] }));
  };

  // Stable wrapper: real component is hoisted top-level (SectionCardBase) so
  // children keep their identity across renders and inputs don't lose focus.
  const SectionCard = SectionCardBase;
  const sectionCtx = { cardCls, hover, txt, sub, brd, sections, toggleSection };

  const FieldError = ({ field }: { field: string }) => errors[field] ? <p className="text-red-500 text-[11px] mt-1 font-medium">{errors[field]}</p> : null;

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center border transition-colors", brd, hover)}>
            <ArrowLeft className={cn("w-4 h-4", sub)} />
          </button>
          <div>
            <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>{editProductId ? "Edit Product" : "Create Product"}</h1>
            <p className={cn("text-xs mt-0.5", sub)}>Fill in the details below to {editProductId ? "update" : "create"} your product.</p>
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className={cn("rounded-[12px] border p-3", p, brd)}>
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-xs font-semibold", sub)}>Completion</span>
          <span className={cn("text-xs font-bold", progress === 100 ? "text-emerald-500" : "text-[#2563eb]")}>{progress}%</span>
        </div>
        <div className={cn("h-2 rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")}>
          <div className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-emerald-500" : "bg-[#2563eb]")} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* PRODUCT INFORMATION */}
          <SectionCard ctx={sectionCtx} id="info" title="Product Information" icon={Package} error={!!(errors.name || errors.category_id)}>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Product Name *</label>
                <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nike Air Max 90" className={cn(inpCls, errors.name && "border-red-500")} />
                <FieldError field="name" />
              </div>
              <div>
                <label className={labelCls}>Slug</label>
                <input type="text" value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="nike-air-max-90" className={inpCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={form.category_id} onChange={e => set("category_id", e.target.value)} className={cn(inpCls, errors.category_id && "border-red-500")}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <FieldError field="category_id" />
                </div>
                <div>
                  <label className={labelCls}>Brand</label>
                  <select value={form.brand_id} onChange={e => set("brand_id", e.target.value)} className={inpCls}>
                    <option value="">Select brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe the product..." rows={5} className={cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none transition-colors resize-y", inp, "focus:border-[#2563eb]")} />
              </div>
              <div>
                <label className={labelCls}>Tags</label>
                <div className="flex gap-2">
                  <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add a tag..." className={cn(inpCls, "flex-1")} />
                  <button onClick={addTag} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors">Add</button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(tag => (
                      <span key={tag} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>
                        {tag}
                        <button onClick={() => set("tags", form.tags.filter(t => t !== tag))} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* MEDIA */}
          <SectionCard ctx={sectionCtx} id="media" title="Product Images" icon={ImageIcon} error={!!errors.images}>
            <div className="space-y-3">
              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                multiple
                className="hidden"
                onChange={e => e.target.files && e.target.files.length > 0 && uploadFiles(e.target.files)}
              />

              {/* Dropzone */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!uploading && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "rounded-[12px] border-2 border-dashed p-6 text-center cursor-pointer transition-colors select-none",
                  dragOver ? "border-[#2563eb] bg-[#2563eb]/5" : brd,
                  errors.images && "border-red-500/60",
                  uploading && "opacity-60 pointer-events-none"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-[#2563eb]" />
                    <p className={cn("text-sm font-semibold", txt)}>{uploadProgress}</p>
                    <p className={cn("text-xs mt-1", sub)}>Please wait...</p>
                  </>
                ) : (
                  <>
                    <Upload className={cn("w-8 h-8 mx-auto mb-2", dragOver ? "text-[#2563eb]" : sub)} />
                    <p className={cn("text-sm font-semibold", txt)}>Click to browse or drag & drop images</p>
                    <p className={cn("text-xs mt-1", sub)}>JPEG, PNG, WebP, GIF, AVIF, SVG — up to 8MB each, 12 max per upload</p>
                  </>
                )}
              </div>
              <FieldError field="images" />

              {/* URL fallback */}
              <div>
                <button onClick={() => setShowUrlInput(v => !v)} className={cn("text-xs font-semibold flex items-center gap-1.5 transition-colors", showUrlInput ? "text-[#2563eb]" : sub, "hover:text-[#2563eb]")}>
                  <LinkIcon className="w-3.5 h-3.5" /> {showUrlInput ? "Hide URL input" : "Add image from URL instead"}
                </button>
                {showUrlInput && (
                  <div className="flex gap-2 mt-2">
                    <input type="url" value={imageInput} onChange={e => setImageInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addImage())} placeholder="https://example.com/image.jpg" className={cn(inpCls, "flex-1")} />
                    <button onClick={addImage} disabled={!imageInput.trim()} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">Add</button>
                  </div>
                )}
              </div>

              {/* Image grid with reorder / main / delete */}
              {form.images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.images.map((img, i) => (
                    <div key={`${img}-${i}`} className={cn("relative group rounded-[10px] overflow-hidden aspect-square border", i === 0 ? "border-[#2563eb]" : brd)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3C/svg%3E"; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      {/* Delete */}
                      <button onClick={() => removeImage(i)} title="Remove image" className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                        <X className="w-3 h-3" />
                      </button>
                      {/* Reorder + main */}
                      <div className="absolute bottom-1 inset-x-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveImage(i, -1)} disabled={i === 0} title="Move left" className="w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center disabled:opacity-30 hover:bg-white">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {i !== 0 && (
                          <button onClick={() => setMainImage(i)} title="Set as main image" className="px-1.5 h-6 rounded-full bg-white/90 text-black text-[9px] font-bold hover:bg-white">
                            SET MAIN
                          </button>
                        )}
                        <button onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1} title="Move right" className="w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center disabled:opacity-30 hover:bg-white">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {i === 0 && <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#2563eb] text-white">MAIN</span>}
                    </div>
                  ))}
                  {/* Add more tile */}
                  <button onClick={() => !uploading && fileInputRef.current?.click()} className={cn("rounded-[10px] border-2 border-dashed aspect-square flex flex-col items-center justify-center gap-1 transition-colors", brd, hover)}>
                    {uploading ? <Loader2 className={cn("w-5 h-5 animate-spin", sub)} /> : <Plus className={cn("w-5 h-5", sub)} />}
                    <span className={cn("text-[10px] font-semibold", sub)}>Add more</span>
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* PRICING */}
          <SectionCard ctx={sectionCtx} id="pricing" title="Price & Stock" icon={DollarSign} error={!!errors.price}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Unit Price ($) *</label>
                  <input type="number" min={0} step={0.01} value={form.price || ""} onChange={e => set("price", parseFloat(e.target.value) || 0)} placeholder="0.00" className={cn(inpCls, errors.price && "border-red-500")} />
                  <FieldError field="price" />
                </div>
                <div>
                  <label className={labelCls}>Compare At Price ($)</label>
                  <input type="number" min={0} step={0.01} value={form.compare_price || ""} onChange={e => set("compare_price", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Weight (kg)</label>
                  <input type="number" min={0} step={0.1} value={form.weight || ""} onChange={e => set("weight", parseFloat(e.target.value) || 0)} placeholder="0.0" className={inpCls} />
                </div>
              </div>
              {form.compare_price > 0 && form.price > 0 && form.compare_price > form.price && (
                <div className="rounded-[10px] bg-emerald-500/10 p-3 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600">
                    {Math.round((1 - form.price / form.compare_price) * 100)}% discount — Customer saves {`$${(form.compare_price - form.price).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* VARIANTS */}
          <SectionCard ctx={sectionCtx} id="variants" title="Product Variants" icon={Layers} error={!!errors.variants}>
            <div className="space-y-3">
              <FieldError field="variants" />
              {form.variants.map((v, i) => (
                <div key={i} className={cn("rounded-[12px] border p-3 space-y-2.5", brd)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-bold", txt)}>Variant {i + 1}</span>
                    <button onClick={() => removeVariant(i)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/10 transition-colors">
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className={cn("text-[10px] font-semibold block mb-1", sub)}>Size</label>
                      <input type="text" value={v.size} onChange={e => updateVariant(i, "size", e.target.value)} placeholder="42" className={cn("w-full h-9 rounded-[9px] border px-2.5 text-xs outline-none", inp, "focus:border-[#2563eb]")} />
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-semibold block mb-1", sub)}>Color</label>
                      <input type="text" value={v.color} onChange={e => updateVariant(i, "color", e.target.value)} placeholder="Black" className={cn("w-full h-9 rounded-[9px] border px-2.5 text-xs outline-none", inp, "focus:border-[#2563eb]")} />
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-semibold block mb-1", sub)}>Color Hex</label>
                      <div className="flex gap-1.5">
                        <input type="color" value={v.color_hex} onChange={e => updateVariant(i, "color_hex", e.target.value)} className="w-9 h-9 rounded-[9px] border cursor-pointer" />
                        <input type="text" value={v.color_hex} onChange={e => updateVariant(i, "color_hex", e.target.value)} className={cn("flex-1 h-9 rounded-[9px] border px-2.5 text-xs font-mono outline-none", inp, "focus:border-[#2563eb]")} />
                      </div>
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-semibold block mb-1", sub)}>Stock</label>
                      <input type="number" min={0} value={v.stock} onChange={e => updateVariant(i, "stock", parseInt(e.target.value) || 0)} className={cn("w-full h-9 rounded-[9px] border px-2.5 text-xs outline-none", inp, "focus:border-[#2563eb]")} />
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-semibold block mb-1", sub)}>SKU *</label>
                      <input type="text" value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} placeholder="SKU-001" className={cn("w-full h-9 rounded-[9px] border px-2.5 text-xs outline-none", inp, "focus:border-[#2563eb]")} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addVariant} className={cn("w-full h-10 rounded-[11px] border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2 transition-colors", brd, sub, hover)}>
                <Plus className="w-4 h-4" /> Add Variant
              </button>
            </div>
          </SectionCard>

          {/* SEO */}
          <SectionCard ctx={sectionCtx} id="seo" title="SEO Meta Tags" icon={Globe}>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Meta Title</label>
                <input type="text" value={form.meta_title} onChange={e => set("meta_title", e.target.value)} placeholder={form.name || "Product title for search engines"} className={inpCls} />
                <p className={cn("text-[10px] mt-1", form.meta_title.length > 60 ? "text-amber-500" : sub)}>{form.meta_title.length}/60 characters</p>
              </div>
              <div>
                <label className={labelCls}>Meta Description</label>
                <textarea value={form.meta_description} onChange={e => set("meta_description", e.target.value)} placeholder="Brief description for search results..." rows={3} className={cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none transition-colors resize-y", inp, "focus:border-[#2563eb]")} />
                <p className={cn("text-[10px] mt-1", form.meta_description.length > 160 ? "text-amber-500" : sub)}>{form.meta_description.length}/160 characters</p>
              </div>
              {/* Google Preview */}
              <div className={cn("rounded-[10px] border p-3", brd)}>
                <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-2", sub)}>Search Preview</p>
                <p className="text-[#1a0dab] text-sm font-medium truncate">{form.meta_title || form.name || "Product Title"}</p>
                <p className="text-[#006621] text-xs truncate">atlantassneakers.com/product/{form.slug || "..."}</p>
                <p className="text-[#545454] text-xs mt-0.5 line-clamp-2">{form.meta_description || form.description?.slice(0, 160) || "Product description..."}</p>
              </div>
            </div>
          </SectionCard>

          {/* SHIPPING */}
          <SectionCard ctx={sectionCtx} id="shipping" title="Shipping Configuration" icon={Truck}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={cn("text-sm font-semibold", txt)}>Free Shipping</label>
                <button onClick={() => set("free_shipping", !form.free_shipping)} className={cn("w-11 h-6 rounded-full transition-colors relative", form.free_shipping ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form.free_shipping ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
              </div>
              {!form.free_shipping && (
                <div>
                  <label className={labelCls}>Shipping Cost ($)</label>
                  <input type="number" min={0} step={0.01} value={form.shipping_cost || ""} onChange={e => set("shipping_cost", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inpCls} />
                </div>
              )}
            </div>
          </SectionCard>

          {/* FLASH DEAL */}
          <SectionCard ctx={sectionCtx} id="flash" title="Flash Deal" icon={Zap}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className={cn("text-sm font-semibold", txt)}>Add to Flash Deal</label>
                  <p className={cn("text-[10px] mt-0.5", sub)}>Enable to create a time-limited deal for this product</p>
                </div>
                <button onClick={() => set("flash_deal", !form.flash_deal)} className={cn("w-11 h-6 rounded-full transition-colors relative", form.flash_deal ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form.flash_deal ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
              </div>
              {form.flash_deal && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Deal Price ($) *</label>
                      <input type="number" min={0} step={0.01} value={form.flash_deal_price || ""} onChange={e => set("flash_deal_price", parseFloat(e.target.value) || 0)} className={cn(inpCls, errors.flash_deal_price && "border-red-500")} />
                      <FieldError field="flash_deal_price" />
                    </div>
                    <div>
                      <label className={labelCls}>End Date *</label>
                      <input type="datetime-local" value={form.flash_deal_ends} onChange={e => set("flash_deal_ends", e.target.value)} className={cn(inpCls, errors.flash_deal_ends && "border-red-500")} />
                      <FieldError field="flash_deal_ends" />
                    </div>
                  </div>
                  {form.flash_deal_price > 0 && form.price > 0 && (
                    <div className={cn("rounded-[10px] p-3", form.flash_deal_price < form.price ? "bg-emerald-500/10" : "bg-red-500/10")}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-semibold", form.flash_deal_price < form.price ? "text-emerald-600" : "text-red-600")}>
                          {form.flash_deal_price < form.price
                            ? `${Math.round((1 - form.flash_deal_price / form.price) * 100)}% off — ${`$${form.price.toFixed(2)}`} → ${`$${form.flash_deal_price.toFixed(2)}`}`
                            : "Deal price must be lower than regular price"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className={cn("rounded-[10px] border p-3 flex items-start gap-2", brd, "bg-amber-500/5")}>
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className={cn("text-[11px]", sub)}>Ensure the flash deal price covers your CJ Dropshipping cost to avoid negative margins.</p>
                  </div>
                </>
              )}
            </div>
          </SectionCard>
        </div>

        {/* RIGHT COLUMN - SIDEBAR */}
        <div className="space-y-4">
          {/* VISIBILITY */}
          <SectionCard ctx={sectionCtx} id="visibility" title="Visibility & Status" icon={Eye}>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value as FormState["status"])} className={inpCls}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className={cn("text-sm font-semibold", txt)}>Featured Product</label>
                  <button onClick={() => set("is_featured", !form.is_featured)} className={cn("w-11 h-6 rounded-full transition-colors relative", form.is_featured ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                    <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form.is_featured ? "translate-x-[22px]" : "translate-x-0.5")} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className={cn("text-sm font-semibold", txt)}>New Arrival</label>
                  <button onClick={() => set("is_new", !form.is_new)} className={cn("w-11 h-6 rounded-full transition-colors relative", form.is_new ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                    <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form.is_new ? "translate-x-[22px]" : "translate-x-0.5")} />
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* PRODUCT SUMMARY */}
          <div className={cardCls}>
            <div className="p-4">
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Summary</p>
              <div className="space-y-2">
                <SummaryRow dark={dark} label="Name" value={form.name || "—"} ok={!!form.name} />
                <SummaryRow dark={dark} label="Price" value={form.price > 0 ? `$${form.price.toFixed(2)}` : "—"} ok={form.price > 0} />
                <SummaryRow dark={dark} label="Category" value={categories.find(c => c.id === form.category_id)?.name || "—"} ok={!!form.category_id} />
                <SummaryRow dark={dark} label="Brand" value={brands.find(b => b.id === form.brand_id)?.name || "—"} ok={!!form.brand_id} />
                <SummaryRow dark={dark} label="Images" value={`${form.images.length} image(s)`} ok={form.images.length > 0} />
                <SummaryRow dark={dark} label="Variants" value={`${form.variants.length} variant(s)`} ok={form.variants.length > 0} />
                <SummaryRow dark={dark} label="Tags" value={`${form.tags.length} tag(s)`} ok={form.tags.length > 0} />
                <SummaryRow dark={dark} label="Flash Deal" value={form.flash_deal ? "Yes" : "No"} ok={!form.flash_deal || (form.flash_deal_price > 0 && form.flash_deal_price < form.price)} />
              </div>
            </div>
          </div>

          {/* CJ DROPSHIPPING */}
          <div className={cardCls}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center bg-orange-500/10">
                  <Truck className="w-4 h-4 text-orange-500" />
                </div>
                <span className={cn("text-sm font-bold", txt)}>CJ Dropshipping</span>
              </div>
              <p className={cn("text-xs", sub)}>This product will be sourced from CJ Dropshipping. Ensure pricing covers supplier cost + shipping.</p>
              <div className={cn("mt-3 rounded-[10px] border p-3 space-y-1.5", brd)}>
                <div className="flex justify-between">
                  <span className={cn("text-[10px]", sub)}>Selling Price</span>
                  <span className={cn("text-xs font-bold", txt)}>{form.price > 0 ? `$${form.price.toFixed(2)}` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className={cn("text-[10px]", sub)}>Est. Cost (60%)</span>
                  <span className={cn("text-xs font-semibold", sub)}>{form.price > 0 ? `$${(form.price * 0.6).toFixed(2)}` : "—"}</span>
                </div>
                <div className={cn("flex justify-between pt-1.5 border-t", brd)}>
                  <span className={cn("text-[10px] font-semibold", sub)}>Est. Margin</span>
                  <span className="text-xs font-bold text-emerald-500">{form.price > 0 ? `$${(form.price * 0.4).toFixed(2)}` : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STICKY ACTION BAR */}
      <div className={cn("sticky bottom-0 z-30 rounded-[14px] border p-3 flex items-center justify-between gap-3 backdrop-blur-sm", p, brd, dark ? "bg-[#171c24]/95" : "bg-white/95")}>
        <div className="flex items-center gap-2">
          {Object.keys(errors).length > 0 && (
            <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {Object.keys(errors).length} error(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className={cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors", brd, sub, hover)}>Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving} className={cn("h-10 px-5 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover)}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish Product
          </button>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={cn("fixed bottom-20 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg",
          toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]"
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

type SectionCtx = {
  cardCls: string;
  hover: string;
  txt: string;
  sub: string;
  brd: string;
  sections: Record<string, boolean>;
  toggleSection: (key: string) => void;
};

function SectionCardBase({ ctx, id, title, icon: Icon, children, error: hasError }: { ctx: SectionCtx; id: string; title: string; icon: typeof Package; children: React.ReactNode; error?: boolean }) {
  const { cardCls, hover, txt, sub, brd, sections, toggleSection } = ctx;
  return (
    <div className={cn(cardCls, hasError && "border-red-500/50")}>
      <button onClick={() => toggleSection(id)} className={cn("w-full flex items-center justify-between p-4 transition-colors", hover)}>
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-[9px] flex items-center justify-center", hasError ? "bg-red-500/10" : "bg-[#2563eb]/10")}>
            <Icon className={cn("w-4 h-4", hasError ? "text-red-500" : "text-[#2563eb]")} />
          </div>
          <span className={cn("text-sm font-bold", txt)}>{title}</span>
        </div>
        {sections[id] ? <ChevronUp className={cn("w-4 h-4", sub)} /> : <ChevronDown className={cn("w-4 h-4", sub)} />}
      </button>
      {sections[id] && <div className={cn("px-4 pb-4 border-t pt-4", brd)}>{children}</div>}
    </div>
  );
}

function SummaryRow({ dark, label, value, ok }: { dark: boolean; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-xs font-semibold truncate max-w-[120px]", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{value}</span>
        {ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />}
      </div>
    </div>
  );
}
