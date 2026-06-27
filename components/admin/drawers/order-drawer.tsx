"use client";

import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Printer, RotateCcw } from "lucide-react";
import type { Order } from "@/types";

const STATUS_FLOW = ["pending", "confirmed", "shipped", "delivered"];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fdecdd", text: "#ea7317" },
  confirmed: { bg: "#eaf1fb", text: "#2563eb" },
  shipped: { bg: "#efe9fd", text: "#7c3aed" },
  delivered: { bg: "#e8f7ee", text: "#16a34a" },
  cancelled: { bg: "#fde8ec", text: "#ef4444" },
  paid: { bg: "#e8f7ee", text: "#16a34a" },
  failed: { bg: "#fde8ec", text: "#ef4444" },
  refunded: { bg: "#eef1f5", text: "#6b7280" },
};

type Props = {
  dark: boolean;
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, status: string) => void;
};

export function OrderDrawer({ dark, order, open, onClose, onStatusChange }: Props) {
  if (!order) return null;
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
  const psc = STATUS_COLORS[order.payment_status] ?? STATUS_COLORS.pending;

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <Drawer open={open} onClose={onClose} title={`Order ${order.order_number}`} className="max-w-lg">
      <div className="space-y-5">
        {/* Status + Payment */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{order.status}</span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: psc.bg, color: psc.text }}>{order.payment_status}</span>
          <span className={cn("text-xs ml-auto", sub)}>{new Date(order.created_at).toLocaleString()}</span>
        </div>

        {/* Timeline */}
        <div>
          <h3 className={cn("text-sm font-bold mb-3", txt)}>Status Timeline</h3>
          <div className="space-y-0">
            {STATUS_FLOW.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <div key={s} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {done ? <CheckCircle2 className="w-5 h-5 text-[#16a34a]" /> : <Circle className="w-5 h-5 text-[#d1d5db]" />}
                    {i < STATUS_FLOW.length - 1 && <div className={cn("w-0.5 h-6", done ? "bg-[#16a34a]" : "bg-[#d1d5db]")} />}
                  </div>
                  <p className={cn("text-sm capitalize pb-4", done ? txt : sub)}>{s}</p>
                </div>
              );
            })}
          </div>
          {nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="w-full h-[42px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors capitalize"
            >
              Mark {nextStatus}
            </button>
          )}
        </div>

        {/* Items */}
        <div>
          <h3 className={cn("text-sm font-bold mb-3", txt)}>Items ({order.items?.length ?? 0})</h3>
          <div className={cn("border rounded-[12px] divide-y", brd)}>
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold", dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f6f8fb] text-[#8a929c]")}>
                  {item.product?.images?.[0] ? (
                    <img src={item.product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : "IMG"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", txt)}>{item.product?.name ?? "Product"}</p>
                  <p className={cn("text-xs", sub)}>Qty: {item.quantity}</p>
                </div>
                <p className={cn("text-sm font-bold", txt)}>${item.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className={cn("border rounded-[12px] p-4 space-y-2", brd)}>
          <div className="flex justify-between"><span className={cn("text-sm", sub)}>Subtotal</span><span className={cn("text-sm font-semibold", txt)}>${order.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className={cn("text-sm", sub)}>Shipping</span><span className={cn("text-sm font-semibold", txt)}>${order.shipping_cost.toFixed(2)}</span></div>
          {order.discount > 0 && <div className="flex justify-between"><span className={cn("text-sm", sub)}>Discount</span><span className="text-sm font-semibold text-[#16a34a]">-${order.discount.toFixed(2)}</span></div>}
          <div className={cn("flex justify-between pt-2 border-t", brd)}><span className={cn("text-sm font-bold", txt)}>Total</span><span className={cn("text-sm font-extrabold", txt)}>${order.total.toFixed(2)}</span></div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className={cn("flex-1 h-[42px] rounded-[11px] border text-sm font-semibold flex items-center justify-center gap-2 transition-colors", brd, txt, dark ? "hover:bg-white/5" : "hover:bg-black/5")}>
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          <button className="flex-1 h-[42px] rounded-[11px] bg-[#ef4444] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#dc2626] transition-colors">
            <RotateCcw className="w-4 h-4" /> Refund
          </button>
        </div>
      </div>
    </Drawer>
  );
}
