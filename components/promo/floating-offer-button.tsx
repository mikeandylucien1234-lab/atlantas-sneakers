"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Check, Mail } from "lucide-react";

const LS_KEY = "atlanta_offer_btn_pos";
const SIZE = 60;
const MARGIN = 12;
const BOTTOM_RESERVE = 84; // keep clear of the bottom nav
const DRAG_THRESHOLD = 6; // px moved before it counts as a drag (not a click)

type Pos = { x: number; y: number };

// Keep the button inside the safe area: below the sticky header and above the
// bottom nav, so it can never cover the cart / search / tabs.
function clampToViewport(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const header = document.querySelector("header");
  const headerH = header ? Math.round(header.getBoundingClientRect().height) : 180;
  const minY = headerH + 8;
  const maxX = window.innerWidth - SIZE - MARGIN;
  const maxY = Math.max(minY, window.innerHeight - SIZE - BOTTOM_RESERVE);
  return {
    x: Math.min(Math.max(MARGIN, p.x), maxX),
    y: Math.min(Math.max(minY, p.y), maxY),
  };
}

export function FloatingOfferButton() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef<{ px: number; py: number; x: number; y: number }>({ px: 0, py: 0, x: 0, y: 0 });

  // Initial position: bottom-right (above the bottom nav), or restored.
  useEffect(() => {
    let initial: Pos | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) initial = JSON.parse(raw);
    } catch {}
    if (!initial) initial = { x: window.innerWidth - SIZE - 16, y: window.innerHeight - SIZE - 96 };
    setPos(clampToViewport(initial));
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampToViewport(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!pos) return;
    dragging.current = true;
    moved.current = false;
    start.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.px;
    const dy = e.clientY - start.current.py;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved.current = true;
    setPos(clampToViewport({ x: start.current.x + dx, y: start.current.y + dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!moved.current) {
      setOpen(true); // it was a tap, not a drag
    } else if (pos) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(pos)); } catch {}
    }
  }, [pos]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  if (!pos) return null;

  return (
    <>
      {/* Draggable floating button */}
      <button
        type="button"
        aria-label="Get 10% off"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none" }}
        className="fixed z-[45] grid place-items-center rounded-full bg-[#f5c518] text-[#2563eb] shadow-[0_10px_24px_rgba(0,0,0,.28)] ring-2 ring-white/70 transition-transform active:scale-95 cursor-grab active:cursor-grabbing animate-[pulse_2.4s_ease-in-out_infinite]"
      >
        <Sparkles className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
      </button>

      {/* Offer modal */}
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#1d4ed8,#2563eb)] p-6 text-white shadow-2xl sm:p-8 animate-[slideUp_.25s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f5c518] text-[#2563eb]">
              <Sparkles className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
            </div>

            {!subscribed ? (
              <>
                <h2 className="text-[26px] font-extrabold leading-tight tracking-[-.01em]">GET 10% OFF YOUR FIRST ORDER</h2>
                <p className="mt-2 text-[14px] text-white/85">Enter your email and be the first to know about exclusive deals, new arrivals &amp; more!</p>
                <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3">
                    <Mail className="h-4 w-4 text-[#9aa3ad]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="h-12 flex-1 bg-transparent text-[14px] text-[#16181d] outline-none"
                    />
                  </div>
                  <button type="submit" className="h-12 rounded-xl bg-[#0a0b0d] text-[15px] font-extrabold text-white transition hover:brightness-110 active:scale-[.99]">
                    Get my 10% off
                  </button>
                </form>
                <p className="mt-2 text-center text-[11px] text-white/60">No spam, unsubscribe anytime.</p>
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-white/15"><Check className="h-8 w-8 text-white" /></div>
                <h2 className="text-[22px] font-extrabold">You're in! 🎉</h2>
                <p className="mt-2 text-[14px] text-white/85">Your 10% off code is on its way to <span className="font-bold">{email}</span>.</p>
                <button onClick={() => setOpen(false)} className="mt-5 rounded-full bg-white px-6 py-2.5 font-bold text-[#1d4ed8] transition hover:bg-white/90">Start shopping</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
