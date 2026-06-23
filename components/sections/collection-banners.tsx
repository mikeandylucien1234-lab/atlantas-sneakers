import Link from "next/link";
import { ArrowRight } from "lucide-react";

const collections = [
  { title: "MEN'S COLLECTION", off: "UP TO 60% OFF", cta: "SHOP MEN", bg: "linear-gradient(135deg,#23272e,#0b0e13)", fg: "#ffffff", btnBg: "#ffffff", btnFg: "#16181d", label: "MENS MODEL" },
  { title: "WOMEN'S COLLECTION", off: "UP TO 60% OFF", cta: "SHOP WOMEN", bg: "linear-gradient(135deg,#fbcfe8,#f9a8d4)", fg: "#7a1f4d", btnBg: "#ffffff", btnFg: "#9d174d", label: "WOMENS MODEL" },
  { title: "KIDS COLLECTION", off: "UP TO 50% OFF", cta: "SHOP KIDS", bg: "linear-gradient(135deg,#bfdbfe,#93c5fd)", fg: "#15366b", btnBg: "#ffffff", btnFg: "#1d4ed8", label: "KIDS MODEL" },
  { title: "HOME ESSENTIALS", off: "UP TO 40% OFF", cta: "SHOP HOME", bg: "linear-gradient(135deg,#ece2d2,#d8c5a6)", fg: "#5a4a30", btnBg: "#ffffff", btnFg: "#6b4f2a", label: "HOME SETUP" },
];

export function CollectionBanners() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-10">
      {collections.map((c) => (
        <div
          key={c.title}
          className="relative h-[220px] sm:h-[260px] lg:h-[300px] rounded-[16px] overflow-hidden cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]"
          style={{ background: c.bg }}
        >
          {/* Placeholder image */}
          <div className="absolute -right-[30px] bottom-0 w-[160px] h-[220px] opacity-50 bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-end justify-center pb-[10px]">
            <span className="font-mono text-[9px] tracking-[.08em] text-[#6b7280]">{c.label}</span>
          </div>
          <div className="relative z-[2] p-5 flex flex-col h-full">
            <div className="text-[18px] font-extrabold leading-[1.15] max-w-[130px]" style={{ color: c.fg }}>{c.title}</div>
            <div className="text-[12px] font-bold opacity-85 mt-[7px] tracking-[.02em]" style={{ color: c.fg }}>{c.off}</div>
            <Link
              href="/shop"
              className="mt-auto self-start flex items-center gap-1.5 font-bold text-[11px] tracking-[.04em] py-[10px] px-4 rounded-[999px] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150"
              style={{ background: c.btnBg, color: c.btnFg }}
            >
              {c.cta} <ArrowRight className="w-[15px] h-[15px]" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
