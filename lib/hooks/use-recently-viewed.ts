"use client";

import { useEffect, useState } from "react";

const KEY = "atlanta_recently_viewed";
const MAX = 20;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

// Record a product id as recently viewed (most-recent first, de-duped, capped).
export function recordRecentlyViewed(id: string) {
  if (typeof window === "undefined" || !id) return;
  const list = [id, ...read().filter((x) => x !== id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// Read the recently-viewed ids (client-only). `exclude` drops one id (e.g. current product).
export function useRecentlyViewed(exclude?: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(read().filter((x) => x !== exclude)); }, [exclude]);
  return ids;
}
