"use client";

// Storefront warranty display for the product page. Fetches the resolved
// warranty for a product and renders a badge, duration, type, coverage summary,
// "View Details", "Download PDF", claim process, support contact, and emits
// Schema.org WarrantyPromise structured data. Fully data-driven — nothing is
// shown unless a real, active warranty is assigned.
import { useEffect, useState } from "react";
import { ShieldCheck, ChevronDown, Download, FileText, LifeBuoy, Mail, Phone, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { productId: string; lang?: string };

function durLabel(t: string, v: number, c?: string) {
  if (t === "lifetime") return "Lifetime";
  if (t === "none") return "No Warranty";
  if (t === "custom") return c || "Custom";
  if (!v) return "";
  const u = t === "days" ? "day" : t === "years" ? "year" : "month";
  return `${v} ${u}${v > 1 ? "s" : ""}`;
}

export function ProductWarranty({ productId, lang }: Props) {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = `/api/storefront/warranty?product_id=${productId}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;
    fetch(url).then(r => r.json()).then(d => { if (alive && d?.warranty) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [productId, lang]);

  if (!data?.warranty) return null;
  const w = data.warranty;
  const files = data.files || [];
  const duration = durLabel(w.duration_type, w.duration_value, w.duration_custom);
  const pdf = files.find((f: any) => ["pdf", "terms", "conditions"].includes(f.file_type));
  const color = w.badge_color || "#2563eb";

  const schema = w.schema_enabled ? {
    "@context": "https://schema.org",
    "@type": "WarrantyPromise",
    "durationOfWarranty": duration ? { "@type": "QuantitativeValue", "value": w.duration_value, "unitText": w.duration_type } : undefined,
    "warrantyScope": (w.coverage || []).join(", ") || w.warranty_type,
    "name": w.name,
    "description": w.meta_description || w.short_description || w.description || undefined,
  } : null;

  return (
    <div className="mt-4">
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}

      {/* Badge card */}
      <div className="rounded-[18px] border border-[#eef0f3] p-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1a" }}>
            {w.icon_url ? <img src={w.icon_url} alt="" className="w-6 h-6 object-contain" /> : <ShieldCheck className="w-5 h-5" style={{ color }} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>{w.badge_text || `${duration} Warranty`}</span>
              <span className="text-[11px] font-semibold text-[#8a929c] capitalize">{w.warranty_type} warranty</span>
            </div>
            <p className="text-[15px] font-bold text-[#16181d] mt-1">{w.name}</p>
            {w.short_description && <p className="text-[13px] text-[#5b6472] mt-0.5">{w.short_description}</p>}
            {(w.coverage || []).length > 0 && (
              <p className="text-[12px] text-[#5b6472] mt-2"><span className="font-semibold text-[#16181d]">Covers:</span> {(w.coverage || []).slice(0, 5).join(", ")}{(w.coverage || []).length > 5 ? "…" : ""}</p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button onClick={() => setOpen(true)} className="text-[12px] font-bold text-[#2563eb] flex items-center gap-1">View Details <ChevronDown className="w-3.5 h-3.5" /></button>
              {pdf && <a href={pdf.url} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-[#2563eb] flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Download PDF</a>}
              {(w.claim_url || w.claim_email) && <a href={w.claim_url || `mailto:${w.claim_email}`} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-[#2563eb] flex items-center gap-1"><LifeBuoy className="w-3.5 h-3.5" /> Claim Warranty</a>}
            </div>
          </div>
        </div>
      </div>

      {/* Details modal */}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-t-[20px] sm:rounded-[20px] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" style={{ color }} />
                <p className="text-[17px] font-extrabold text-[#16181d]">{w.name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-[#8a929c] hover:text-[#16181d]"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Info label="Type" value={`${w.warranty_type} warranty`} />
              <Info label="Duration" value={duration || "—"} />
              {w.processing_time && <Info label="Processing Time" value={w.processing_time} />}
              {(w.countries || []).length > 0 && <Info label="Coverage Area" value={(w.countries || []).join(", ")} />}
            </div>

            {w.description && <p className="text-[13px] text-[#5b6472] leading-[1.7] mb-4">{w.description}</p>}

            {(w.coverage || []).length > 0 && <Section title="What's Covered" items={w.coverage} color="#16a34a" />}
            {(w.exclusions || []).length > 0 && <Section title="Not Covered" items={w.exclusions} color="#dc2626" />}

            {(w.claim_steps || []).length > 0 && (
              <div className="mb-4">
                <p className="text-[13px] font-bold text-[#16181d] mb-2">Claim Process</p>
                <ol className="space-y-2">
                  {(w.claim_steps || []).map((st: any, i: number) => (
                    <li key={i} className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>{i + 1}</span>
                      <span className="text-[13px] text-[#5b6472]">{st.title || st.description}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(w.claim_docs || []).length > 0 && (
              <p className="text-[12px] text-[#5b6472] mb-4"><span className="font-semibold text-[#16181d]">Documents required:</span> {(w.claim_docs || []).join(", ")}</p>
            )}

            {files.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {files.map((f: any) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] font-semibold text-[#2563eb]">
                    {f.file_type === "link" ? <ExternalLink className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {f.title || f.url}
                  </a>
                ))}
              </div>
            )}

            {(w.claim_email || w.claim_phone || w.claim_url) && (
              <div className="border-t border-[#eef0f3] pt-3">
                <p className="text-[13px] font-bold text-[#16181d] mb-2">Support Contact</p>
                <div className="flex flex-col gap-1.5">
                  {w.claim_email && <a href={`mailto:${w.claim_email}`} className="flex items-center gap-2 text-[13px] text-[#5b6472]"><Mail className="w-4 h-4 text-[#2563eb]" /> {w.claim_email}</a>}
                  {w.claim_phone && <a href={`tel:${w.claim_phone}`} className="flex items-center gap-2 text-[13px] text-[#5b6472]"><Phone className="w-4 h-4 text-[#2563eb]" /> {w.claim_phone}</a>}
                  {w.claim_url && <a href={w.claim_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] text-[#5b6472]"><LifeBuoy className="w-4 h-4 text-[#2563eb]" /> Support Center</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[12px] bg-[#f6f8fb] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8a929c]">{label}</p><p className="text-[13px] font-semibold text-[#16181d] capitalize mt-0.5">{value}</p></div>;
}
function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="mb-4">
      <p className="text-[13px] font-bold text-[#16181d] mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => <span key={c} className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: color + "14", color }}>{c}</span>)}
      </div>
    </div>
  );
}
